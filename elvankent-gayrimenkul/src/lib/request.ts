import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { serverEnv } from '@/lib/server-env';

/**
 * İstemci IP adresinin tuzlanmış özeti. Ham IP veritabanında saklanmaz
 * (KVKK: veri minimizasyonu); yalnızca hız sınırı ve tekrar sayım
 * engellemesi için kullanılır. Oturum özeti her gün değişir → kişi izlenemez.
 */
export async function getRequestFingerprint(): Promise<{ ipHash: string; userAgent: string; sessionHash: string }> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const userAgent = (h.get('user-agent') ?? '').slice(0, 400);
  const salt = serverEnv.ipHashSalt || 'eg-default-salt';
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 48);
  const sessionHash = createHash('sha256').update(`${salt}:${ip}:${userAgent}:${day}`).digest('hex').slice(0, 48);
  return { ipHash, userAgent, sessionHash };
}
