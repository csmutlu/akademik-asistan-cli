import React from 'react';
import { Box, Text, useInput } from 'ink';
import { ui } from '../display.js';

export type LoginStage =
  | 'creating'
  | 'opening'
  | 'waiting'
  | 'approving'
  | 'redeeming'
  | 'success'
  | 'error'
  | 'cancelled';

export type LoginScreenState = {
  stage: LoginStage;
  loginUrl: string | null;
  userCode: string | null;
  requestId: string | null;
  expiresAt: string | null;
  remainingSeconds: number | null;
  statusMessage: string;
  error: string | null;
  debugEnabled: boolean;
  logPath: string | null;
  attempts: number;
  approvedAt?: string | null;
};

type LoginScreenProps = {
  state: LoginScreenState;
  onOpen: () => void;
  onCancel: () => void;
};

function formatRemaining(seconds: number | null): string {
  if (seconds === null) {
    return '-';
  }
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function toneForStage(stage: LoginStage): 'cyan' | 'yellow' | 'green' | 'red' | 'magenta' {
  if (stage === 'success') return 'green';
  if (stage === 'error' || stage === 'cancelled') return 'red';
  if (stage === 'redeeming' || stage === 'approving') return 'magenta';
  if (stage === 'opening') return 'yellow';
  return 'cyan';
}

function titleForStage(stage: LoginStage): string {
  switch (stage) {
    case 'creating':
      return 'İstek hazırlanıyor';
    case 'opening':
      return 'Tarayıcı açılıyor';
    case 'waiting':
      return 'Web onayı bekleniyor';
    case 'approving':
      return 'Tarayıcı onayı alındı';
    case 'redeeming':
      return 'Oturum alınıyor';
    case 'success':
      return 'CLI oturumu bağlandı';
    case 'cancelled':
      return 'Giriş iptal edildi';
    case 'error':
    default:
      return 'Giriş tamamlanamadı';
  }
}

function Frame({
  title,
  subtitle,
  children,
  color = 'gray',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  color?: 'gray' | 'cyan' | 'yellow' | 'green' | 'red' | 'magenta';
}) {
  return (
    <Box borderStyle="round" borderColor={color} paddingX={1} paddingY={0} marginBottom={1} flexDirection="column">
      <Text color={`${color}Bright`}>{ui(title)}</Text>
      {subtitle ? <Text color="gray">{ui(subtitle)}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

export function LoginScreen({ state, onOpen, onCancel }: LoginScreenProps) {
  useInput((input) => {
    if (input === 'o' && state.loginUrl) {
      onOpen();
    }
    if (input === 'q') {
      onCancel();
    }
  });

  const tone = toneForStage(state.stage);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor={tone} paddingX={1} paddingY={0} justifyContent="space-between">
        <Box flexDirection="column">
          <Text color={`${tone}Bright`}>{ui('Akademik Asistan CLI Login')}</Text>
          <Text color="gray">{ui('Worker domaini tabanlı cihaz onayı')}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="whiteBright">{ui(titleForStage(state.stage))}</Text>
          <Text color={tone}>{ui(state.statusMessage)}</Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection={process.stdout.columns && process.stdout.columns < 112 ? 'column' : 'row'}>
        <Box flexDirection="column" width={process.stdout.columns && process.stdout.columns < 112 ? undefined : '58%'} marginRight={process.stdout.columns && process.stdout.columns < 112 ? 0 : 1}>
          <Frame title="Bağlantı" subtitle="Tarayıcıdan açılacak doğrulama bağlantısı" color="cyan">
            <Text>{ui(state.loginUrl || 'Henüz oluşturulmadı')}</Text>
          </Frame>

          <Frame title="Cihaz Kodu" subtitle="Web sayfasında bu kodu girerek bağlayabilirsiniz" color="yellow">
            <Text>{ui(state.userCode || 'Hazırlanıyor')}</Text>
          </Frame>

          <Frame title="Durum Akışı" subtitle="CLI her 3 saniyede bir sonucu sorgular" color={tone}>
            <Text>{ui(`İstek: ${state.requestId || '-'}`)}</Text>
            <Text>{ui(`Kalan süre: ${formatRemaining(state.remainingSeconds)}`)}</Text>
            <Text>{ui(`Poll denemesi: ${String(state.attempts)}`)}</Text>
            {state.approvedAt ? <Text>{ui(`Onay zamanı: ${state.approvedAt}`)}</Text> : null}
          </Frame>
        </Box>

        <Box flexDirection="column" width={process.stdout.columns && process.stdout.columns < 112 ? undefined : '42%'}>
          <Frame title="Notlar" subtitle="Bu ekran tarayıcıyı ve worker yanıtını koordine eder" color="magenta">
            <Text>{ui('o: bağlantıyı yeniden aç')}</Text>
            <Text>{ui('q: isteği iptal et ve çık')}</Text>
            <Text>{ui('Tarayıcıda giriş açıksa tek tık onay yeterli')}</Text>
          </Frame>

          <Frame title="Debug" subtitle={state.debugEnabled ? 'Ayrıntılı günlük açık' : 'Standart görünüm'} color="gray">
            <Text>{ui(`Log yolu: ${state.logPath || '-'}`)}</Text>
            {state.error ? <Text color="redBright">{ui(`Son hata: ${state.error}`)}</Text> : <Text>{ui('Son hata yok')}</Text>}
          </Frame>
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">{ui('o bağlantıyı aç • q iptal et • başarı sonrası ekran otomatik kapanır')}</Text>
      </Box>
    </Box>
  );
}
