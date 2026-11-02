import { isMissingRpc } from '@/modules/media/finalize';
import { MEDIA_BUCKETS } from '@/modules/media/variants';

/**
 * KI-38 / KI-39: başıboş dosya süpürmesi (bekleyen D, `media_stray_objects(p_limit, p_scan)` + `media_stray_cursor`).
 *
 * D her çağrıda her kovada kalıcı imleçten sonraki en çok `p_scan` nesneye bakar; kovanın sonunda imleç başa döner ve
 * `passes` artar. Bu modül çağrıları süre ve sayı bütçesiyle tekrarlar, listelenenleri siler ve şunları izlemeye bildirir
 * (`report`, rota bağlamında `reportError`: Vercel logları + SENTRY_DSN / ERROR_WEBHOOK_URL):
 *   - liste çağrısı zaman aşımı (57014) → `stray_list_timeout`; diğer liste hataları → `stray_list_failed`
 *   - bir kovanın turu `STRAY_STALL_DAYS` günden uzun sürüyor (imleç ilerliyor ama sona varamıyor) → `stalled`
 * Saf modül: veritabanı ve depolama bağımlılıkları dışarıdan verilir (birim testi: tests/unit/media-stray-sweep.test.mjs).
 */

export const STRAY_BATCH = 500;
export const STRAY_SCAN = 5000;
export const STRAY_MAX_CALLS = 20;
export const STRAY_TIME_BUDGET_MS = 25_000;
export const STRAY_STALL_DAYS = 7;

const STRAY_BUCKETS = [MEDIA_BUCKETS.public, MEDIA_BUCKETS.originals] as const;

export interface StrayRpcError {
  code?: string | null;
  message?: string | null;
}
export interface StrayItem {
  bucket: string;
  path: string;
  org_id: string;
}
export interface StrayCursorRow {
  bucket: string;
  passes: number;
  pass_started_at: string;
}
export interface StraySweepReport {
  name: string;
  message: string;
}
export interface StraySweepDeps {
  list(limit: number, scan: number): PromiseLike<{ data: StrayItem[] | null; error: StrayRpcError | null }>;
  remove(bucket: string, paths: string[]): PromiseLike<{ error: { message: string } | null }>;
  cursor(): PromiseLike<{ data: StrayCursorRow[] | null; error: StrayRpcError | null }>;
  report(r: StraySweepReport): Promise<void> | void;
  isSafe(item: StrayItem): boolean;
  now?: () => number;
  /** MEDIA_STRAY_SWEEP=off (geri yükleme kapatma anahtarı) */
  disabled?: boolean;
}
export interface StraySweepResult {
  skipped?: boolean;
  removed: number;
  failed: number;
  unsafe: number;
  calls: number;
  /** Bu çalışmada turunu tamamlayan kovalar */
  passesCompleted: string[];
  /** Turu STRAY_STALL_DAYS günden uzun süren kovalar */
  stalled?: string[];
  error?: 'stray_list_timeout' | 'stray_list_failed';
}

/** PostgreSQL query_canceled (statement_timeout) ya da PostgREST/ağ zaman aşımı */
export function isTimeoutError(err: StrayRpcError | null | undefined): boolean {
  if (!err) return false;
  return err.code === '57014' || /statement timeout|canceling statement|timed? ?out/i.test(err.message ?? '');
}

function passesOf(rows: StrayCursorRow[] | null): Map<string, number> {
  return new Map((rows ?? []).map((r) => [r.bucket, Number(r.passes)]));
}

export async function sweepStray(deps: StraySweepDeps): Promise<StraySweepResult> {
  const now = deps.now ?? Date.now;
  const result: StraySweepResult = { removed: 0, failed: 0, unsafe: 0, calls: 0, passesCompleted: [] };
  if (deps.disabled) return { ...result, skipped: true };

  const startedAt = now();
  const first = await deps.cursor();
  const startPasses = first.error ? null : passesOf(first.data);
  let lastCursor = first.error ? null : first.data;

  while (result.calls < STRAY_MAX_CALLS && now() - startedAt < STRAY_TIME_BUDGET_MS) {
    const { data, error } = await deps.list(STRAY_BATCH, STRAY_SCAN);
    result.calls += 1;
    if (error) {
      if (isMissingRpc(error, 'media_stray_objects')) return { ...result, skipped: true };
      const timeout = isTimeoutError(error);
      result.error = timeout ? 'stray_list_timeout' : 'stray_list_failed';
      await deps.report({
        name: timeout ? 'MediaStraySweepTimeout' : 'MediaStraySweepFailed',
        message: `media-cleanup: media_stray_objects ${timeout ? 'zaman aşımı' : 'hatası'} (code=${error.code ?? '?'}, çağrı ${result.calls}, p_scan=${STRAY_SCAN})`,
      });
      break;
    }

    const byBucket = new Map<string, string[]>();
    for (const item of data ?? []) {
      if (!(STRAY_BUCKETS as readonly string[]).includes(item.bucket) || !deps.isSafe(item)) {
        result.unsafe += 1;
        continue;
      }
      byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item.path]);
    }
    let removeFailed = false;
    for (const [bucket, paths] of byBucket) {
      const { error: removeError } = await deps.remove(bucket, paths);
      if (removeError) {
        result.failed += paths.length;
        removeFailed = true;
        console.error('[media-cleanup] stray remove failed', { bucket, count: paths.length, message: removeError.message });
      } else {
        result.removed += paths.length;
      }
    }
    // Depolama silmiyor: imleç ilerlemiş olsa da sonraki turda yeniden listelenir; bu çalışmada zorlamayız
    if (removeFailed) break;

    const cur = await deps.cursor();
    if (cur.error || !startPasses) break; // imleç okunamıyorsa tur sonunu bilemeyiz: tek çağrıyla yetin
    lastCursor = cur.data;
    const passes = passesOf(cur.data);
    result.passesCompleted = STRAY_BUCKETS.filter((b) => (passes.get(b) ?? 0) > (startPasses.get(b) ?? 0));
    if (result.passesCompleted.length === STRAY_BUCKETS.length) break;
  }

  // İlerleme izleme: tur bu çalışmada bitmediyse ve uzun süredir sürüyorsa bildir (sessiz durma olmasın)
  const stallMs = STRAY_STALL_DAYS * 24 * 60 * 60 * 1000;
  const stalled = (lastCursor ?? [])
    .filter((r) => !result.passesCompleted.includes(r.bucket))
    .filter((r) => now() - Date.parse(r.pass_started_at) > stallMs)
    .map((r) => r.bucket);
  if (stalled.length) {
    result.stalled = stalled;
    await deps.report({
      name: 'MediaStraySweepStalled',
      message: `media-cleanup: başıboş dosya turu ${STRAY_STALL_DAYS} günden uzun sürüyor (${stalled.join(', ')}); KI-39 bütçesini (STRAY_SCAN/STRAY_MAX_CALLS) artırın`,
    });
  }
  return result;
}
