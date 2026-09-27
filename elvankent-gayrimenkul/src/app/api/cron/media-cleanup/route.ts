import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/server-env';
import { removeMediaFiles } from '@/modules/media/server';

export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Zamanlanmış bakım (Vercel Cron, günde bir; bkz. vercel.json):
 *  1. 24 saatten eski yarım kalmış / başarısız yüklemeler: dosyaları ve kayıtları
 *     silinir (yetim dosya kalmaz).
 *  2. 2 yıldan eski denetim kayıtları temizlenir.
 * Yalnızca `Authorization: Bearer CRON_SECRET` başlığıyla çalışır.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const service = createServiceClient();
  if (!service) return Response.json({ ok: false, error: 'service_role_missing' }, { status: 500 });

  const { data: stale, error } = await service.rpc('stale_media', { p_older_than: '24 hours' });
  if (error) return Response.json({ ok: false, error: 'stale_media_failed' }, { status: 500 });

  let removed = 0;
  let deferred = 0;
  const orgs = new Set<string>();
  for (const media of stale ?? []) {
    const files = await removeMediaFiles(service, media);
    if (!files.ok) {
      deferred += 1;
      continue;
    }
    const { error: deleteError } = await service.from('media_assets').delete().eq('id', media.id);
    if (deleteError) deferred += 1;
    else {
      removed += 1;
      orgs.add(media.organization_id);
    }
  }
  for (const orgId of orgs) revalidateTag(cacheTags.properties(orgId), 'max');

  const { data: purgedAudit } = await service.rpc('purge_old_audit_logs', { p_days: 730 });

  return Response.json({ ok: true, staleMediaRemoved: removed, deferred, auditLogsPurged: purgedAudit ?? 0 });
}
