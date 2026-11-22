/**
 * KVKK / çerez metinlerinin gerçek davranışla uyumu.
 *
 *  KVKK-01  KARAYS talep formu: zorunlu kutu aydınlatmanın OKUNDUĞUNU bildirir; açık rıza dili
 *           ("kabul ediyorum", "izin veriyorum", "rıza") kullanılmaz; sunucu doğrulaması aynı çizgide
 *  KVKK-02  Vercel Web Analytics VE Speed Insights yalnızca "Analitik" onayıyla yüklenir
 *  KVKK-03  Çerez tercih penceresi analitiği doğru anlatır ("kullanılmamaktadır" denmez, Vercel adı geçer)
 *  KVKK-04  Kiracı çerez politikası şablonu Vercel Analytics/Speed Insights'ı onaya bağlı analitik
 *           olarak ve koddaki zorunlu çerez / depolama adlarını listeler
 *  KVKK-05  KARAYS sayfası (aynı RootDocument → aynı ölçüm betikleri) çerez bildirimini gösterir ve
 *           KARAYS çerez politikasına bağlanır; alt bilgide "Çerez tercihleri" bağlantısı vardır
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_DEFINITIONS } from '../../src/modules/content/default-pages.ts';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

describe('KVKK / çerez metinleri', () => {
  test('KVKK-01: KARAYS formu aydınlatma onayı ister, açık rıza istemez', () => {
    const form = read('src/components/karay/karay-lead-form.tsx');
    assert.match(form, /kişisel verilerimin işlenmesine ilişkin/);
    assert.match(form, /Aydınlatma Metni[\s\S]{0,80}okudum\./);
    assert.doesNotMatch(form, /kabul ediyorum|izin veriyorum|rıza veriyorum/i);

    const action = read('src/app/actions/karay.ts');
    assert.match(action, /kvkk: z\.literal\(true, \{ message: 'Devam etmek için aydınlatma metnini okuduğunuzu işaretleyin\.' \}\)/);
  });

  test('KVKK-02: Speed Insights ve Analytics yalnızca analitik onayıyla yüklenir', () => {
    const src = read('src/components/common/vercel-insights.tsx');
    assert.match(src, /if \(!consent\) return null;/);
    // Onay kontrolünden önce hiçbir ölçüm bileşeni render edilmez
    const body = src.slice(src.indexOf('export function VercelInsights'));
    assert.ok(body.indexOf('if (!consent) return null;') < body.indexOf('<SpeedInsights'));
    assert.ok(body.indexOf('if (!consent) return null;') < body.indexOf('<Analytics'));
    // RootDocument ölçümü yalnızca bu bileşen üzerinden yükler
    const rootDoc = read('src/components/common/root-document.tsx');
    assert.doesNotMatch(rootDoc, /<SpeedInsights|<Analytics/);
  });

  test('KVKK-03: tercih penceresi analitiği doğru anlatır', () => {
    const src = read('src/components/common/cookie-consent.tsx');
    assert.doesNotMatch(src, /kullanılmamaktadır/);
    assert.match(src, /Vercel Web Analytics/);
    assert.match(src, /Speed Insights/);
    assert.match(src, /Yalnızca izin verirseniz yüklenir/);
  });

  test('KVKK-04: kiracı çerez politikası şablonu gerçek çerezleri ve onaylı analitiği listeler', () => {
    const t = PAGE_DEFINITIONS.cookies.template;
    for (const name of ['Vercel Web Analytics', 'Vercel Speed Insights', 'sb-…-auth-token', 'eg_scope', 'eg_active_org', 'eg_site_preview', 'eg:consent', 'eg:favorites', 'eg:compare', 'eg:qr-source']) {
      assert.ok(t.includes(name), `şablonda yok: ${name}`);
    }
    assert.match(t, /## Analitik \(yalnızca onayınızla\)/);
    // Koddaki çerez adlarıyla eşleşir (ad değişirse metin de güncellenmeli)
    assert.match(read('src/platform/auth/session.ts'), /SESSION_SCOPE_COOKIE = 'eg_scope'/);
    assert.match(read('src/platform/auth/session.ts'), /ACTIVE_ORG_COOKIE = 'eg_active_org'/);
    assert.match(read('src/site-config/preview.ts'), /PREVIEW_COOKIE = 'eg_site_preview'/);
    assert.match(read('src/components/forms/lead-form.tsx'), /QR_KEY = 'eg:qr-source'/);
  });

  test('KVKK-05: KARAYS sayfası çerez bildirimi ve tercih bağlantısı içerir', () => {
    const rootDoc = read('src/components/common/root-document.tsx');
    assert.match(rootDoc, /<VercelInsights \/>/);
    const layout = read('src/app/karay/layout.tsx');
    assert.match(layout, /<RootDocument/);
    assert.match(layout, /<CookieConsent policyHref=\{KARAY_COOKIE_POLICY_HREF\} \/>/);
    assert.match(layout, /KARAY_COOKIE_POLICY_HREF = '\/karay\/yasal\/cerez-politikasi'/);
    assert.match(read('src/components/karay/karay-footer.tsx'), /<CookiePreferencesLink /);
    // Kiracı sitesi varsayılan politika adresini kullanmaya devam eder
    assert.match(read('src/components/common/cookie-consent.tsx'), /policyHref = '\/cerez-politikasi'/);
    assert.match(read('src/components/site/site-frame.tsx'), /<CookieConsent \/>/);
  });
});
