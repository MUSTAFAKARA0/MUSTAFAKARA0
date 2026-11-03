/**
 * KI-39: başıboş dosya süpürmesinin sayfalı (kalıcı imleçli) çalıştırılması ve izleme (src/modules/media/stray-sweep.ts).
 * Veritabanı ve depolama sahte bağımlılıklarla taklit edilir; gerçek D davranışı tests/security/media-stray-sweep.test.mjs (SW-07…).
 * Çalıştırma: npm run test:unit
 *
 *   SS-01  turu tamamlanana kadar sayfa sayfa çağırır; iki kovanın turu bitince durur; listelenenleri siler
 *   SS-02  zaman aşımı (57014) izlemeye MediaStraySweepTimeout olarak bildirilir; stray_list_timeout
 *   SS-03  diğer liste hatası MediaStraySweepFailed; D yoksa (PGRST202) sessizce atlanır; kapatma anahtarı
 *   SS-04  çağrı ve süre bütçesi: tur bitmese de durur
 *   SS-05  tur STRAY_STALL_DAYS günden uzun sürüyorsa MediaStraySweepStalled; bu çalışmada biten kova bildirilmez
 *   SS-06  güvensiz ya da başka kovadaki öğe silinmez; silme hatasında durur; imleç okunamazsa tek çağrı
 *   SS-07  rota sözleşmesi: p_scan gönderilir, rapor reportError'a gider, eski tek parametreli çağrı yok
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STRAY_BATCH,
  STRAY_MAX_CALLS,
  STRAY_SCAN,
  STRAY_STALL_DAYS,
  STRAY_TIME_BUDGET_MS,
  isTimeoutError,
  sweepStray,
} from '../../src/modules/media/stray-sweep.ts';
import { queueItemIsSafe } from '../../src/modules/media/server.ts';

const root = new URL('../../', import.meta.url).pathname;
const ORG = '11111111-1111-4111-8111-111111111111';
const v = (n) => ({ bucket: 'media', path: `organizations/${ORG}/content/${n}/abcdefgh/w320.webp`, org_id: ORG });
const o = (n) => ({ bucket: 'media-originals', path: `organizations/${ORG}/content/${n}/original`, org_id: ORG });
const NOW = Date.parse('2026-11-02T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();

/**
 * Sahte D: her kova için sıralı nesne sayfaları. Her list çağrısı her kovanın sıradaki sayfasını verir;
 * son sayfadan sonra kovanın turu tamamlanır (passes + 1) ve baştan başlanır.
 */
function fakeDb({ pages, passStarted = { media: daysAgo(0), 'media-originals': daysAgo(0) }, listError, cursorError, removeError } = {}) {
  const state = {
    idx: { media: 0, 'media-originals': 0 },
    passes: { media: 0, 'media-originals': 0 },
    started: { ...passStarted },
    calls: [],
    removed: [],
    reports: [],
  };
  const deps = {
    now: () => NOW,
    isSafe: queueItemIsSafe,
    async list(limit, scan) {
      state.calls.push({ limit, scan });
      if (listError) return { data: null, error: typeof listError === 'function' ? listError(state.calls.length) : listError };
      const out = [];
      for (const b of ['media', 'media-originals']) {
        const list = pages[b] ?? [];
        const page = list[state.idx[b]] ?? [];
        out.push(...page);
        state.idx[b] += 1;
        if (state.idx[b] >= list.length) {
          state.idx[b] = 0;
          state.passes[b] += 1;
          state.started[b] = new Date(NOW).toISOString();
        }
      }
      return { data: out, error: null };
    },
    async remove(bucket, paths) {
      if (removeError) return { error: { message: 'storage down' } };
      state.removed.push(...paths.map((p) => `${bucket}:${p}`));
      return { error: null };
    },
    async cursor() {
      if (cursorError) return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
      return { data: ['media', 'media-originals'].map((b) => ({ bucket: b, passes: state.passes[b], pass_started_at: state.started[b] })), error: null };
    },
    report(r) {
      state.reports.push(r);
    },
  };
  return { deps, state };
}

describe('SS-01 sayfalı tur', () => {
  test('her kova turunu bitirene kadar çağırır, sonra durur; listelenenler silinir', async () => {
    const { deps, state } = fakeDb({
      pages: {
        media: [[v(1)], [], [v(2), v(3)]], // 3 sayfa
        'media-originals': [[o(1)]], // 1 sayfa
      },
    });
    const r = await sweepStray(deps);
    assert.equal(r.calls, 3);
    assert.deepEqual(r.passesCompleted.sort(), ['media', 'media-originals']);
    assert.equal(r.removed, 3 + 3); // 3 varyant; originals tek sayfalı, her çağrıda yeniden tur (sahte D aynı öğeyi verir)
    assert.ok(state.removed.includes(`media:${v(3).path}`));
    assert.equal(r.error, undefined);
    assert.equal(state.reports.length, 0);
    for (const c of state.calls) assert.deepEqual(c, { limit: STRAY_BATCH, scan: STRAY_SCAN });
  });
  test('boş kovalar: tek çağrıda iki tur biter', async () => {
    const { deps } = fakeDb({ pages: { media: [[]], 'media-originals': [[]] } });
    const r = await sweepStray(deps);
    assert.equal(r.calls, 1);
    assert.equal(r.removed, 0);
  });
});

describe('SS-02 zaman aşımı izlemeye yansır', () => {
  test('57014 → stray_list_timeout ve MediaStraySweepTimeout raporu; döngü durur', async () => {
    const { deps, state } = fakeDb({ pages: {}, listError: { code: '57014', message: 'canceling statement due to statement timeout' } });
    const r = await sweepStray(deps);
    assert.equal(r.error, 'stray_list_timeout');
    assert.equal(r.calls, 1);
    assert.equal(state.reports.length, 1);
    assert.equal(state.reports[0].name, 'MediaStraySweepTimeout');
    assert.match(state.reports[0].message, /57014/);
  });
  test('ikinci sayfada zaman aşımı: ilk sayfanın silmeleri korunur', async () => {
    const { deps, state } = fakeDb({ pages: { media: [[v(1)], [v(2)]], 'media-originals': [[]] } });
    const list = deps.list;
    deps.list = async (l, s) => (state.calls.length >= 1 ? (state.calls.push({ l, s }), { data: null, error: { code: '57014', message: 'x' } }) : list(l, s));
    const r = await sweepStray(deps);
    assert.equal(r.removed, 1);
    assert.equal(r.error, 'stray_list_timeout');
    assert.equal(state.reports[0].name, 'MediaStraySweepTimeout');
  });
  test('isTimeoutError: kod ve iletiler', () => {
    assert.equal(isTimeoutError({ code: '57014' }), true);
    assert.equal(isTimeoutError({ message: 'canceling statement due to statement timeout' }), true);
    assert.equal(isTimeoutError({ message: 'fetch failed: request timed out' }), true);
    assert.equal(isTimeoutError({ code: '42501', message: 'permission denied' }), false);
    assert.equal(isTimeoutError(null), false);
  });
});

describe('SS-03 diğer hatalar ve atlama', () => {
  test('liste hatası MediaStraySweepFailed olarak bildirilir', async () => {
    const { deps, state } = fakeDb({ pages: {}, listError: { code: '42501', message: 'permission denied' } });
    const r = await sweepStray(deps);
    assert.equal(r.error, 'stray_list_failed');
    assert.equal(state.reports[0].name, 'MediaStraySweepFailed');
  });
  test('D yoksa (PGRST202) atlanır, rapor yok', async () => {
    const { deps, state } = fakeDb({ pages: {}, listError: { code: 'PGRST202', message: 'Could not find the function public.media_stray_objects(p_limit, p_scan) in the schema cache' } });
    const r = await sweepStray(deps);
    assert.equal(r.skipped, true);
    assert.equal(state.reports.length, 0);
  });
  test('MEDIA_STRAY_SWEEP=off: hiç çağrı yok', async () => {
    const { deps, state } = fakeDb({ pages: { media: [[v(1)]] } });
    const r = await sweepStray({ ...deps, disabled: true });
    assert.equal(r.skipped, true);
    assert.equal(state.calls.length, 0);
  });
});

describe('SS-04 bütçe', () => {
  test('tur bitmezse STRAY_MAX_CALLS çağrıda durur', async () => {
    const many = Array.from({ length: STRAY_MAX_CALLS * 3 }, () => []);
    const { deps, state } = fakeDb({ pages: { media: many, 'media-originals': many } });
    const r = await sweepStray(deps);
    assert.equal(r.calls, STRAY_MAX_CALLS);
    assert.equal(state.calls.length, STRAY_MAX_CALLS);
    assert.deepEqual(r.passesCompleted, []);
    assert.equal(r.stalled, undefined, 'tur yeni başladı: durma bildirimi yok');
  });
  test('süre bütçesi aşılınca durur', async () => {
    const many = Array.from({ length: 100 }, () => []);
    const { deps } = fakeDb({ pages: { media: many, 'media-originals': many } });
    let t = NOW;
    deps.now = () => t;
    const list = deps.list;
    deps.list = async (l, s) => {
      t += STRAY_TIME_BUDGET_MS / 2 + 1;
      return list(l, s);
    };
    const r = await sweepStray(deps);
    assert.equal(r.calls, 2);
  });
});

describe('SS-05 ilerleme izleme (durma)', () => {
  test(`tur ${STRAY_STALL_DAYS} günden uzun sürüyorsa MediaStraySweepStalled`, async () => {
    const many = Array.from({ length: STRAY_MAX_CALLS * 2 }, () => []);
    const { deps, state } = fakeDb({
      pages: { media: many, 'media-originals': [[]] },
      passStarted: { media: daysAgo(STRAY_STALL_DAYS + 1), 'media-originals': daysAgo(STRAY_STALL_DAYS + 1) },
    });
    const r = await sweepStray(deps);
    assert.deepEqual(r.stalled, ['media']);
    assert.deepEqual(r.passesCompleted, ['media-originals']);
    assert.equal(state.reports.length, 1);
    assert.equal(state.reports[0].name, 'MediaStraySweepStalled');
    assert.match(state.reports[0].message, /media\b/);
  });
  test('zaman aşımında da eski tur bildirilir (iki rapor)', async () => {
    const { deps, state } = fakeDb({
      pages: {},
      passStarted: { media: daysAgo(30), 'media-originals': daysAgo(1) },
      listError: { code: '57014', message: 'timeout' },
    });
    const r = await sweepStray(deps);
    assert.deepEqual(r.stalled, ['media']);
    assert.deepEqual(state.reports.map((x) => x.name), ['MediaStraySweepTimeout', 'MediaStraySweepStalled']);
  });
});

describe('SS-06 güvenlik ve dayanıklılık', () => {
  test('güvensiz yol ve D dışı kova silinmez', async () => {
    const bad = [
      { bucket: 'media', path: `organizations/${ORG}/../x/w320.webp`, org_id: ORG },
      { bucket: 'media', path: 'organizations/22222222-2222-4222-8222-222222222222/x', org_id: ORG },
      { bucket: 'branding', path: `organizations/${ORG}/logo.png`, org_id: ORG },
    ];
    const { deps, state } = fakeDb({ pages: { media: [[...bad, v(1)]], 'media-originals': [[]] } });
    const r = await sweepStray(deps);
    assert.equal(r.unsafe, 3);
    assert.deepEqual(state.removed, [`media:${v(1).path}`]);
  });
  test('silme hatasında durur (sonraki turda yeniden listelenir)', async () => {
    const { deps, state } = fakeDb({ pages: { media: [[v(1)], [v(2)]], 'media-originals': [[]] }, removeError: true });
    const r = await sweepStray(deps);
    assert.equal(r.calls, 1);
    assert.equal(r.failed, 1);
    assert.equal(state.reports.length, 0);
  });
  test('imleç okunamazsa tek çağrı (tur sonu bilinemez)', async () => {
    const { deps } = fakeDb({ pages: { media: [[v(1)], [v(2)]], 'media-originals': [[]] }, cursorError: true });
    const r = await sweepStray(deps);
    assert.equal(r.calls, 1);
    assert.equal(r.removed, 1);
  });
});

describe('SS-07 rota ve göç sözleşmesi', () => {
  const route = readFileSync(`${root}src/app/api/cron/media-cleanup/route.ts`, 'utf8');
  const mod = readFileSync(`${root}src/modules/media/stray-sweep.ts`, 'utf8');
  test('rota sweepStray modülünü kullanır, p_scan gönderir, raporu reportError\'a verir, kapatma anahtarı korunur', () => {
    assert.match(route, /sweepStray\(strayDeps\(service\)\)/);
    assert.match(route, /rpc\('media_stray_objects', \{ p_limit: limit, p_scan: scan \}\)/);
    assert.match(route, /from\('media_stray_cursor'\)\.select\('bucket, passes, pass_started_at'\)/);
    assert.match(route, /report: \(\{ name, message \}\) => reportError\(/);
    assert.match(route, /MEDIA_STRAY_SWEEP === 'off'/);
    assert.match(route, /isSafe: \(item\) => queueItemIsSafe\(item\)/);
    assert.doesNotMatch(route, /rpc\('media_stray_objects', \{ p_limit: STRAY_BATCH \}\)/);
    assert.match(mod, /isMissingRpc\(error, 'media_stray_objects'\)/);
  });
  test('bütçe rota süresine sığar (maxDuration 60 sn)', () => {
    assert.match(route, /export const maxDuration = 60;/);
    assert.ok(STRAY_TIME_BUDGET_MS <= 30_000);
    assert.ok(STRAY_SCAN <= 10_000, 'D p_scan üst sınırı 10000');
    assert.ok(STRAY_BATCH <= 1000, 'D p_limit üst sınırı 1000');
  });
  test('genel süre bütçesi: eski yüklemeler + kuyruk + süpürme 60 sn\'ye sığar; aşım yanıtta görünür', () => {
    const stale = Number(route.match(/const CLEANUP_STALE_BUDGET_MS = ([\d_]+);/)?.[1].replace(/_/g, ''));
    const queue = Number(route.match(/const CLEANUP_QUEUE_DEADLINE_MS = ([\d_]+);/)?.[1].replace(/_/g, ''));
    assert.ok(stale > 0 && stale < queue, 'eski yükleme bütçesi kuyruk sınırından önce biter');
    assert.ok(queue + STRAY_TIME_BUDGET_MS <= 50_000, 'kuyruk + süpürme + pay (son adımlar için ≥ 10 sn) ≤ 60 sn');
    assert.match(route, /if \(Date\.now\(\) - startedAt >= CLEANUP_STALE_BUDGET_MS\) \{/);
    assert.match(route, /if \(Date\.now\(\) >= deadline\) return \{ [^}]*timeBudgetHit: true \};/);
    assert.match(route, /drainFileQueue\(service, startedAt \+ CLEANUP_QUEUE_DEADLINE_MS\)/);
    assert.match(route, /timeBudgetHit, auditLogsPurged/);
    assert.ok(route.indexOf("rpc('purge_old_audit_logs'") < route.indexOf('sweepStray(strayDeps(service))'), 'denetim temizliği süpürmeden önce');
    assert.match(route, /if \(\(data\?\.length \?\? 0\) < CLAIM_BATCH\) break;\n\s*continue;/, 'yalnız güvensiz öğeli parti kuyruğu tıkamaz');
    assert.doesNotMatch(route, /^export const CLEANUP_/m, 'rota dosyası yalnız Next.js alanlarını dışa aktarır');
  });
  test('D: imleç tablosu, FOR UPDATE, C sıralaması, tek imza; 05 hepsini geri alır', () => {
    const pending = readFileSync(`${root}supabase/pending/20261031000001_media_stray_sweep.sql`, 'utf8');
    assert.match(pending, /create table if not exists public\.media_stray_cursor/);
    assert.match(pending, /alter table public\.media_stray_cursor enable row level security;/);
    assert.match(pending, /revoke all on table public\.media_stray_cursor from public, anon, authenticated, service_role;\ngrant select on table public\.media_stray_cursor to service_role;/);
    assert.match(pending, /where c\.bucket = v_bucket for update;/);
    assert.match(pending, /and o\.name collate "C" > v_cursor\s+order by o\.name collate "C"\s+limit v_scan/);
    assert.match(pending, /least\(coalesce\(p_scan, 2000\), 10000\)/);
    assert.match(pending, /drop function if exists public\.media_stray_objects\(integer\);\n\ncreate or replace function public\.media_stray_objects\(p_limit integer, p_scan integer default 2000\)/);
    const rollback = readFileSync(`${root}supabase/ops/media_stray_sweep/05_rollback.sql`, 'utf8');
    assert.match(rollback, /drop table if exists public\.media_stray_cursor;/);
    const pre = readFileSync(`${root}supabase/ops/media_stray_sweep/01_preflight.sql`, 'utf8');
    assert.match(pre, /name COLLATE "C"/);
    const types = readFileSync(`${root}src/types/supabase.ts`, 'utf8');
    assert.match(types, /media_stray_cursor: \{/);
    assert.match(types, /media_stray_objects: \{\n\s+Args: \{\n\s+p_limit: number\n\s+p_scan\?: number/);
  });
});
