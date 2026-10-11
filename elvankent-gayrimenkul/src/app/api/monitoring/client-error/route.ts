import { z } from 'zod';
import { getRequestFingerprint } from '@/lib/request';
import { reportError } from '@/modules/monitoring/report';

/**
 * Tarayıcıdaki beklenmeyen hatalar (instrumentation-client.ts ve hata sınırları)
 * buraya gönderilir. Veritabanına yazılmaz; loglanır ve yapılandırılmışsa
 * Sentry / webhook'a iletilir. Kötüye kullanıma karşı: boyut sınırı, alan
 * doğrulama, aynı kaynaktan istek ve IP özeti başına dakikada 20 rapor.
 */
const schema = z.object({
  message: z.string().max(1000),
  name: z.string().max(100).optional(),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(500).optional(),
  source: z.enum(['window', 'promise', 'boundary']).optional(),
});

const hits = new Map<string, { count: number; start: number }>();
function limited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > 60_000) {
    if (hits.size > 5000) hits.clear();
    hits.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 8000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { ipHash } = await getRequestFingerprint();
  if (limited(ipHash)) return new Response(null, { status: 429 });
  await reportError({ kind: 'client', ...parsed.data });
  return new Response(null, { status: 204 });
}
