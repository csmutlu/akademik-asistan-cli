import React, { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ApiClient, AuthRequiredError } from '../api/client.js';
import { createBuddyMessage, getBuddyWelcomeMessage, loadBuddyHistory, persistBuddyHistory, trimBuddyHistory } from '../buddy/history.js';
import { loginWithBrowser } from '../auth/login.js';
import { executeCommand } from '../commands/execute.js';
import { getCommandDefinition, parseCommand } from '../commands/registry.js';
import { HOME_REFRESH_INTERVAL_MS } from '../config.js';
import { loadHomeSnapshot } from '../coordinator/home.js';
import { ui } from '../display.js';
import { readLatestLoginDebugSummary, type LoginDebugSummary } from '../logging/login-debug.js';
import { readRecentMemoryEvents, type MemoryEvent } from '../memory/log.js';
import { renderCommandResult, renderHelpText, renderOnboardingText } from '../presenters/text.js';
import { writePreferences } from '../state/storage.js';
import { getIdentityLabel, getTransientFailureText } from './connection.js';
import { getErrorPanelLines, getErrorPanelTitle, type ErrorSource } from './error-panel.js';
import { getCliVersion } from '../version.js';
import type {
  BuddyMessage,
  CommandId,
  CommandResult,
  HomePayload,
  ParsedCommand,
  Profile,
  StoredPreferences,
} from '../types.js';

type HomeCard = {
  id: 'gundem' | 'bugun' | 'odev' | 'sinav' | 'duyurular' | 'yemekhane';
  title: string;
  badge: string;
  subtitle: string;
  lines: string[];
  tone: 'cyan' | 'green' | 'yellow' | 'magenta' | 'blue';
};

type ActiveRegion = 'grid' | 'detail' | 'rail';
type RailMode = 'activity' | 'buddy';

type AppProps = {
  api: ApiClient;
  preferences: StoredPreferences;
};

function agendaLines(payload: HomePayload['cards']['gundem'], emptyText: string): string[] {
  if (payload.items.length === 0) {
    return [emptyText];
  }

  return payload.items.slice(0, 3).map((item) => `${item.title} • ${item.badge}`);
}

function announcementLines(payload: HomePayload['cards']['duyurular']): string[] {
  if (payload.items.length === 0) {
    return ['Yeni duyuru görünmüyor.'];
  }

  return payload.items.slice(0, 3).map((item) => `${item.title} • ${item.date}`);
}

function cafeteriaLines(payload: HomePayload['cards']['yemekhane']): string[] {
  if (!payload.menu?.items.length) {
    return ['Bugün için menü bulunamadı.'];
  }

  return payload.menu.items.slice(0, 3);
}

function buildCardState(home: HomePayload | null): HomeCard[] {
  if (!home) {
    return [
      { id: 'gundem', title: 'Gündem', badge: '-', subtitle: 'Bekleniyor', lines: ['Veri bağlanınca güncellenecek.'], tone: 'cyan' },
      { id: 'bugun', title: 'Bugün', badge: '-', subtitle: 'Bekleniyor', lines: ['Ders ve teslimler yolda.'], tone: 'green' },
      { id: 'odev', title: 'Ödevler', badge: '-', subtitle: 'Bekleniyor', lines: ['Yaklaşan teslimler bağlanınca görünür.'], tone: 'yellow' },
      { id: 'sinav', title: 'Sınavlar', badge: '-', subtitle: 'Bekleniyor', lines: ['Yaklaşan sınavlar bağlanınca görünür.'], tone: 'magenta' },
      { id: 'duyurular', title: 'Duyurular', badge: '-', subtitle: 'Bekleniyor', lines: ['Son scrape sonrası dolacak.'], tone: 'blue' },
      { id: 'yemekhane', title: 'Yemekhane', badge: '-', subtitle: 'Bekleniyor', lines: ['Menü bağlanınca yansır.'], tone: 'green' },
    ];
  }

  return [
    {
      id: 'gundem',
      title: 'Gündem',
      badge: String(home.cards.gundem.items.length),
      subtitle: home.cards.gundem.summary.label,
      lines: agendaLines(home.cards.gundem, 'Yaklaşan kayıt yok.'),
      tone: 'cyan',
    },
    {
      id: 'bugun',
      title: 'Bugün',
      badge: String(home.cards.bugun.items.length),
      subtitle: home.cards.bugun.summary.label,
      lines: agendaLines(home.cards.bugun, 'Bugün sakin.'),
      tone: 'green',
    },
    {
      id: 'odev',
      title: 'Ödevler',
      badge: String(home.cards.odev.items.length),
      subtitle: home.cards.odev.summary.label,
      lines: agendaLines(home.cards.odev, 'Teslim görünmüyor.'),
      tone: 'yellow',
    },
    {
      id: 'sinav',
      title: 'Sınavlar',
      badge: String(home.cards.sinav.items.length),
      subtitle: home.cards.sinav.summary.label,
      lines: agendaLines(home.cards.sinav, 'Sınav görünmüyor.'),
      tone: 'magenta',
    },
    {
      id: 'duyurular',
      title: 'Duyurular',
      badge: String(home.cards.duyurular.count),
      subtitle: home.cards.duyurular.cached ? 'Cache aktif' : 'Canlı',
      lines: announcementLines(home.cards.duyurular),
      tone: 'blue',
    },
    {
      id: 'yemekhane',
      title: 'Yemekhane',
      badge: home.cards.yemekhane.targetDate,
      subtitle: home.cards.yemekhane.menu?.items[0] || 'Menü hazır değil',
      lines: cafeteriaLines(home.cards.yemekhane),
      tone: 'green',
    },
  ];
}

function chunkCards(cards: HomeCard[], columns: number): HomeCard[][] {
  if (columns <= 1) {
    return [cards];
  }

  return Array.from({ length: columns }, (_, columnIndex) =>
    cards.filter((_, index) => index % columns === columnIndex),
  );
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) {
    return '-';
  }

  return new Date(iso).toLocaleString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatActivityEvent(event: MemoryEvent): string {
  const at = formatTime(event.ts);
  if (event.type === 'session-start') {
    return `${at} • Oturum başladı`;
  }

  const outcome = event.ok === false ? 'Hata' : 'Tamam';
  const meta = event.meta?.mode ? ` • ${String(event.meta.mode)}` : '';
  return `${at} • ${outcome} • ${event.command || 'komut'}${meta}`;
}

function buildDetailResult(home: HomePayload | null, commandId: HomeCard['id']): CommandResult | null {
  if (!home) {
    return null;
  }

  switch (commandId) {
    case 'gundem':
    case 'bugun':
    case 'odev':
    case 'sinav':
      return { kind: 'agenda', data: home.cards[commandId] };
    case 'duyurular':
      return { kind: 'announcements', data: home.cards.duyurular };
    case 'yemekhane':
      return { kind: 'cafeteria', data: home.cards.yemekhane };
    default:
      return null;
  }
}

function buildFreshnessLines(home: HomePayload | null, cardId: HomeCard['id']): string[] {
  if (!home) {
    return ['Synced: -'];
  }

  const base = [`Synced: ${formatTime(home.syncedAt)}`];

  if (cardId === 'duyurular') {
    base.push(`Cache: ${home.freshness.announcements.cached ? 'evet' : 'hayır'}`);
    base.push(`Stale: ${home.freshness.announcements.stale ? 'evet' : 'hayır'}`);
    base.push(`Son scrape: ${formatTime(home.freshness.announcements.lastScraped)}`);
  }

  if (cardId === 'yemekhane') {
    base.push(`Fetched: ${formatTime(home.freshness.cafeteria.fetchedAt)}`);
    base.push(`Kaynak: ${home.freshness.cafeteria.sourceUrl || '-'}`);
  }

  return base;
}

async function runCommand(api: ApiClient, id: CommandId, args: Record<string, string | boolean> = {}): Promise<CommandResult> {
  const parsed: ParsedCommand = {
    id,
    args,
    json: false,
    rawTokens: [id],
  };
  return executeCommand(parsed, { api });
}

type PanelProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  lines?: string[];
  selected?: boolean;
  borderColor?: 'cyan' | 'green' | 'yellow' | 'magenta' | 'red' | 'blue' | 'gray';
  titleColor?: 'cyanBright' | 'greenBright' | 'yellowBright' | 'magentaBright' | 'whiteBright' | 'blueBright' | 'redBright';
};

function Panel({
  title,
  subtitle,
  badge,
  lines = [],
  selected = false,
  borderColor = 'gray',
  titleColor = 'whiteBright',
}: PanelProps) {
  return (
    <Box borderStyle="round" borderColor={selected ? borderColor : 'gray'} paddingX={1} paddingY={0} marginBottom={1} flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={selected ? titleColor : 'whiteBright'}>{ui(title)}</Text>
        {badge ? <Text color="gray">{ui(badge)}</Text> : null}
      </Box>
      {subtitle ? <Text color="gray">{ui(subtitle)}</Text> : null}
      {lines.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {lines.map((line, index) => (
            <Text key={`${title}-${index}`}>{ui(line)}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export function CliApp({ api, preferences }: AppProps) {
  const { exit } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [home, setHome] = useState<HomePayload | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentCommand, setCurrentCommand] = useState<CommandId | 'home'>('home');
  const [currentResult, setCurrentResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandMode, setCommandMode] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [status, setStatus] = useState('Hazır');
  const [loginSummary, setLoginSummary] = useState<LoginDebugSummary | null>(null);
  const [activeRegion, setActiveRegion] = useState<ActiveRegion>('grid');
  const [railMode, setRailMode] = useState<RailMode>('activity');
  const [buddyInput, setBuddyInput] = useState('');
  const [buddyHistory, setBuddyHistory] = useState<BuddyMessage[]>([]);
  const [activityLines, setActivityLines] = useState<string[]>([]);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [errorSource, setErrorSource] = useState<ErrorSource>('command');

  const deferredBuddyHistory = useDeferredValue(buddyHistory);
  const cards = buildCardState(home);
  const selectedCard = cards[selectedIndex] || cards[0];
  const columns = process.stdout.columns || 120;
  const narrow = columns < 120;
  const cardColumns = chunkCards(cards, narrow ? 1 : 2);
  const displayedBuddyHistory = deferredBuddyHistory.length > 0 ? deferredBuddyHistory : [getBuddyWelcomeMessage()];
  const detailCommand = currentCommand === 'home' ? selectedCard?.id : currentCommand;
  const detailResult = currentCommand === 'home' && selectedCard
    ? buildDetailResult(home, selectedCard.id)
    : currentResult;
  const detailTitle = currentCommand === 'home'
    ? selectedCard?.title || 'Detay'
    : getCommandDefinition(currentCommand)?.description || currentCommand;

  const refreshLoginSummary = async () => {
    setLoginSummary(await readLatestLoginDebugSummary());
  };

  const refreshActivity = async () => {
    const events = await readRecentMemoryEvents(2);
    setActivityLines(events.slice(-8).reverse().map(formatActivityEvent));
  };

  const syncPinnedDetail = (nextHome: HomePayload, nextCommand: CommandId | 'home') => {
    if (nextCommand === 'home') {
      setCurrentResult(null);
      return;
    }

    if (nextCommand === 'gundem' || nextCommand === 'bugun' || nextCommand === 'odev' || nextCommand === 'sinav' || nextCommand === 'duyurular' || nextCommand === 'yemekhane') {
      setCurrentResult(buildDetailResult(nextHome, nextCommand));
    }
  };

  const loadHome = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const payload = await loadHomeSnapshot(api, forceRefresh);
      startTransition(() => {
        setHome(payload);
        setProfile(payload.profile);
        setHasStoredSession(true);
        syncPinnedDetail(payload, currentCommand);
      });
      setError(null);
      setErrorSource('command');
      setStatus(forceRefresh ? 'Sert yenileme tamamlandı' : 'Dashboard güncel');
      await writePreferences({
        ...preferences,
        onboardingSeen: true,
        lastView: currentCommand === 'home' ? null : currentCommand,
      });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setProfile(null);
        setHome(null);
        setHasStoredSession(false);
        setCurrentCommand('home');
        setCurrentResult(null);
        setStatus('Giriş gerekli');
        setError(null);
        setErrorSource('auth');
        await refreshLoginSummary();
      } else {
        setHasStoredSession(await api.hasSession().catch(() => false));
        setError(err instanceof Error ? err.message : 'Veri yüklenemedi.');
        setErrorSource('home');
        setStatus('Sorun var');
      }
    } finally {
      setLoading(false);
      await refreshActivity().catch(() => undefined);
    }
  };

  const submitBuddy = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || buddyLoading) {
      return;
    }

    const userMessage = createBuddyMessage('user', trimmed);
    const optimisticHistory = trimBuddyHistory([...buddyHistory, userMessage]);
    startTransition(() => setBuddyHistory(optimisticHistory));
    await persistBuddyHistory(optimisticHistory).catch(() => undefined);
    setBuddyInput('');
    setBuddyLoading(true);
    setRailMode('buddy');
    setActiveRegion('rail');
    setStatus('Buddy yazıyor');

    try {
      const reply = await api.sendBuddyMessage(trimmed, optimisticHistory);
      const assistantMessage = createBuddyMessage('assistant', reply.response, reply.timestamp);
      const nextHistory = trimBuddyHistory([...optimisticHistory, assistantMessage]);
      startTransition(() => setBuddyHistory(nextHistory));
      await persistBuddyHistory(nextHistory).catch(() => undefined);
      setError(null);
      setErrorSource('command');
      setStatus('Buddy hazır');
    } catch (err) {
      const assistantMessage = createBuddyMessage(
        'assistant',
        err instanceof Error ? err.message : 'Buddy geçici olarak yanıt veremedi.',
      );
      const nextHistory = trimBuddyHistory([...optimisticHistory, assistantMessage]);
      startTransition(() => setBuddyHistory(nextHistory));
      await persistBuddyHistory(nextHistory).catch(() => undefined);
      setError(err instanceof Error ? err.message : 'Buddy hatası');
      setErrorSource('buddy');
      setStatus('Buddy sorunu');
    } finally {
      setBuddyLoading(false);
      await refreshActivity().catch(() => undefined);
    }
  };

  const openCommand = async (id: CommandId, args: Record<string, string | boolean> = {}) => {
    if (id === 'buddy') {
      const message = typeof args.message === 'string' ? args.message : '';
      if (message.trim()) {
        await submitBuddy(message);
      } else {
        setRailMode((current) => (current === 'buddy' ? 'activity' : 'buddy'));
        setActiveRegion('rail');
      }
      return;
    }

    if (id === 'gundem' || id === 'bugun' || id === 'odev' || id === 'sinav' || id === 'duyurular' || id === 'yemekhane') {
      setCurrentCommand(id);
      setCurrentResult(buildDetailResult(home, id));
      setActiveRegion('detail');
      setStatus(`${id} açıldı`);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorSource('command');
    try {
      const result = id === 'login'
        ? {
            kind: 'profile' as const,
            data: await loginWithBrowser(api, {
              debug: args.debug === true,
              noOpen: args['no-open'] === true,
              renderUi: false,
              print: (line) => setStatus(line),
            }),
          }
        : await runCommand(api, id, args);

      if (id === 'logout') {
        setProfile(null);
        setHome(null);
        setHasStoredSession(false);
        setCurrentCommand('home');
        setCurrentResult(null);
      } else if ((id === 'whoami' || id === 'login') && result.kind === 'profile') {
        setProfile(result.data);
        setHasStoredSession(true);
        setCurrentCommand(id);
        setCurrentResult(result);
      } else {
        setCurrentCommand(id);
        setCurrentResult(result);
      }

      if (id === 'login') {
        await refreshLoginSummary();
        await loadHome(true);
      }

      if (id === 'logout') {
        await refreshLoginSummary();
      }

      setStatus(id === 'login' ? 'Bağlandı' : 'Hazır');
      setActiveRegion('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komut çalışmadı.');
      setErrorSource(id === 'login' ? 'auth' : 'command');
      setStatus('Sorun var');
      await refreshLoginSummary();
    } finally {
      setLoading(false);
      await refreshActivity().catch(() => undefined);
    }
  };

  const submitPalette = async () => {
    const parsed = parseCommand(commandInput.trim().split(/\s+/).filter(Boolean));
    if (!parsed) {
      setCommandMode(false);
      setCommandInput('');
      return;
    }
    if (!parsed.ok) {
      setError(parsed.suggestion ? `${parsed.error}. Sanırım: ${parsed.suggestion}` : parsed.error);
      setErrorSource('command');
      setStatus('Sorun var');
      setCommandMode(false);
      setCommandInput('');
      return;
    }

    setCommandMode(false);
    setCommandInput('');
    if (parsed.command.id === 'help') {
      setShowHelp(true);
      return;
    }
    if (parsed.command.id === 'watch') {
      setError('`watch` komutunu TUI dışında, doğrudan terminalde çalıştır.');
      setErrorSource('command');
      setStatus('Sorun var');
      return;
    }
    if (parsed.command.id === 'update') {
      setError('`update` komutunu TUI dışında, doğrudan terminalde çalıştır.');
      setErrorSource('command');
      setStatus('Sorun var');
      return;
    }
    await openCommand(parsed.command.id, parsed.command.args);
  };

  useEffect(() => {
    api.hasSession()
      .then((value) => setHasStoredSession(value))
      .catch(() => undefined);
    loadBuddyHistory()
      .then((history) => setBuddyHistory(history))
      .catch(() => undefined);
    loadHome().catch(() => undefined);
    refreshLoginSummary().catch(() => undefined);
    refreshActivity().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (hasStoredSession) {
        loadHome(false).catch(() => undefined);
      }
    }, HOME_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [hasStoredSession, currentCommand]);

  const cycleRegion = () => {
    setActiveRegion((current) => {
      if (current === 'grid') return 'detail';
      if (current === 'detail') return 'rail';
      return 'grid';
    });
  };

  const isBuddyComposerActive = railMode === 'buddy' && activeRegion === 'rail' && !commandMode && !showHelp;

  useInput((input, key) => {
    if (commandMode) {
      if (key.escape) {
        setCommandMode(false);
        setCommandInput('');
      }
      return;
    }

    if (isBuddyComposerActive) {
      if (key.escape) {
        setActiveRegion('detail');
      }
      return;
    }

    if (showHelp) {
      if (input === '?' || key.escape || input === 'q') {
        setShowHelp(false);
      }
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (input === '?') {
      setShowHelp(true);
      return;
    }

    if (input === '/') {
      setCommandMode(true);
      setCommandInput('');
      return;
    }

    if (input === 'b') {
      setRailMode((current) => (current === 'buddy' ? 'activity' : 'buddy'));
      setActiveRegion('rail');
      return;
    }

    if (key.tab) {
      cycleRegion();
      return;
    }

    if (input === 'r') {
      if (hasStoredSession) {
        loadHome(true).catch(() => undefined);
      }
      return;
    }

    if (input === 'h' || key.leftArrow) {
      setCurrentCommand('home');
      setCurrentResult(null);
      setActiveRegion('grid');
      return;
    }

    if (activeRegion === 'grid') {
      if (input === 'j' || key.downArrow) {
        setSelectedIndex((current) => (current + 1) % cards.length);
        return;
      }
      if (input === 'k' || key.upArrow) {
        setSelectedIndex((current) => (current - 1 + cards.length) % cards.length);
        return;
      }
      if (key.return && selectedCard) {
        openCommand(selectedCard.id).catch(() => undefined);
      }
      return;
    }

    if (activeRegion === 'detail' && key.return && selectedCard) {
      openCommand(selectedCard.id).catch(() => undefined);
    }
  });

  const identityLabel = getIdentityLabel(profile, hasStoredSession);
  const syncLine = home
    ? `Synced ${formatTime(home.syncedAt)} • Duyuru cache ${home.freshness.announcements.cached ? 'on' : 'off'} • Stale ${home.freshness.announcements.stale ? 'on' : 'off'}`
    : hasStoredSession
      ? 'Oturum var • home snapshot bekleniyor'
      : 'Home snapshot bekleniyor';
  const commandLine = currentCommand === 'home'
    ? `Detay: ${selectedCard?.title || '-'}`
    : `Pimli detay: ${detailTitle}`;

  const renderAnonymousHome = () => {
    const connectionLines = hasStoredSession
      ? [
          'r ile dashboard yeniden dene',
          'aasistan whoami',
          'aasistan gundem',
          'aasistan watch',
        ]
      : [
          'aasistan login',
          'aasistan login --no-open',
          'aasistan login --debug',
          'aasistan whoami',
        ];

    if (loginSummary?.lastUrl) {
      connectionLines.push(`Son bağlantı: ${loginSummary.lastUrl}`);
    }
    if (loginSummary?.lastCode) {
      connectionLines.push(`Son cihaz kodu: ${loginSummary.lastCode}`);
    }
    if (loginSummary?.logPath) {
      connectionLines.push(`Debug logu: ${loginSummary.logPath}`);
    }

    return (
        <Panel
        title={hasStoredSession ? 'Oturum açık' : 'Bağlan'}
        subtitle={hasStoredSession ? 'Kimlik doğrulama duruyor, ama dashboard şu anda alınamadı.' : 'Tarayıcı login bağlantısı terminale yazdırılır.'}
        badge={hasStoredSession ? 'retry' : 'login'}
        borderColor={hasStoredSession ? 'yellow' : 'green'}
        titleColor={hasStoredSession ? 'yellowBright' : 'greenBright'}
        selected={activeRegion === 'grid'}
        lines={connectionLines}
      />
    );
  };

  const renderGrid = () => {
    if (!profile) {
      return renderAnonymousHome();
    }

    return (
      <Box flexDirection={narrow ? 'column' : 'row'}>
        {cardColumns.map((columnCards, columnIndex) => (
          <Box
            key={`column-${columnIndex}`}
            flexDirection="column"
            width={narrow ? undefined : '50%'}
            marginRight={!narrow && columnIndex === 0 ? 1 : 0}
          >
            {columnCards.map((card) => (
              <Panel
                key={card.id}
                title={card.title}
                subtitle={card.subtitle}
                badge={card.badge}
                lines={card.lines}
                selected={activeRegion === 'grid' && selectedCard?.id === card.id}
                borderColor={card.tone}
                titleColor={
                  card.tone === 'cyan'
                    ? 'cyanBright'
                    : card.tone === 'green'
                      ? 'greenBright'
                      : card.tone === 'yellow'
                        ? 'yellowBright'
                        : card.tone === 'magenta'
                          ? 'magentaBright'
                          : 'blueBright'
                }
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  };

  const renderDetailBody = () => {
    if (!profile) {
      const transientFailureText = getTransientFailureText(hasStoredSession);
      if (transientFailureText) {
        return <Text>{ui(transientFailureText)}</Text>;
      }

      return (
        <Text>{ui(renderOnboardingText())}</Text>
      );
    }

    if (loading && !detailResult) {
      return <Text color="yellow">{ui('Detay yükleniyor...')}</Text>;
    }

    if (!detailResult || !detailCommand || detailCommand === 'buddy') {
      return <Text>{ui('Seçili kartın detayları burada görünür.')}</Text>;
    }

    return <Text>{renderCommandResult(detailCommand, detailResult)}</Text>;
  };

  const renderRail = () => {
    if (railMode === 'buddy') {
      return (
        <Box flexDirection="column">
          <Panel
            title="Buddy"
            subtitle={buddyLoading ? 'Yanıt üretiliyor' : 'Akademik odak asistanı'}
            badge={buddyLoading ? '...' : `${displayedBuddyHistory.length}`}
            selected={activeRegion === 'rail'}
            borderColor="yellow"
            titleColor="yellowBright"
            lines={displayedBuddyHistory.slice(-8).map((message) => `${message.role === 'assistant' ? 'Buddy' : 'Sen'}: ${message.content}`)}
          />
          {activeRegion === 'rail' ? (
            <Box borderStyle="round" borderColor="yellow" paddingX={1}>
              <Text color="yellow">{ui('Buddy > ')}</Text>
              <TextInput value={buddyInput} onChange={setBuddyInput} onSubmit={submitBuddy} />
            </Box>
          ) : (
            <Text color="gray">{ui('b ile buddy aç, Tab ile odağı buraya getir, Enter ile gönder.')}</Text>
          )}
        </Box>
      );
    }

    const lines = activityLines.length > 0 ? activityLines : ['Henüz etkinlik yok.'];
    return (
      <Panel
        title="Activity"
        subtitle="Son oturum ve komut hareketleri"
        badge={`${lines.length}`}
        selected={activeRegion === 'rail'}
        borderColor="blue"
        titleColor="blueBright"
        lines={lines}
      />
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} flexDirection={narrow ? 'column' : 'row'} justifyContent="space-between">
        <Box flexDirection="column">
          <Text color="cyanBright">{ui('Akademik Asistan CLI v2')}</Text>
          <Text color="gray">{ui(`${identityLabel}`)}</Text>
          <Text color="gray">{ui(syncLine)}</Text>
          <Text color="gray">{ui(commandLine)}</Text>
        </Box>
        <Box flexDirection="column" marginTop={narrow ? 1 : 0}>
          <Text color={error ? 'redBright' : profile ? 'greenBright' : 'yellow'}>{ui(`Durum: ${status}`)}</Text>
          <Text color="gray">{ui(`Region: ${activeRegion} • Rail: ${railMode}`)}</Text>
        </Box>
      </Box>

      {showHelp ? (
        <Box marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0}>
          <Text>{renderHelpText()}</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection={narrow ? 'column' : 'row'}>
          <Box width={narrow ? undefined : '42%'} marginRight={narrow ? 0 : 1} flexDirection="column">
            <Panel
              title="Dashboard"
              subtitle="Kartlar ve kısa özetler"
              badge={selectedCard?.title || '-'}
              selected={activeRegion === 'grid'}
              borderColor="cyan"
              titleColor="cyanBright"
              lines={[]}
            />
            {renderGrid()}
          </Box>

          <Box width={narrow ? undefined : '33%'} marginRight={narrow ? 0 : 1} flexDirection="column">
            <Panel
              title={detailTitle}
              subtitle={detailCommand && detailCommand !== 'buddy' && detailCommand !== 'teacher-dashboard' && detailCommand !== 'whoami'
                ? buildFreshnessLines(home, detailCommand as HomeCard['id']).join(' • ')
                : `Synced: ${formatTime(home?.syncedAt)}`}
              badge={currentCommand === 'home' ? 'drawer' : currentCommand}
              selected={activeRegion === 'detail'}
              borderColor="magenta"
              titleColor="magentaBright"
              lines={[]}
            />
            <Box borderStyle="round" borderColor={activeRegion === 'detail' ? 'magenta' : 'gray'} paddingX={1} paddingY={0}>
              {renderDetailBody()}
            </Box>
          </Box>

          <Box width={narrow ? undefined : '25%'} flexDirection="column">
            {renderRail()}
          </Box>
        </Box>
      )}

      {loading ? (
        <Box marginTop={1}>
          <Text color="yellow">{ui('Paneller yenileniyor...')}</Text>
        </Box>
      ) : null}

      {error ? (
        <Box marginTop={1}>
          <Panel
            title={getErrorPanelTitle(errorSource)}
            subtitle={error}
            badge="hata"
            selected
            borderColor="red"
            titleColor="redBright"
            lines={getErrorPanelLines(errorSource, hasStoredSession, loginSummary, home ? formatTime(home.syncedAt) : null)}
          />
        </Box>
      ) : null}

      {commandMode ? (
        <Box marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text color="cyan">{ui('Komut > ')}</Text>
          <TextInput value={commandInput} onChange={setCommandInput} onSubmit={submitPalette} />
        </Box>
      ) : null}

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">{ui('? yardım • / komut • Tab region • b buddy • r sert yenile • h home • q çıkış')}</Text>
      </Box>
    </Box>
  );
}
