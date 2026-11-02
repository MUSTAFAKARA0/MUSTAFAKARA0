import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/server-env';
import { isMissingRpc } from '@/modules/media/finalize';
import { mediaFolderOf, pathsOwnedByOrg, queueItemIsSafe, removeMediaFiles, removeMediaFolder } from '@/modules/media/server';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import { sweepStray, type StraySweepDeps } from '@/modules/media/stray-sweep';
import { reportError } from '@/modules/monitoring/report';
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
 * Genel süre bütçesi (maxDuration 60 sn): eski yüklemeler en fazla 20 sn, kuyruk boşaltma işin başından en fazla 30 sn
 * sürer (25 sn); ardından denetim kaydı temizliği ve başıboş dosya süpürmesinin kendi 25 sn bütçesi gelir. Bütçeler adımlar arasında
 * denetlenir (yumuşak sınır); kalan pay son adımın süresi içindir. Yetişmeyen iş sonraki çalışmaya kalır ve
 * yanıtta `timeBudgetHit` olarak görünür (sessizce kesilmez).
 */
const CLEANUP_STALE_BUDGET_MS = 20_000;
const CLEANUP_QUEUE_DEADLINE_MS = 25_000;

/**
 * Silme kuyruğunu boşaltır (doğrudan silinen satırların dosyaları). Yalnız depodan
 * BAŞARIYLA silinenler `media_queue_done` ile işaretlenir; kalanlar sonraki çalışmada yeniden denenir.
 * RPC yoksa (eski şema) atlanır.
 */
async function drainFileQueue(service: DB, deadline: number): Promise<{ skipped?: boolean; claimed: number; removed: number; failed: number; unsafe: number; error?: string; timeBudgetHit?: boolean }> {
  const seen = new Set<number>();
  let claimed = 0;
  let removed = 0;
  let failed = 0;
  let skipped = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    if (Date.now() >= deadline) return { claimed, removed, failed, unsafe: skipped, timeBudgetHit: true };
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
    if (items.length === 0) {
      // Bu partide yalnız güvensiz öğeler vardı: arkadaki güvenli öğelere ulaşmak için devam (güvensizler 5 dk yeniden alınmaz)
      if ((data?.length ?? 0) < CLAIM_BATCH) break;
      continue;
    }
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

/**
 * KI-38 / KI-39: başıboş dosyalar (bekleyen D). Sayfalı tarama, süre bütçesi ve izleme: src/modules/media/stray-sweep.ts.
 * RPC yoksa (D uygulanmamış şema) atlanır. Kapatma anahtarı: yalnız veritabanı geri yüklemesinden sonra (satırlar geri
 * gitmiş, dosyalar yeni) süpürme hâlâ gerekli dosyaları silebilir. BACKUP_RESTORE.md: geri yüklemeden önce MEDIA_STRAY_SWEEP=off.
 */
function strayDeps(service: DB): StraySweepDeps {
  return {
    disabled: process.env.MEDIA_STRAY_SWEEP === 'off',
    list: (limit, scan) => service.rpc('media_stray_objects', { p_limit: limit, p_scan: scan }),
    remove: (bucket, paths) => service.storage.from(bucket).remove(paths),
    cursor: () => service.from('media_stray_cursor').select('bucket, passes, pass_started_at'),
    isSafe: (item) => queueItemIsSafe(item),
    report: ({ name, message }) => reportError({ kind: 'server', name, message, path: '/api/cron/media-cleanup', method: 'GET', routePath: '/api/cron/media-cleanup', routeType: 'route', source: 'cron' }),
  };
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
  const startedAt = Date.now();

  const { data: stale, error } = await service.rpc('stale_media', { p_older_than: '24 hours' });
  if (error) return Response.json({ ok: false, error: 'stale_media_failed' }, { status: 500 });

  let removed = 0;
  let deferred = 0;
  let staleTimeBudgetHit = false;
  const orgs = new Set<string>();
  for (const media of stale ?? []) {
    if (Date.now() - startedAt >= CLEANUP_STALE_BUDGET_MS) {
      // Kalan eski yüklemeler sonraki çalışmada (kuyruk ve süpürme bu çalışmada da yapılır)
      staleTimeBudgetHit = true;
      break;
    }
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

  const queue = await drainFileQueue(service, startedAt + CLEANUP_QUEUE_DEADLINE_MS);
  // Denetim kaydı temizliği süpürmeden önce: süpürme süreyi doldurursa bu adım kaybolmaz
  const { data: purgedAudit } = await service.rpc('purge_old_audit_logs', { p_days: 730 });
  const stray = await sweepStray(strayDeps(service));

  const timeBudgetHit = staleTimeBudgetHit || Boolean(queue.timeBudgetHit);
  if (timeBudgetHit) console.error('[media-cleanup] time budget hit; remaining work deferred to next run', { staleTimeBudgetHit, queue: Boolean(queue.timeBudgetHit) });
  return Response.json({ ok: true, staleMediaRemoved: removed, deferred, timeBudgetHit, auditLogsPurged: purgedAudit ?? 0, queue, stray });
}
