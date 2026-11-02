/**
 * WP-A2: medya sonlandırma sarmalayıcıları, hata kararları ve media.ts kaynak sözleşmesi.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyFinalizeError,
  decideAfterFinalizeError,
  finalizeMedia,
  isMissingRpc,
  markMediaFailed,
  parseFinalizeResult,
} from '../../src/modules/media/finalize.ts';
import { mediaFolderOf, pathsOwnedByOrg, queueItemIsSafe } from '../../src/modules/media/server.ts';

const root = new URL('../../', import.meta.url).pathname;
const mediaSrc = readFileSync(`${root}src/app/actions/media.ts`, 'utf8');
const cronSrc = readFileSync(`${root}src/app/api/cron/media-cleanup/route.ts`, 'utf8');

describe('isMissingRpc', () => {
  test('yalnız PGRST202 + tam fonksiyon adı', () => {
    const msg = 'Could not find the function public.media_finalize(p_media) in the schema cache';
    assert.equal(isMissingRpc({ code: 'PGRST202', message: msg }, 'media_finalize'), true);
  });
  test('42883 asla yok sayılmaz', () => {
    assert.equal(isMissingRpc({ code: '42883', message: 'function media_finalize does not exist' }, 'media_finalize'), false);
  });
  test('başka fonksiyon adı / kısmi ad', () => {
    assert.equal(isMissingRpc({ code: 'PGRST202', message: 'Could not find the function public.media_mark_failed' }, 'media_finalize'), false);
    assert.equal(isMissingRpc({ code: 'PGRST202', message: 'function my_media_finalize_x' }, 'media_finalize'), false);
  });
  test('null / undefined / mesajsız', () => {
    assert.equal(isMissingRpc(null, 'media_finalize'), false);
    assert.equal(isMissingRpc(undefined, 'media_finalize'), false);
    assert.equal(isMissingRpc({ code: 'PGRST202' }, 'media_finalize'), false);
  });
});

describe('classifyFinalizeError', () => {
  const cases = [
    [{ code: 'PGRST202', message: 'Could not find the function public.media_finalize' }, 'missing'],
    [{ code: 'P0001', message: 'plan_limit_storage' }, 'quota'],
    [{ code: 'P0001', message: 'media_conflict' }, 'conflict'],
    [{ code: '42501', message: 'forbidden' }, 'structured'],
    [{ code: 'P0001', message: 'media_not_uploaded' }, 'structured'],
    [{ code: '42883', message: 'function media_finalize does not exist' }, 'structured'],
    [{ code: 'PGRST202', message: 'Could not find the function public.other' }, 'structured'],
    [{ code: '', message: 'FetchError: network' }, 'unknown'],
    [{ message: 'timeout' }, 'unknown'],
    [{ code: null, message: null }, 'unknown'],
    [null, 'unknown'],
  ];
  for (const [err, kind] of cases) {
    test(`${JSON.stringify(err)} → ${kind}`, () => assert.equal(classifyFinalizeError(err), kind));
  }
});

describe('decideAfterFinalizeError', () => {
  const NEW = 'organizations/o/content/m/NEWREV123';
  const OLD = 'organizations/o/content/m/OLDREV123';
  const d = (kind, rowStatus, ...rest) => decideAfterFinalizeError({ kind, rowStatus, rowPublicBase: rest.length ? rest[0] : OLD, newBase: NEW });

  test('orijinal hiçbir dalda silinmez', () => {
    for (const kind of ['missing', 'quota', 'conflict', 'structured', 'unknown'])
      for (const status of ['pending', 'ready', 'failed']) assert.equal(d(kind, status).removeOriginal, false);
  });
  test('ready satır hiçbir hata türünde failed yapılmaz', () => {
    for (const kind of ['missing', 'quota', 'conflict', 'structured', 'unknown']) assert.equal(d(kind, 'ready').markFailed, false);
  });
  test('missing → yedek yol, başka bir şey yok', () => {
    const r = d('missing', 'pending');
    assert.equal(r.useLegacy, true);
    assert.equal(r.removeNewVariants, false);
    assert.equal(r.throwCode, null);
  });
  test('quota: yeni yükleme failed(quota) + orijinal korunur; ready satır değişmez', () => {
    const p = d('quota', 'pending');
    assert.deepEqual([p.removeNewVariants, p.markFailed, p.failedReason, p.throwCode], [true, true, 'quota', 'quota']);
    const r = d('quota', 'ready');
    assert.deepEqual([r.removeNewVariants, r.markFailed, r.throwCode], [true, false, 'quota']);
  });
  test('conflict: yalnız kendi varyantları silinir, satıra dokunulmaz', () => {
    for (const status of ['pending', 'ready', 'failed']) {
      const r = d('conflict', status);
      assert.deepEqual([r.removeNewVariants, r.markFailed, r.throwCode], [true, false, 'conflict']);
    }
  });
  test('structured: yeni varyantlar silinir; yalnız ready olmayan failed olur', () => {
    assert.deepEqual([d('structured', 'failed').removeNewVariants, d('structured', 'failed').markFailed], [true, true]);
    assert.deepEqual([d('structured', 'ready').removeNewVariants, d('structured', 'ready').markFailed], [true, false]);
    assert.equal(d('structured', 'ready').throwCode, 'finalize');
  });
  test('unknown + satır yeni tabanı gösteriyor → başarı, hiçbir dosya silinmez', () => {
    for (const status of ['pending', 'ready', 'failed']) {
      const r = d('unknown', status, NEW);
      assert.deepEqual([r.treatAsSuccess, r.removeNewVariants, r.markFailed, r.throwCode], [true, false, false, null]);
    }
  });
  test('unknown + satır farklı tabanda → yeni varyantlar silinir', () => {
    const r = d('unknown', 'ready', OLD);
    assert.deepEqual([r.treatAsSuccess, r.removeNewVariants, r.markFailed, r.throwCode], [false, true, false, 'finalize']);
    const p = d('unknown', 'pending', null);
    assert.deepEqual([p.removeNewVariants, p.markFailed], [true, true]);
  });
  test('failed×quota: failed(quota) + yeni varyantlar silinir', () => {
    const r = d('quota', 'failed');
    assert.deepEqual([r.removeNewVariants, r.markFailed, r.failedReason, r.throwCode], [true, true, 'quota', 'quota']);
  });
  test('failed×unknown(farklı taban): sil + failed', () => {
    const r = d('unknown', 'failed', OLD);
    assert.deepEqual([r.treatAsSuccess, r.removeNewVariants, r.markFailed], [false, true, true]);
  });
  test('missing×ready: yedek yol, failed yok', () => {
    const r = d('missing', 'ready');
    assert.deepEqual([r.useLegacy, r.markFailed, r.removeNewVariants], [true, false, false]);
  });
  test('unknown + satır okunamadı → hiçbir şey silinmez', () => {
    const r = d('unknown', 'pending', undefined);
    assert.deepEqual([r.treatAsSuccess, r.removeNewVariants, r.markFailed, r.throwCode], [false, false, false, 'finalize']);
  });
});

describe('RPC sarmalayıcıları (sahte istemci)', () => {
  test('finalizeMedia imzayı sözleşmeye göre gönderir ve sonucu ayrıştırır', async () => {
    let call;
    const fake = {
      rpc: async (fn, args) => {
        call = { fn, args };
        return { data: { previous_base: 'a/b', previous_widths: [320, 'x', 640], byte_size: 5, variants_byte_size: 7 }, error: null };
      },
    };
    const r = await finalizeMedia(fake, { mediaId: 'id', expectedBase: 'old', publicBase: 'new', widths: [320], width: 10, height: 20, blur: 'b' });
    assert.equal(call.fn, 'media_finalize');
    assert.deepEqual(call.args, { p_media: 'id', p_expected_base: 'old', p_public_base: 'new', p_variant_widths: [320], p_width: 10, p_height: 20, p_blur: 'b' });
    assert.deepEqual(r.data, { previous_base: 'a/b', previous_widths: [320, 640], byte_size: 5, variants_byte_size: 7 });
    assert.equal(r.error, null);
  });
  test('finalizeMedia hatayı aynen döndürür', async () => {
    const err = { code: 'P0001', message: 'media_conflict' };
    const r = await finalizeMedia({ rpc: async () => ({ data: null, error: err }) }, { mediaId: 'i', expectedBase: null, publicBase: 'n', widths: [], width: 1, height: 1, blur: null });
    assert.equal(r.error, err);
    assert.equal(r.data, null);
  });
  test('parseFinalizeResult null / dizi / bozuk girdiyi tolere eder', () => {
    for (const bad of [null, undefined, [], 'x', 5]) assert.deepEqual(parseFinalizeResult(bad), { previous_base: null, previous_widths: [], byte_size: null, variants_byte_size: null });
  });
  test('markMediaFailed: false (ready satır) hata değildir; hata iletilir; metin 300 ile kısalır', async () => {
    let sent;
    const mk = (res) => ({ rpc: async (fn, args) => ((sent = { fn, args }), res) });
    assert.deepEqual(await markMediaFailed(mk({ data: false, error: null }), 'id', 'x'.repeat(500)), { marked: false, error: null });
    assert.equal(sent.fn, 'media_mark_failed');
    assert.equal(sent.args.p_error.length, 300);
    assert.equal((await markMediaFailed(mk({ data: true, error: null }), 'id', 'e')).marked, true);
    const err = { code: 'PGRST202', message: 'media_mark_failed' };
    assert.deepEqual(await markMediaFailed(mk({ data: null, error: err }), 'id', 'e'), { marked: false, error: err });
  });
});

describe('mediaFolderOf / pathsOwnedByOrg', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const U = '33333333-3333-4333-8333-333333333333';
  const P = '44444444-4444-4444-8444-444444444444';
  test('kanonik yollar', () => {
    assert.equal(mediaFolderOf({ original_path: `organizations/${ORG}/content/${U}/original` }, ORG), `organizations/${ORG}/content/${U}`);
    assert.equal(mediaFolderOf({ original_path: `organizations/${ORG}/properties/${P}/images/${U}/original` }, ORG), `organizations/${ORG}/properties/${P}/images/${U}`);
  });
  test('başka kurum yolu null', () => {
    assert.equal(mediaFolderOf({ original_path: `organizations/${OTHER}/content/${U}/original` }, ORG), null);
  });
  test('/original yok, .., demo tabanı, kanonik olmayan, null', () => {
    assert.equal(mediaFolderOf({ original_path: `organizations/${ORG}/content/${U}` }, ORG), null);
    assert.equal(mediaFolderOf({ original_path: `organizations/${ORG}/content/../${OTHER}/original` }, ORG), null);
    assert.equal(mediaFolderOf({ original_path: `organizations/${ORG}/content/${U}/x/original` }, ORG), null);
    assert.equal(mediaFolderOf({ original_path: '/demo/x' }, ORG), null);
    assert.equal(mediaFolderOf({ original_path: null }, ORG), null);
  });
  test('pathsOwnedByOrg: yabancı kurum / .. reddedilir, demo ve null kabul', () => {
    assert.equal(pathsOwnedByOrg({ original_path: `organizations/${ORG}/a/original`, public_base: null }, ORG), true);
    assert.equal(pathsOwnedByOrg({ original_path: null, public_base: '/demo/x' }, ORG), true);
    assert.equal(pathsOwnedByOrg({ original_path: `organizations/${OTHER}/a/original`, public_base: null }, ORG), false);
    assert.equal(pathsOwnedByOrg({ original_path: null, public_base: `organizations/${ORG}/../${OTHER}/x` }, ORG), false);
  });
});

describe('queueItemIsSafe', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  test('kendi kurum ön eki kabul', () => {
    assert.equal(queueItemIsSafe({ org_id: ORG, path: `organizations/${ORG}/content/x/a/w320.webp` }), true);
  });
  test('başka kurum, org_id yok, .., //, ön eksiz, path yok reddedilir', () => {
    assert.equal(queueItemIsSafe({ org_id: ORG, path: `organizations/${OTHER}/x/original` }), false);
    assert.equal(queueItemIsSafe({ org_id: null, path: `organizations/${ORG}/x` }), false);
    assert.equal(queueItemIsSafe({ path: `organizations/${ORG}/x` }), false);
    assert.equal(queueItemIsSafe({ org_id: ORG, path: `organizations/${ORG}/../${OTHER}/x` }), false);
    assert.equal(queueItemIsSafe({ org_id: ORG, path: `organizations/${ORG}//x` }), false);
    assert.equal(queueItemIsSafe({ org_id: ORG, path: 'x/y' }), false);
    assert.equal(queueItemIsSafe({ org_id: ORG, path: `organizations/${ORG}` }), false);
    assert.equal(queueItemIsSafe({ org_id: ORG, path: null }), false);
  });
});

describe('media.ts kaynak sözleşmesi', () => {
  // Korunan sütunları yazan .update( çağrıları yalnız legacy* yedek işlevlerinde olabilir
  const PROTECTED = /\b(status|byte_size|variants_byte_size|public_base|original_path|error)\s*:/;
  function functionBodies() {
    const re = /^(?:export )?async function (\w+)/gm;
    const starts = [...mediaSrc.matchAll(re)].map((m) => ({ name: m[1], index: m.index }));
    return starts.map((s, i) => ({ name: s.name, body: mediaSrc.slice(s.index, starts[i + 1]?.index ?? mediaSrc.length) }));
  }
  test('korunan sütunlar yalnız legacy* işlevlerinde güncellenir', () => {
    for (const { name, body } of functionBodies()) {
      const updates = [...body.matchAll(/\.update\(\{([^}]*)\}\)/g)];
      for (const u of updates) {
        if (PROTECTED.test(u[1])) assert.match(name, /^legacy/, `${name} korunan sütun yazıyor: ${u[1].slice(0, 60)}`);
      }
    }
  });
  test('markFailed ve finalize RPC üzerinden; yedek yalnız PGRST202 ile', () => {
    assert.match(mediaSrc, /finalizeMedia\(ctx\.supabase/);
    assert.match(mediaSrc, /isMissingRpc\(error, 'media_mark_failed'\)/);
    assert.doesNotMatch(mediaSrc, /42883/);
  });
  test('ready satırda orijinal silinmez ve markFailed çağrılmaz', () => {
    const proc = functionBodies().find((f) => f.name === 'processMedia').body;
    const removals = [...proc.matchAll(/^\s*(if \(!isReady\) )?await ctx\.supabase\.storage\.from\(MEDIA_BUCKETS\.originals\)\.remove/gm)];
    assert.ok(removals.length >= 2);
    for (const r of removals) assert.ok(r[1], 'orijinal silme isReady korumasız');
    const mf = functionBodies().find((f) => f.name === 'markFailed').body;
    assert.match(mf, /if \(media\.status === 'ready'\) return false/);
  });
  test('retry ayrı durum sıfırlaması yapmaz', () => {
    const retry = functionBodies().find((f) => f.name === 'retryMediaProcessing').body;
    assert.doesNotMatch(retry, /\.update\(/);
  });
  test('cron: klasör temizliği ve kuyruk boşaltma (done yalnız başarılara)', () => {
    assert.match(cronSrc, /removeMediaFolder/);
    assert.match(cronSrc, /pathsOwnedByOrg/);
    assert.match(cronSrc, /ALLOWED_BUCKETS/);
    assert.match(cronSrc, /queueItemIsSafe\(item\)/);
    assert.match(cronSrc, /media_queue_claim/);
    assert.match(cronSrc, /media_queue_done/);
    assert.match(cronSrc, /isMissingRpc\(error, 'media_queue_claim'\)/);
    assert.match(cronSrc, /doneIds\.push/);
  });
});

describe('classifyFinalizeError · media_busy', () => {
  test('media_busy (55P03) çakışma gibi işlenir: satır değişmez, ready satır düşürülmez', async () => {
    const { classifyFinalizeError, decideAfterFinalizeError } = await import('../../src/modules/media/finalize.ts');
    const kind = classifyFinalizeError({ code: '55P03', message: 'media_busy' });
    assert.equal(kind, 'conflict');
    for (const rowStatus of ['pending', 'failed', 'ready']) {
      const d = decideAfterFinalizeError({ kind, rowStatus, rowPublicBase: undefined, newBase: 'x' });
      assert.equal(d.markFailed, false, rowStatus);
      assert.equal(d.removeOriginal ?? false, false, rowStatus);
      assert.equal(d.removeNewVariants, true, rowStatus);
    }
  });
});
