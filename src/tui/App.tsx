import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ApiClient, AuthRequiredError } from '../api/client.js';
import { executeCommand } from '../commands/execute.js';
import { parseCommand } from '../commands/registry.js';
import { loadHomeSnapshot } from '../coordinator/home.js';
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
  subtitle: string;
  badge: string;
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

function buildCardState(home: HomeState): HomeCard[] {
  return [
    {
      id: 'gundem',
      title: 'Gundem',
      subtitle: home.gundem?.summary.label || 'Yaklasan kayit yok',
      badge: home.gundem?.items[0]?.badge || '-',
    },
    {
      id: 'bugun',
      title: 'Bugun',
      subtitle: home.bugun?.summary.label || 'Bugun sakin',
      badge: String(home.bugun?.items.length || 0),
    },
    {
      id: 'odev',
      title: 'Odevler',
      subtitle: home.odev?.summary.label || 'Teslim yok',
      badge: String(home.odev?.items.length || 0),
    },
    {
      id: 'sinav',
      title: 'Sinavlar',
      subtitle: home.sinav?.summary.label || 'Sinav yok',
      badge: String(home.sinav?.items.length || 0),
    },
    {
      id: 'duyurular',
      title: 'Duyurular',
      subtitle: home.duyurular?.items[0]?.title || 'Yeni duyuru yok',
      badge: String(home.duyurular?.count || 0),
    },
    {
      id: 'yemekhane',
      title: 'Yemekhane',
      subtitle: home.yemekhane?.menu?.items[0] || 'Menu yok',
      badge: home.yemekhane?.targetDate || '-',
    },
  ];
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
  const [status, setStatus] = useState<string>('hazir');

  const cards = useMemo(() => buildCardState(home), [home]);
  const selectedCard = cards[selectedIndex] || cards[0];

  const markOnboardingSeen = async () => {
    if (preferences.onboardingSeen) return;
    await writePreferences({ ...preferences, onboardingSeen: true });
  };

  const loadHome = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentProfile = await api.getProfile();
      setProfile(currentProfile);
      const snapshot = await loadHomeSnapshot(api);
      setHome(snapshot);
      setStatus(`guncel • ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
      await writePreferences({ ...preferences, onboardingSeen: true, lastView: currentCommand === 'home' ? null : currentCommand });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setProfile(null);
        setHome({});
        setError(null);
        setStatus('login gerekli');
      } else {
        setError(err instanceof Error ? err.message : 'Veri yuklenemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    markOnboardingSeen().catch(() => undefined);
    loadHome().catch(() => undefined);
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
      const result = await runCommand(api, id, args);
      if (id === 'whoami' && result.kind === 'profile') {
        setProfile(result.data);
      }
      if (id === 'login') {
        await loadHome();
      }
      if (id === 'logout') {
        setProfile(null);
        setHome({});
      }
      setCurrentCommand(id);
      setCurrentResult(result);
      setStatus(id === 'login' ? 'baglandi' : 'hazir');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Komut calismadi.');
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
      setError(parsed.suggestion ? `${parsed.error}. Sanirim: ${parsed.suggestion}` : parsed.error);
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
      setError('`watch` komutunu TUI disinda, dogrudan terminalde calistir.');
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
      if (key.return) {
        openCommand(selectedCard.id).catch(() => undefined);
      }
      return;
    }

    if (input === 'h' || key.leftArrow) {
      setCurrentCommand('home');
      setCurrentResult(null);
    }
  });

  const headerLine = profile
    ? `${profile.fullName || profile.email || 'Kullanici'} • ${profile.role}`
    : 'Login gerekli';

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyanBright">Akademik Asistan CLI</Text>
      <Text color="gray">{headerLine}</Text>
      <Text color="gray">{status}</Text>

      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
        {!profile ? (
          <Text>{renderOnboardingText()}</Text>
        ) : currentCommand === 'home' ? (
          <>
            <Text color="whiteBright">Ana ekran</Text>
            <Text color="gray">Secili kart: {selectedCard?.title || '-'}</Text>
            <Box marginTop={1} flexDirection="column">
              {cards.map((card, index) => (
                <Box
                  key={card.id}
                  borderStyle="round"
                  borderColor={index === selectedIndex ? 'cyan' : 'gray'}
                  marginBottom={1}
                  paddingX={1}
                  paddingY={0}
                  flexDirection="column"
                >
                  <Text color={index === selectedIndex ? 'cyanBright' : 'white'}>{card.title} • {card.badge}</Text>
                  <Text color="gray">{card.subtitle}</Text>
                </Box>
              ))}
            </Box>
          </>
        ) : loading ? (
          <Text>Yukleniyor...</Text>
        ) : (
          <Text>{currentResult ? renderCommandResult(currentCommand, currentResult) : 'Kayit yok.'}</Text>
        )}
      </Box>

      {loading && currentCommand === 'home' ? (
        <Box marginTop={1}>
          <Text color="yellow">Kartlar guncelleniyor...</Text>
        </Box>
      ) : null}

      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}

      {showHelp ? (
        <Box marginTop={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text>{renderHelpText()}</Text>
        </Box>
      ) : null}

      {commandMode ? (
        <Box marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text color="cyan">/ </Text>
          <TextInput value={commandInput} onChange={setCommandInput} onSubmit={submitPalette} />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color="gray">? yardim • / komut • q cikis • r yenile • h ana ekran</Text>
      </Box>
    </Box>
  );
}
