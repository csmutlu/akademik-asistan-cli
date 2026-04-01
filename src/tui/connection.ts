import type { Profile } from '../types.js';

export function getIdentityLabel(profile: Profile | null, hasStoredSession: boolean): string {
  if (profile) {
    return `${profile.fullName || profile.email || 'Kullanıcı'} • ${profile.role}`;
  }

  if (hasStoredSession) {
    return 'Oturum açık • profil bekleniyor';
  }

  return 'Bağlanmamış oturum';
}

export function getTransientFailureText(hasStoredSession: boolean): string {
  if (!hasStoredSession) {
    return '';
  }

  return 'Oturum açık, ama dashboard verisi geçici olarak alınamadı. `r` ile tekrar deneyin.';
}
