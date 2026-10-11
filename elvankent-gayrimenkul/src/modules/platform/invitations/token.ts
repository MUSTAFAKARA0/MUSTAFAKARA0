import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Davet tokenı (P0.4). 32 bayt (256 bit) kriptografik rastgele değer, base64url (43 karakter).
 * Ham token yalnızca e-postadaki bağlantıda bulunur; veritabanına SHA-256 özeti (64 hex) yazılır
 * ve tüm doğrulama özet üzerinden yapılır. Token loglanmaz, hata mesajına ve analitiğe girmez.
 */
export const INVITATION_TOKEN_BYTES = 32;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashInvitationToken(token) };
}

/** Biçim denetimi (veritabanına gitmeden önce); geçersiz biçim "geçersiz davet" ile aynı yanıtı alır */
export function isInvitationTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

/**
 * Aktivasyon bağlantısı: token URL PARÇASINDA (#) taşınır → tarayıcı onu sunucuya, istek
 * loglarına (Vercel dâhil) ve Referer başlığına göndermez. Sayfa tokenı istemcide okuyup
 * sunucu işlemine (POST gövdesi) iletir.
 */
export const ACTIVATION_PATH = '/admin/davet';

export function invitationLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${ACTIVATION_PATH}#t=${token}`;
}
