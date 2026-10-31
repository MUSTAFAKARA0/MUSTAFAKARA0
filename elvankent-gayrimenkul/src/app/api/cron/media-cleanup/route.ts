import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/server-env';
import { isMissingRpc } from '@/modules/media/finalize';
import { mediaFolderOf, pathsOwnedByOrg, queueItemIsSafe, removeMediaFiles, removeMediaFolder } from '@/modules/media/server';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import type { DB } from '@/lib/supabase/server';

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

const ALLOWED_BUCKETS = new Set<string>(Object.values(MEDIA_BUCKETS));
const CLAIM_BATCH = 100;
const MAX_BATCHES = 20;

/**
 * Silme kuyruğunu boşaltır (doğrudan silinen satırların dosyaları). Yalnız depodan
 * BAŞARIYLA silinenler `media_queue_done` ile işaretlenir; kalanlar sonraki çalışmada yeniden denenir.
 * RPC yoksa (eski şema) atlanır.
 */
async function drainFileQueue(service: DB): Promise<{ skipped?: boolean; claimed: number; removed: number; failed: number; unsafe: number; error?: string }> {
  const seen = new Set<number>();
  let claimed = 0;
  let removed = 0;
  let failed = 0;
  let skipped = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await service.rpc('media_queue_claim', { p_limit: CLAIM_BATCH });
    if (error) {
      if (isMissingRpc(error, 'media_queue_claim')) return { skipped: true, claimed, removed, failed, unsafe: skipped };
      console.error('[media-cleanup] queue claim failed', { code: error.code, message: error.message });
      return { claimed, removed, failed, unsafe: skipped, error: 'queue_claim_failed' };
    }
    // Güvensiz öğeler silinmez ve done işaretlenmez (elle inceleme için kuyrukta kalır); seen kümesi döngüyü önler
    const items = (data ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      if (ALLOWED_BUCKETS.has(item.bucket) && queueItemIsSafe(item)) return true;
      seen.add(item.id);
      skipped += 1;
      console.error('[media-cleanup] unsafe queue item skipped', { id: item.id });
      return false;
    });
    if (items.length === 0) break;
    claimed += items.length;
    const byBucket = new Map<string, { id: number; path: string }[]>();
    for (const item of items) {
      seen.add(item.id);
      const list = byBucket.get(item.bucket) ?? [];
      list.push({ id: item.id, path: item.path });
      byBucket.set(item.bucket, list);
    }
    const doneIds: number[] = [];
    for (const [bucket, list] of byBucket) {
      const { error: removeError } = await service.storage.from(bucket).remove(list.map((i) => i.path));
      if (removeError) {
        failed += list.length;
        console.error('[media-cleanup] queue remove failed', { bucket, count: list.length, message: removeError.message });
      } else {
        removed += list.length;
        doneIds.push(...list.map((i) => i.id));
      }
    }
    if (doneIds.length) {
      const { error: doneError } = await service.rpc('media_queue_done', { p_ids: doneIds });
      if (doneError) console.error('[media-cleanup] queue done failed', { code: doneError.code, message: doneError.message });
    }
    if (data && data.length < CLAIM_BATCH) break;
  }
  return { claimed, removed, failed, unsafe: skipped };
}

const STRAY_BATCH = 500;
const STRAY_MAX_BATCHES = 4;

/**
 * KI-38: başıboş dosyalar (bekleyen D, `media_stray_objects`): satırın güncel tabanında olmayan 1 saatten eski
 * varyantlar ve satırı olmayan 24 saatten eski orijinaller. Yalnız kendi kurum ön ekindeki güvenli yollar silinir.
 * RPC yoksa (D uygulanmamış şema) atlanır.
 */
async function sweepStray(service: DB): Promise<{ skipped?: boolean; removed: number; failed: number; unsafe: number; error?: string }> {
  let removed = 0;
  let failed = 0;
  let unsafe = 0;
  for (let batch = 0; batch < STRAY_MAX_BATCHES; batch += 1) {
    const { data, error } = await service.rpc('media_stray_objects', { p_limit: STRAY_BATCH });
    if (error) {
      if (isMissingRpc(error, 'media_stray_objects')) return { skipped: true, removed, failed, unsafe };
      console.error('[media-cleanup] stray list failed', { code: error.code, message: error.message });
      return { removed, failed, unsafe, error: 'stray_list_failed' };
    }
    const byBucket = new Map<string, string[]>();
    for (const item of data ?? []) {
      if (!ALLOWED_BUCKETS.has(item.bucket) || !queueItemIsSafe(item)) {
        unsafe += 1;
        continue;
      }
      byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item.path]);
    }
    let progressed = false;
    for (const [bucket, paths] of byBucket) {
      const { error: removeError } = await service.storage.from(bucket).remove(paths);
      if (removeError) {
        failed += paths.length;
        console.error('[media-cleanup] stray remove failed', { bucket, count: paths.length, message: removeError.message });
      } else {
        removed += paths.length;
        progressed = true;
      }
    }
    // Liste sırasız: tam dolu değilse ya da hiçbir şey silinemediyse (sonsuz döngü yok) dur
    if (!progressed || (data ?? []).length < STRAY_BATCH) break;
  }
  return { removed, failed, unsafe };
}

/**
 * Zamanlanmış bakım (Vercel Cron, günde bir; bkz. vercel.json):
 *  1. 24 saatten eski yarım kalmış / başarısız yüklemeler: dosyaları ve kayıtları
 *     silinir (yetim dosya kalmaz).
 *  2. Silme kuyruğu boşaltılır; başıboş dosyalar (KI-38) silinir.
 *  3. 2 yıldan eski denetim kayıtları temizlenir.
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
    // Yalnız kayıtlı varyantlar değil, klasörün tamamı (yetim sürümler dahil) silinir
    const folder = mediaFolderOf(media, media.organization_id);
    if (!folder && !pathsOwnedByOrg(media, media.organization_id)) {
      console.error('[media-cleanup] stale row skipped: path outside its organization', { mediaId: media.id });
      deferred += 1;
      continue;
    }
    const files = folder ? await removeMediaFolder(service, folder) : await removeMediaFiles(service, media);
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

  const queue = await drainFileQueue(service);
  const stray = await sweepStray(service);

  const { data: purgedAudit } = await service.rpc('purge_old_audit_logs', { p_days: 730 });

  return Response.json({ ok: true, staleMediaRemoved: removed, deferred, auditLogsPurged: purgedAudit ?? 0, queue, stray });
}
