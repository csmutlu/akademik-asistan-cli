import type { LoginDebugSummary } from '../logging/login-debug.js';

export type ErrorSource = 'home' | 'command' | 'buddy' | 'auth';

export function getErrorPanelTitle(source: ErrorSource): string {
  if (source === 'home') {
    return 'Dashboard / Sorun';
  }

  if (source === 'auth') {
    return 'Giriş / Sorun';
  }

  return 'Durum / Sorun';
}

export function getErrorPanelLines(
  source: ErrorSource,
  hasStoredSession: boolean,
  loginSummary: LoginDebugSummary | null,
  syncedAt: string | null,
): string[] {
  if (source === 'home' && hasStoredSession) {
    return [
      'Oturum duruyor; sorun login değil, dashboard verisi alınamadı.',
      syncedAt ? `Son başarılı senkron: ${syncedAt}` : 'Bu oturumda başarılı senkron yok.',
      '`r` ile yeniden dene, `aasistan whoami` ile oturumu doğrula.',
    ];
  }

  return [
    loginSummary?.lastError ? `Son login hatası: ${loginSummary.lastError}` : 'Son login hatası kaydı yok.',
    loginSummary?.lastUrl ? `Son bağlantı: ${loginSummary.lastUrl}` : 'Son bağlantı kaydı yok.',
    loginSummary?.lastCode ? `Son cihaz kodu: ${loginSummary.lastCode}` : 'Son cihaz kodu kaydı yok.',
  ];
}
