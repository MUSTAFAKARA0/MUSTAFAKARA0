// 22.11.2026 hukuk uyum doğrulaması (docs/legal/HUKUK_UYUM_2026-11-22.md) — metin gerçeği söyler, EİDS paylaşım riski, çerez eşitliği,
// ilanda yetki belgesi no, özel nitelikli veri uyarısı. Bu testler kodu mevzuat araştırmasındaki kararlara sabitler.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KARAY_LEGAL } from '../../src/modules/karay/legal.ts';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const doc = (slug) => KARAY_LEGAL.find((d) => d.slug === slug).sections.map((s) => s.body).join('\n');

describe('LC-01 yurt dışı aktarım: yapılmamış işlem yapılmış gibi yazılmaz', () => {
  test('KARAYS metinleri standart sözleşmenin imzalandığını/bildirildiğini iddia etmez', () => {
    for (const slug of ['kvkk', 'veri-isleme-sozlesmesi']) {
      const t = doc(slug);
      assert.doesNotMatch(t, /uygun güvencelerle (yapılır|\(standart)/, slug);
      assert.match(t, /standart sözleşme/i, slug);
    }
    assert.match(doc('kvkk'), /Avrupa Birliği'nde barındırma da KVKK bakımından yurt dışına aktarımdır/);
    assert.match(doc('kvkk'), /yürütmektedir/);
  });
  test('ofis aydınlatma şablonu da aynı', () => {
    const t = read('src/modules/content/default-pages.ts');
    assert.doesNotMatch(t, /standart sözleşmenin imzalanması ve sözleşmenin Kurum'a bildirilmesi yoluyla gerçekleştirilir/);
    assert.doesNotMatch(t, /\[SÜRE\]/);
    assert.match(t, /KVKK md\.14/);
    assert.match(t, /WhatsApp LLC \/ Meta Platforms/);
    assert.match(t, /Elektronik İlan Doğrulama Sistemi \(EİDS\)/);
  });
  test('Resend kayıtları ABD olarak yazılır (AB değil)', () => {
    assert.match(doc('kvkk'), /Resend, Inc\.[^)]*ABD'de saklanır/);
    assert.doesNotMatch(doc('kvkk'), /Resend \(bildirim e-postası iletimi; AB\)/);
    assert.match(read('src/modules/content/default-pages.ts'), /Resend \(gönderim AB\/İrlanda; kayıtlar ABD'de saklanır\)/);
  });
  test('aydınlatma kutusu onay/rıza sayılmaz (İlke Kararı 2026/347)', () => {
    assert.match(doc('kvkk'), /yalnızca bu metni okuduğunuzu belirtir; onay veya açık rıza değildir/);
  });
});

describe('LC-02 EİDS: ofis sitesinde sosyal ağ paylaşım düğmesi yok', () => {
  test('ilan paylaşım bileşeni WhatsApp/Facebook/X paylaşım adresi ve yerel paylaşım menüsü üretmez', () => {
    const t = read('src/components/property/property-actions.tsx');
    for (const re of [/wa\.me\/\?text=/, /facebook\.com\/sharer/, /x\.com\/intent/, /navigator\.share\(/]) assert.doesNotMatch(t, re);
    assert.match(t, /İlan bağlantısını kopyala/);
  });
  test('kullanım koşulları EİDS yükümlülüğünü müşteriye yazar; KARAYS yer sağlayıcıdır', () => {
    const t = doc('kullanim-kosullari');
    assert.match(t, /Elektronik İlan Doğrulama Sistemi \(EİDS\)/);
    assert.match(t, /5651 sayılı Kanun kapsamında yer sağlayıcı/);
    assert.match(t, /ücretsiz kullanım \(pilot\/deneme\) dönemlerinde/);
  });
});

describe('LC-03 çerez bandı: reddetmek kabul etmek kadar kolay', () => {
  test('"Kabul et" ve "Reddet" aynı görünümde; politika bunu doğru anlatır', () => {
    const t = read('src/components/common/cookie-consent.tsx');
    assert.match(t, /<Button size="sm" variant="outline" onClick=\{\(\) => saveConsent\(true\)\}>\s*Kabul et/);
    assert.match(t, /<Button size="sm" variant="outline" onClick=\{\(\) => saveConsent\(false\)\}>\s*Reddet/);
    assert.match(doc('cerez-politikasi'), /"Kabul et" ve "Reddet" seçenekleri aynı görünüm ve büyüklükte/);
  });
});

describe('LC-04 yetki belgesi numarası ilan sayfasında', () => {
  test('iki ilan detay düzeni de numarayı gösterir (girildiyse)', () => {
    for (const f of ['src/components/property/property-detail-view.tsx', 'src/components/patterns/property-detail/parts.tsx']) {
      const t = read(f);
      assert.match(t, /data-testid="listing-license-no"/, f);
      assert.match(t, /Taşınmaz Ticareti Yetki Belgesi No: \{/, f);
    }
  });
});

describe('LC-05 özel nitelikli veri uyarısı (KVKK md.6)', () => {
  test('ziyaretçi mesajı ve CRM not alanlarında uyarı var', () => {
    assert.match(read('src/components/forms/lead-form.tsx'), /hint=\{VISITOR_SENSITIVE_HINT\}/);
    for (const f of ['src/components/admin/crm/customer-form.tsx', 'src/components/admin/crm/new-lead-dialog.tsx', 'src/components/admin/crm/lead-controls.tsx']) {
      assert.match(read(f), /STAFF_SENSITIVE_HINT/, f);
    }
  });
});
