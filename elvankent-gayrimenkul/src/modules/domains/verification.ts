import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { serverEnv } from '@/lib/server-env';

/**
 * Alan adı doğrulama kodu (TXT değeri). Veritabanına yazılmaz: kod sunucu anahtarıyla
 * HMAC(alan adı kimliği | kiracı | hostname | nonce) olarak üretilir, veritabanında yalnızca
 * SHA-256 özeti ve rastgele nonce tutulur. Böylece:
 *   • kod ekranda tekrar gösterilebilir (sunucu yeniden üretir), ama veritabanı sızıntısı kodu vermez;
 *   • bir alan adının / kiracının kodu başka bir alan adını / kiracıyı doğrulayamaz;
 *   • "yeni kod" nonce'u değiştirir → eski kod hemen geçersiz olur.
 * Anahtar, sunucunun diğer imzalarıyla (oturum alanı, önizleme) aynı kaynaktan ve ayrı bağlamla.
 */
const PREFIX = 'karay-site-verification=';

function key(): string | null {
  return serverEnv.supabaseServiceRoleKey || serverEnv.ipHashSalt || null;
}

export function hashVerificationValue(value: string): string {
  return createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

export function verificationValue(input: { id: string; orgId: string; hostname: string; nonce: string }): string | null {
  const k = key();
  if (!k) return null;
  const mac = createHmac('sha256', k).update(`eg-domain-verify|${input.id}|${input.orgId}|${input.hostname}|${input.nonce}`).digest('base64url');
  return `${PREFIX}${mac}`;
}

export function newVerification(input: { id: string; orgId: string; hostname: string }): { nonce: string; value: string; hash: string } | null {
  const nonce = randomBytes(16).toString('hex');
  const value = verificationValue({ ...input, nonce });
  return value ? { nonce, value, hash: hashVerificationValue(value) } : null;
}
