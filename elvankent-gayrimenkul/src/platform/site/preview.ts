import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/server-env';

/**
 * Site önizleme belirteci: taslak yapılandırmayı YALNIZCA bu belirteci taşıyan tarayıcı
 * görür. Belirteç kiracıya bağlıdır ve süreli (1 saat) HMAC imzalıdır; anahtar sunucudadır.
 * Biçim: {orgId}.{bitiş (unix sn)}.{imza}
 */
export const PREVIEW_COOKIE = 'eg_site_preview';
const TTL_SECONDS = 60 * 60;

function key(): string | null {
  return serverEnv.supabaseServiceRoleKey || serverEnv.ipHashSalt || null;
}

function sign(payload: string, k: string): string {
  return createHmac('sha256', k).update(`eg-site-preview|${payload}`).digest('base64url');
}

export function createPreviewToken(orgId: string, now = Date.now()): string | null {
  const k = key();
  if (!k) return null;
  const payload = `${orgId}.${Math.floor(now / 1000) + TTL_SECONDS}`;
  return `${payload}.${sign(payload, k)}`;
}

/** Geçerliyse kiracı kimliğini döndürür */
export function verifyPreviewToken(token: string | null | undefined, now = Date.now()): string | null {
  const k = key();
  if (!k || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [orgId, exp, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(orgId) || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  const expected = sign(`${orgId}.${exp}`, k);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  return orgId;
}

export const PREVIEW_MAX_AGE = TTL_SECONDS;
