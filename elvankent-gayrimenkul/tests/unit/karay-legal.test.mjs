/**
 * KARAYS (karays.com) yasal metinleri — 07.11.2026 hukuk araştırması sonrası.
 *  KL-01  Gerekli belgelerin hepsi var (aydınlatma, gizlilik, çerez, kullanım/hizmet, DPA, saklama-imha, başvuru, künye)
 *  KL-02  Kayıtlı olmayan "KARAYS Gayrimenkul Teknolojileri" unvanı kullanılmaz; şirket bilgisi tek yerden (KARAYS_COMPANY)
 *  KL-03  KVKK md.11'deki dokuz hak, 30 gün yanıt süresi ve Kurul'a şikâyet yolu yazılı
 *  KL-04  Çerez politikası koddaki gerçek adları ve onaya bağlı Vercel ölçümünü anlatır; "onay bandı gösterilmez" denmez
 *  KL-05  Aydınlatma metni: form kutusunun açık rıza olmadığını, yurt dışı aktarımı ve alt işleyenleri söyler
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KARAY_LEGAL, KARAYS_COMPANY, findKarayLegal } from '../../src/modules/karay/legal.ts';

const text = (slug) => findKarayLegal(slug).sections.map((s) => `${s.heading}\n${s.body}`).join('\n');
const all = KARAY_LEGAL.map((d) => text(d.slug)).join('\n');

describe('KARAYS yasal metinleri', () => {
  test('KL-01 belgeler', () => {
    assert.deepEqual(KARAY_LEGAL.map((d) => d.slug), ['kvkk', 'gizlilik', 'cerez-politikasi', 'kullanim-kosullari', 'veri-isleme-sozlesmesi', 'saklama-ve-imha', 'basvuru', 'kunye']);
    for (const d of KARAY_LEGAL) assert.ok(d.sections.length >= 2 && d.sections.every((s) => s.heading && s.body.length > 20), d.slug);
  });
  test('KL-02 unvan', () => {
    assert.doesNotMatch(all, /Gayrimenkul Teknolojileri/);
    assert.ok(all.includes(KARAYS_COMPANY.unvan));
    assert.match(text('kunye'), /6563/);
  });
  test('KL-03 haklar ve başvuru', () => {
    const k = text('kvkk');
    for (const h of ['işlenip işlenmediğini öğrenme', 'bilgi talep etme', 'amacına uygun kullanılıp', 'üçüncü kişileri bilme', 'düzeltilmesini', 'silinmesini veya yok edilmesini', 'üçüncü kişilere bildirilmesini', 'otomatik sistemlerle', 'zararın giderilmesini']) assert.ok(k.includes(h), h);
    const b = text('basvuru');
    assert.match(b, /en geç 30 gün/);
    assert.match(b, /Kişisel Verileri Koruma Kurulu'na şikâyet/);
  });
  test('KL-04 çerez politikası gerçek davranışla uyumlu', () => {
    const c = text('cerez-politikasi');
    for (const ad of ['eg:consent', 'sb-…-auth-token', 'eg_scope', 'eg_active_org', 'Vercel Web Analytics', 'Speed Insights']) assert.ok(c.includes(ad), ad);
    assert.match(c, /yalnızca[^.]*"Kabul et"/);
    assert.doesNotMatch(c, /onay bandı gösterilmez|kullanılmamaktadır/);
    const src = readFileSync(new URL('../../src/platform/auth/session.ts', import.meta.url), 'utf8');
    assert.match(src, /ACTIVE_ORG_COOKIE = 'eg_active_org'/);
  });
  test('KL-05 aydınlatma', () => {
    const k = text('kvkk');
    assert.match(k, /açık rıza değildir/);
    assert.match(k, /md\.9/);
    for (const s of ['Supabase', 'Vercel', 'Resend', 'Sentry', 'Cloudflare', 'GitHub', 'Gmail']) assert.ok(k.includes(s), s);
  });
});
