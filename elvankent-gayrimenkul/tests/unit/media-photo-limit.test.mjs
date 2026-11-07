/**
 * KI-45: `replaceId` ile oluşturulan yükleme, değiştirme olmadan sonlandırılırsa ilan başına 50 fotoğraf
 * sınırını atlamamalı. Saf yardımcılar (sahte istemci) + media.ts / media-manager.tsx kaynak sözleşmesi.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countOtherReadyPhotos, isValidReplaceTarget, photoLimitReached } from '../../src/modules/media/photo-limit.ts';

const root = new URL('../../', import.meta.url).pathname;
const mediaSrc = readFileSync(`${root}src/app/actions/media.ts`, 'utf8');
const uiSrc = readFileSync(`${root}src/components/admin/media/media-manager.tsx`, 'utf8');

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const P2 = '44444444-4444-4444-8444-444444444444';
const NEW = '55555555-5555-4555-8555-555555555555';
const OLD = '66666666-6666-4666-8666-666666666666';

function functionBody(name) {
  const re = /^(?:export )?async function (\w+)/gm;
  const starts = [...mediaSrc.matchAll(re)].map((m) => ({ name: m[1], index: m.index }));
  const i = starts.findIndex((s) => s.name === name);
  assert.ok(i >= 0, `${name} bulunamadı`);
  return mediaSrc.slice(starts[i].index, starts[i + 1]?.index ?? mediaSrc.length);
}

describe('isValidReplaceTarget', () => {
  const media = { id: NEW, organization_id: ORG, property_id: P1 };
  test('aynı kurum + aynı ilan + başka kayıt → geçerli', () => {
    assert.equal(isValidReplaceTarget(media, { id: OLD, organization_id: ORG, property_id: P1 }), true);
  });
  test('hedef yok / null / undefined → değiştirme yok', () => {
    assert.equal(isValidReplaceTarget(media, null), false);
    assert.equal(isValidReplaceTarget(media, undefined), false);
  });
  test('kaydın kendisi → değiştirme yok (sınır atlanamaz)', () => {
    assert.equal(isValidReplaceTarget(media, { ...media }), false);
  });
  test('başka ilan / başka kurum → değiştirme yok', () => {
    assert.equal(isValidReplaceTarget(media, { id: OLD, organization_id: ORG, property_id: P2 }), false);
    assert.equal(isValidReplaceTarget(media, { id: OLD, organization_id: OTHER_ORG, property_id: P1 }), false);
  });
  test('ilana bağlı olmayan kayıt (içerik görseli) hiçbir şeyi değiştiremez', () => {
    assert.equal(isValidReplaceTarget({ ...media, property_id: null }, { id: OLD, organization_id: ORG, property_id: null }), false);
  });
});

describe('photoLimitReached', () => {
  test('diğer hazır fotoğraf sayısı sınıra ulaştıysa bu kayıt eklenemez', () => {
    assert.equal(photoLimitReached(49, 50), false);
    assert.equal(photoLimitReached(50, 50), true);
    assert.equal(photoLimitReached(51, 50), true);
    assert.equal(photoLimitReached(0, 50), false);
  });
});

describe('countOtherReadyPhotos (sahte istemci)', () => {
  function fakeDb(result) {
    const calls = [];
    const builder = {
      select(cols, opts) {
        calls.push(['select', cols, opts]);
        return builder;
      },
      eq(col, val) {
        calls.push(['eq', col, val]);
        return builder;
      },
      neq(col, val) {
        calls.push(['neq', col, val]);
        return Promise.resolve(result);
      },
    };
    return {
      calls,
      from(table) {
        calls.push(['from', table]);
        return builder;
      },
    };
  }
  test('yalnız bu ilanın, kendisi hariç, ready satırlarını sayar (head + exact)', async () => {
    const db = fakeDb({ count: 50, error: null });
    const r = await countOtherReadyPhotos(db, P1, NEW);
    assert.deepEqual(r, { count: 50, error: null });
    assert.deepEqual(db.calls, [
      ['from', 'media_assets'],
      ['select', 'id', { count: 'exact', head: true }],
      ['eq', 'property_id', P1],
      ['eq', 'status', 'ready'],
      ['neq', 'id', NEW],
    ]);
  });
  test('null sayım 0 olur; hata aynen iletilir', async () => {
    assert.deepEqual(await countOtherReadyPhotos(fakeDb({ count: null, error: null }), P1, NEW), { count: 0, error: null });
    const err = { code: '42501', message: 'denied' };
    assert.equal((await countOtherReadyPhotos(fakeDb({ count: null, error: err }), P1, NEW)).error, err);
  });
});

describe('media.ts: değiştirme niyeti yüklemeye bağlı (KI-45)', () => {
  test('finalize: değiştirme hedefi işlemeden ÖNCE çözülür; hedef yoksa sınır işlemeden önce denetlenir', () => {
    const body = functionBody('finalizeMediaUpload');
    const resolve = body.indexOf('const old = await loadReplaceTarget(ctx, media, input.replaceId);');
    const guard = body.indexOf('if (!old) await enforcePhotoLimit(ctx, media);');
    const process = body.indexOf('await processMedia(ctx, media)');
    assert.ok(resolve > 0 && guard > resolve && process > guard, 'sıra: hedef → sınır → işleme');
  });
  test('finalize: eski kayıt silinemediyse (0 satır) değiştirme olmadı sayılır ve sınır yeniden denetlenir', () => {
    const body = functionBody('finalizeMediaUpload');
    assert.match(body, /\.delete\(\)\.eq\('id', old\.id\)\.select\('id'\)/);
    assert.match(body, /if \(!deleted\?\.length\) \{[\s\S]*?await enforcePhotoLimit\(ctx, \{ \.\.\.result,/);
    // Eski davranış: "farklı ilan → sessizce ekle" dalı kalmadı
    assert.doesNotMatch(body, /old\.property_id === media\.property_id/);
  });
  test('loadReplaceTarget: geçersiz/bulunamayan hedef null (sınır uygulanır), diğer hatalar fırlatılır', () => {
    const body = functionBody('loadReplaceTarget');
    assert.match(body, /isValidReplaceTarget\(media, target\) \? target : null/);
    assert.match(body, /if \(error instanceof NotFoundError\) return null;\n\s*throw error;/);
  });
  test('enforcePhotoLimit: ilan fotoğrafı değilse atlanır; aşımda yükleme atılır ve limit kodu döner', () => {
    const body = functionBody('enforcePhotoLimit');
    assert.match(body, /if \(!media\.property_id\) return;/);
    assert.match(body, /countOtherReadyPhotos\(ctx\.supabase, media\.property_id, media\.id\)/);
    assert.match(body, /assertNoDbError\(error\);/);
    const discard = body.indexOf('await discardUpload(ctx, media);');
    const thrown = body.indexOf("throw new ActionError(LIMIT_MESSAGE, 'limit');");
    assert.ok(discard > 0 && thrown > discard);
  });
  test('discardUpload: önce kayıt, sonra dosyalar', () => {
    const body = functionBody('discardUpload');
    assert.ok(body.indexOf(".from('media_assets').delete().eq('id', media.id)") < body.indexOf('removeMediaFiles(ctx.supabase, media)'));
  });
  test('retryMediaProcessing hiçbir kaydı değiştirmez → işlemeden önce sınır denetlenir', () => {
    const body = functionBody('retryMediaProcessing');
    const guard = body.indexOf('await enforcePhotoLimit(ctx, media);');
    assert.ok(guard > 0 && guard < body.indexOf('await processMedia('));
  });
  test('createMediaUpload hâlâ replaceId hedefini doğrular, aksi halde sınırı sayar', () => {
    const body = functionBody('createMediaUpload');
    assert.match(body, /if \(input\.replaceId\) \{[\s\S]*?target\.property_id !== property\.id[\s\S]*?\} else \{[\s\S]*?\.in\('status', \['pending', 'ready'\]\)/);
    assert.match(body, /throw new ActionError\(LIMIT_MESSAGE, 'limit'\)/);
  });
  test('bilinen sınırlama belgelenmiş: sayım atomik değil, göç gerekir', () => {
    const lib = readFileSync(`${root}src/modules/media/photo-limit.ts`, 'utf8');
    assert.match(lib, /Bilinen sınırlama/);
    assert.match(lib, /göç/);
  });
});

describe('media-manager.tsx: değiştirme yeniden denemesi niyeti taşır', () => {
  test('işleme yeniden denemesi değiştirme öğesinde finalizeMediaUpload(replaceId) kullanır', () => {
    assert.match(uiSrc, /item\.failedAt === 'process' && !item\.replaceId\n\s*\? await retryMediaProcessing\(ticket\.mediaId\)\n\s*: await finalizeMediaUpload\(\{ mediaId: ticket\.mediaId, replaceId: item\.replaceId \}\)/);
  });
  test('limit hatası kalıcıdır (aynı kayıtla yeniden deneme yok); listede atılan kayıt kaldırılır', () => {
    assert.match(uiSrc, /\['unsupported', 'too_small', 'too_large', 'corrupt', 'limit'\]\.includes/);
    assert.match(uiSrc, /if \(!res\.ok && res\.code === 'limit'\) \{\n[^\n]*\n\s*setMedia\(\(list\) => list\.filter\(\(x\) => x\.id !== m\.id\)\);/);
  });
});
