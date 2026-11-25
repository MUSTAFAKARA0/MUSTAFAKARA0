/**
 * Faz 2: iskelet ve kanca uyumu.
 *  - Her CARD_LAYOUTS değeri için site-ui.css'te iskelet varyantı bulunur (varsayılan "standard" kural dışıdır).
 *    Varyant, ızgaranın data-sk-layout özniteliğiyle seçilir; genel site-ui.css hiçbir data-site-* tema/varyant
 *    seçicisi taşımaz (Site Factory izolasyonu — SURF-11, SF-03).
 *  - İskelet işaretlemesi E2E sayaçlarının kullandığı .property-card / .listing-grid sınıflarını kullanmaz.
 *  - Tema imzalarının ve E2E'nin dayandığı kancalar bileşenlerde durur.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CARD_LAYOUTS } from '@/theme-engine/ids';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const css = read('src/styles/site-ui.css');

describe('Faz 2 › iskelet', () => {
  for (const layout of CARD_LAYOUTS.filter((l) => l !== 'standard')) {
    test(`SK-01 ${layout}: iskelet varyantı vardır`, () => {
      assert.ok(css.includes(`[data-sk-layout='${layout}'] .pcs`), `${layout} için .pcs kuralı yok`);
    });
  }

  test('SK-04 site-ui.css tema/varyant seçicisi taşımaz (izolasyon); iskelet düzeni sunucudan verilir', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\[data-site-[a-z-]+=/.test(rules), 'site-ui.css içinde data-site-* öznitelik seçicisi var');
    assert.match(read('src/components/property/skeletons/card-skeleton.tsx'), /data-sk-layout=\{layout\}/);
    assert.match(read('src/app/t/[tenant]/[slug]/page.tsx'), /<ListingPageSkeleton layout=\{style\.cardLayout\} image=\{style\.image\} \/>/);
  });

  test('SK-02 iskelet işaretlemesi gerçek kart kancalarını kullanmaz', () => {
    for (const f of ['src/components/property/skeletons/card-skeleton.tsx', 'src/components/property/skeletons/page-skeletons.tsx']) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
      assert.ok(!/className=["'{`][^"'`}]*(property-card|listing-grid|site-media)/.test(code), `${f} gerçek kart sınıfı kullanıyor`);
    }
  });

  test('SK-03 loading.tsx yalnızca durum kodunu bozmayan rotalarda (ilan detayı, bölgeler)', () => {
    for (const [dir, name] of [
      ['ilan/[slug]', 'DetailPageSkeleton'],
      ['bolgeler', 'RegionsPageSkeleton'],
    ]) {
      assert.ok(read(`src/app/t/[tenant]/${dir}/loading.tsx`).includes(name));
    }
    // [slug] (liste) ve blog dizini notFound()/yönlendirme yapar: loading.tsx yumuşak 404 üretir
    for (const dir of ['[slug]', 'blog']) {
      assert.ok(!existsSync(new URL(`../../src/app/t/[tenant]/${dir}/loading.tsx`, import.meta.url)), `${dir}/loading.tsx olmamalı`);
    }
  });

  test('SK-04 imza ve E2E kancaları yerinde', () => {
    const card = read('src/components/property/property-card.tsx');
    for (const hook of ['property-card', 'pc-media', 'site-media', 'pc-body', 'pc-price', 'pc-title']) assert.ok(card.includes(hook), hook);
    assert.ok(read('src/components/property/property-grid.tsx').includes('listing-grid'));
    const listing = read('src/components/site/site-listing.tsx');
    assert.ok(listing.includes('id="sonuclar"') && listing.includes('Arama sonuçları'));
  });
});
