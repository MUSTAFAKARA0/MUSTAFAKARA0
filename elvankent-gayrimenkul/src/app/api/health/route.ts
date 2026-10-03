import { isSupabaseConfigured } from '@/lib/env';
import { createAnonClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Uptime izleme (UptimeRobot, Better Stack, Vercel Checks...).
 * 200 → uygulama ve veritabanı erişilebilir; 503 → veritabanına ulaşılamıyor.
 * Gizli bilgi veya sürüm ayrıntısı döndürmez.
 */
export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'error' = 'error';
  if (isSupabaseConfigured()) {
    try {
      const client = createAnonClient();
      const { error } = await client.from('organizations').select('id', { head: true, count: 'exact' }).limit(1).abortSignal(AbortSignal.timeout(3000));
      db = error ? 'error' : 'ok';
    } catch {
      db = 'error';
    }
  }
  const ok = db === 'ok';
  return Response.json(
    { status: ok ? 'ok' : 'degraded', db, latencyMs: Date.now() - started, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
