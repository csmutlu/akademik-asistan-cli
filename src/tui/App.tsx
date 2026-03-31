import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ApiClient, AuthRequiredError } from '../api/client.js';
import { loginWithBrowser } from '../auth/login.js';
import { executeCommand } from '../commands/execute.js';
import { getCommandDefinition, parseCommand } from '../commands/registry.js';
import { loadHomeSnapshot } from '../coordinator/home.js';
import { ui } from '../display.js';
import { readLatestLoginDebugSummary, type LoginDebugSummary } from '../logging/login-debug.js';
import { renderCommandResult, renderHelpText, renderOnboardingText } from '../presenters/text.js';
import { writePreferences } from '../state/storage.js';
import type {
  AgendaPayload,
  AnnouncementsPayload,
  CafeteriaPayload,
  CommandId,
  CommandResult,
  ParsedCommand,
  Profile,
  StoredPreferences,
} from '../types.js';

type HomeCard = {
  id: CommandId;
  title: string;
  badge: string;
  subtitle: string;
  lines: string[];
};

type HomeState = {
  gundem?: AgendaPayload;
  bugun?: AgendaPayload;
  odev?: AgendaPayload;
  sinav?: AgendaPayload;
  duyurular?: AnnouncementsPayload;
  yemekhane?: CafeteriaPayload;
};

type AppProps = {
  api: ApiClient;
  preferences: StoredPreferences;
};

function agendaLines(payload?: AgendaPayload, emptyText = 'Yeni kayıt yok'): string[] {
  if (!payload || payload.items.length === 0) {
    return [emptyText];
  }

  return payload.items.slice(0, 2).map((item) => `${item.title} • ${item.badge}`);
}

function announcementsLines(payload?: AnnouncementsPayload): string[] {
  if (!payload || payload.items.length === 0) {
    return ['Yeni duyuru görünmüyor.'];
  }

  return payload.items.slice(0, 2).map((item) => `${item.title} • ${item.date}`);
}

function cafeteriaLines(payload?: CafeteriaPayload): string[] {
  if (!payload?.menu?.items.length) {
    return ['Bugün için menü bulunamadı.'];
  }

  return payload.menu.items.slice(0, 3);
}

function buildCardState(home: HomeState): HomeCard[] {
  return [
    {
      id: 'gundem',
      title: 'Gündem',
      badge: home.gundem ? String(home.gundem.items.length) : '-',
      subtitle: home.gundem?.summary.label || 'Yaklaşan kayıt yok',
      lines: agendaLines(home.gundem, 'Yakın tarihte yeni kayıt görünmüyor.'),
    },
    {
      id: 'bugun',
      title: 'Bugün',
      badge: home.bugun ? String(home.bugun.items.length) : '-',
      subtitle: home.bugun?.summary.label || 'Bugün sakin',
      lines: agendaLines(home.bugun, 'Bugün planlanan ders veya teslim görünmüyor.'),
    },
    {
      id: 'odev',
      title: 'Ödevler',
      badge: home.odev ? String(home.odev.items.length) : '-',
      subtitle: home.odev?.summary.label || 'Teslim görünmüyor',
      lines: agendaLines(home.odev, 'Yaklaşan ödev görünmüyor.'),
    },
    {
      id: 'sinav',
      title: 'Sınavlar',
      badge: home.sinav ? String(home.sinav.items.length) : '-',
      subtitle: home.sinav?.summary.label || 'Sınav görünmüyor',
      lines: agendaLines(home.sinav, 'Yaklaşan sınav görünmüyor.'),
    },
    {
      id: 'duyurular',
      title: 'Duyurular',
      badge: home.duyurular ? String(home.duyurular.count) : '-',
      subtitle: home.duyurular?.items[0]?.title || 'Yeni duyuru yok',
      lines: announcementsLines(home.duyurular),
    },
    {
      id: 'yemekhane',
      title: 'Yemekhane',
      badge: home.yemekhane?.targetDate || '-',
      subtitle: home.yemekhane?.menu?.items[0] || 'Menü hazır değil',
      lines: cafeteriaLines(home.yemekhane),
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

type PanelProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  lines?: string[];
  selected?: boolean;
  tone?: 'cyan' | 'green' | 'yellow' | 'magenta' | 'red' | 'blue';
};

function Panel({ title, subtitle, badge, lines = [], selected = false, tone = 'cyan' }: PanelProps) {
  const borderColor = selected ? tone : 'gray';
  const titleColor = selected ? `${tone}Bright` : 'whiteBright';

  return (
    <Box borderStyle="round" borderColor={borderColor} paddingX={1} paddingY={0} marginBottom={1} flexDirection="column">
      <Box justifyContent="space-between">
        <Text color={titleColor}>{ui(title)}</Text>
        {badge ? <Text color="gray">{ui(badge)}</Text> : null}
      </Box>
      {subtitle ? <Text color="gray">{ui(subtitle)}</Text> : null}
      {lines.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {lines.map((line, index) => (
            <Text key={`${title}-${index}`}>{ui(line)}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
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

export function CliApp({ api, preferences }: AppProps) {
  const { exit } = useApp();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [home, setHome] = useState<HomeState>({});
  const [currentCommand, setCurrentCommand] = useState<CommandId | 'home'>('home');
  const [currentResult, setCurrentResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandMode, setCommandMode] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [status, setStatus] = useState<string>('Hazır');
  const [loginSummary, setLoginSummary] = useState<LoginDebugSummary | null>(null);

  const cards = useMemo(() => buildCardState(home), [home]);
  const selectedCard = cards[selectedIndex] || cards[0];
  const columns = process.stdout.columns || 100;
  const narrow = columns < 104;
  const cardColumns = chunkCards(cards, narrow ? 1 : 2);

  const refreshLoginSummary = async () => {
    setLoginSummary(await readLatestLoginDebugSummary());
  };

  const loadHome = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentProfile = await api.getProfile();
      setProfile(currentProfile);
      const snapshot = await loadHomeSnapshot(api);
      setHome(snapshot);
      setStatus(`Güncel • ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
      await writePreferences({
        ...preferences,
        onboardingSeen: true,
        lastView: currentCommand === 'home' ? null : currentCommand,
      });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setProfile(null);
        setHome({});
        setError(null);
        setStatus('Giriş gerekli');
        await refreshLoginSummary();
      } else {
        setError(err instanceof Error ? err.message : 'Veri yüklenemedi.');
        setStatus('Sorun var');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHome().catch(() => undefined);
    refreshLoginSummary().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentCommand === 'home') {
        loadHome().catch(() => undefined);
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, [currentCommand]);

  const openCommand = async (id: CommandId, args: Record<string, string | boolean> = {}) => {
    setLoading(true);
    setError(null);
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
      if (id === 'whoami' && result.kind === 'profile') {
        setProfile(result.data);
      }
      if (id === 'login') {
        await refreshLoginSummary();
        await loadHome();
      }
      if (id === 'logout') {
        setProfile(null);
        setHome({});
        await refreshLoginSummary();
      }
      setCurrentCommand(id);
      setCurrentResult(result);
      setStatus(id === 'login' ? 'Bağlandı' : 'Hazır');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komut çalışmadı.');
      setStatus('Sorun var');
      await refreshLoginSummary();
    } finally {
      setLoading(false);
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
      setStatus('Sorun var');
      return;
    }
    await openCommand(parsed.command.id, parsed.command.args);
  };

  useInput((input, key) => {
    if (commandMode) {
      if (key.escape) {
        setCommandMode(false);
        setCommandInput('');
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

    if (input === 'r') {
      if (currentCommand === 'home') {
        loadHome().catch(() => undefined);
      } else {
        openCommand(currentCommand).catch(() => undefined);
      }
      return;
    }

    if (currentCommand === 'home') {
      if (input === 'j' || key.downArrow || key.tab) {
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

    if (input === 'h' || key.leftArrow) {
      setCurrentCommand('home');
      setCurrentResult(null);
    }
  });

  const identityLabel = profile
    ? `${profile.fullName || profile.email || 'Kullanıcı'} • ${profile.role}`
    : 'Bağlanmamış oturum';

  const renderHomeScreen = () => {
    if (!profile) {
      const connectionLines = [
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
      if (loginSummary?.lastRequestId) {
        connectionLines.push(`Son istek: ${loginSummary.lastRequestId}`);
      }
      if (loginSummary?.logPath) {
        connectionLines.push(`Debug logu: ${loginSummary.logPath}`);
      }

      const learnLines = renderOnboardingText().split('\n').filter(Boolean);

      return (
        <Box marginTop={1} flexDirection={narrow ? 'column' : 'row'}>
          <Box flexDirection="column" width={narrow ? undefined : '50%'} marginRight={narrow ? 0 : 1}>
            <Panel
              title="Bağlan"
              subtitle="Tarayıcı login bağlantısı her zaman terminale yazdırılır."
              badge="login"
              tone="green"
              lines={connectionLines}
              selected
            />
          </Box>
          <Box flexDirection="column" width={narrow ? undefined : '50%'}>
            <Panel
              title="Nasıl kullanılır"
              subtitle="İlk akış ve slash komutları"
              badge="yardım"
              tone="blue"
              lines={learnLines}
            />
          </Box>
        </Box>
      );
    }

    return (
      <Box marginTop={1} flexDirection={narrow ? 'column' : 'row'}>
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
                badge={card.badge}
                subtitle={card.subtitle}
                lines={card.lines}
                selected={selectedCard?.id === card.id}
                tone={selectedCard?.id === card.id ? 'cyan' : 'blue'}
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  };

  const renderResultScreen = () => {
    const title = currentCommand === 'home'
      ? 'Ana ekran'
      : getCommandDefinition(currentCommand)?.description || currentCommand;

    return (
      <Box marginTop={1} flexDirection="column">
        <Panel
          title={title}
          subtitle={currentCommand === 'home' ? 'Genel görünüm' : 'Ayrıntılı çıktı'}
          badge={currentCommand === 'home' ? 'home' : currentCommand}
          tone="magenta"
          lines={[]}
          selected
        />
        <Box borderStyle="round" borderColor="gray" paddingX={1} paddingY={0}>
          <Text>
            {loading
              ? ui('Yükleniyor...')
              : currentResult && currentCommand !== 'home'
                ? renderCommandResult(currentCommand, currentResult)
                : ui('Henüz veri yok.')}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} flexDirection={narrow ? 'column' : 'row'} justifyContent="space-between">
        <Box flexDirection="column">
          <Text color="cyanBright">{ui('Akademik Asistan CLI')}</Text>
          <Text color="gray">{ui('Sakin, hızlı ve kişisel akademik çalışma masası')}</Text>
        </Box>
        <Box flexDirection="column" marginTop={narrow ? 1 : 0}>
          <Text color="whiteBright">{ui(identityLabel)}</Text>
          <Text color={error ? 'redBright' : profile ? 'greenBright' : 'yellow'}>{ui(`Durum: ${status}`)}</Text>
        </Box>
      </Box>

      {showHelp ? (
        <Box marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0}>
          <Text>{renderHelpText()}</Text>
        </Box>
      ) : currentCommand === 'home' ? renderHomeScreen() : renderResultScreen()}

      {loading && currentCommand === 'home' ? (
        <Box marginTop={1}>
          <Text color="yellow">{ui('Paneller yenileniyor...')}</Text>
        </Box>
      ) : null}

      {error ? (
        <Box marginTop={1} flexDirection="column">
          <Panel
            title="Durum / Sorun"
            subtitle={error}
            badge="hata"
            tone="red"
            selected
            lines={[
              loginSummary?.lastError ? `Son login hatası: ${loginSummary.lastError}` : 'Son login hatası kaydı yok.',
              loginSummary?.lastUrl ? `Son bağlantı: ${loginSummary.lastUrl}` : 'Son bağlantı kaydı yok.',
              loginSummary?.lastCode ? `Son cihaz kodu: ${loginSummary.lastCode}` : 'Son cihaz kodu kaydı yok.',
              loginSummary?.lastRequestId ? `Son istek: ${loginSummary.lastRequestId}` : 'Son istek kaydı yok.',
              loginSummary?.logPath ? `Debug logu: ${loginSummary.logPath}` : 'Debug logu henüz oluşmadı.',
            ]}
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
        <Text color="gray">{ui('? yardım • / komut • r yenile • h ana ekran • q çık')}</Text>
      </Box>
    </Box>
  );
}
