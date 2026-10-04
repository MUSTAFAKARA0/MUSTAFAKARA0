/**
 * P0.3 — Site geneli SEO ve metadata taslağı.
 *
 *  SEO-01  SEO taslağı: başlık/açıklama → seo bölümü; doğrulama/paylaşım görseli → marka taslağı
 *  SEO-02  Belirteç zinciri: ikinci yazım ilkinin döndürdüğü belirteçle; değişmeyen kısım yazılmaz
 *  SEO-03  Eski belirteç → stale_draft (PT409) mesajı; yetkisiz kayıt reddedilir
 *  SEO-04  Yayın / geri alma: SEO ayrı yol değil (site_publish / site_rollback + seo bölümü)
 *  SEO-05  Metadata üretici: önizleme = taslak, yayın = canlı (aynı saf fonksiyon, farklı veri)
 *  SEO-06  OG başlık/açıklama/görsel, doğrulama, robots (önizleme noindex), kanonik
 *  SEO-07  /og, site simgesi, manifest: önizleme yalnızca imzalı çerezle; önizleme önbelleğe girmez
 *  SEO-08  JSON-LD önizlemede taslak markadan; sitemap / robots yalnızca canlı
 *  SEO-09  Tek kaynak: eski organization_settings.seo_* artık okunmaz; /admin/seo anlık yazmaz
 *  SEO-10  Veritabanı: doğrudan canlı SEO yazımı reddi, SEO yetkisinin sınırlı taslağı, migration
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const ORG = '33333333-3333-4333-8333-333333333333';

const LIVE = { organization_id: ORG, display_name: 'Canlı Ofis', google_site_verification: 'canliKod_123456', og_image_url: null, primary_color: '#112233', accent_color: '#445566' };

function fakeDb({ draft = {}, rpcError = null } = {}) {
  const calls = [];
  let n = 0;
  return {
    calls,
    rpc(name, args) {
      calls.push({ name, args });
      if (rpcError && rpcError(name, args)) return Promise.resolve({ data: null, error: { code: 'PT409', message: rpcError(name, args) } });
      n += 1;
      return Promise.resolve({ data: name === 'site_save_draft' ? `T${n}` : 9, error: null });
    },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data: table === 'site_configs' ? { draft } : table === 'organization_settings' ? LIVE : null, error: null }),
      };
      return q;
    },
  };
}

const service = await import('@/site-editor/service');
const meta = await import('@/modules/seo/site-metadata');
const { mapDbError } = await import('@/platform/actions');
const { parseSiteConfig } = await import('@/site-config/schema');
const { applyBrandDraft } = await import('@/site-config/brand');

const saves = (db) => db.calls.filter((c) => c.name === 'site_save_draft');

describe('SEO-01/02: SEO taslağı ve belirteç zinciri', () => {
  test('başlık/açıklama seo bölümüne, doğrulama marka taslağına; ikinci yazım ilkinin belirteciyle', async () => {
    const db = fakeDb({ draft: { seo: { title: 'Eski', robots: 'noindex', schemaType: 'LocalBusiness' } } });
    const token = await service.saveSeoDraft(db, ORG, { title: 'Yeni başlık', description: 'Yeni açıklama', googleSiteVerification: 'yeniKod_1234567' }, 'T0');
    const [a, b] = saves(db);
    assert.equal(a.args.p_section, 'seo');
    assert.equal(a.args.p_expected_updated_at, 'T0');
    // İndeksleme ve şema türü korunur (yalnızca başlık/açıklama değişir)
    assert.deepEqual(a.args.p_value, { title: 'Yeni başlık', description: 'Yeni açıklama', robots: 'noindex', schemaType: 'LocalBusiness' });
    assert.equal(b.args.p_section, 'brand');
    assert.deepEqual(b.args.p_value, { google_site_verification: 'yeniKod_1234567' });
    assert.equal(b.args.p_expected_updated_at, 'T1', 'ikinci yazım ilk yazımın belirteciyle yapılmalı');
    assert.equal(token, 'T2', 'istemciye en güncel belirteç dönmeli');
    assert.ok(!db.calls.some((c) => /publish|rollback/.test(c.name)), 'taslak kaydı yayın çağırdı');
  });

  test('değişmeyen kısım yazılmaz (gereksiz 409 ve sahte bekleyen değişiklik yok)', async () => {
    const db = fakeDb({ draft: { seo: { title: 'Aynı', description: 'Aynı açıklama', robots: 'index', schemaType: 'RealEstateAgent' } } });
    const token = await service.saveSeoDraft(db, ORG, { title: 'Aynı', description: 'Aynı açıklama', googleSiteVerification: LIVE.google_site_verification }, 'T0');
    // seo bölümü aynı → yazılmaz; doğrulama canlıyla aynı → marka taslağına boş nesne yazılır (bekleyen yok)
    assert.ok(!saves(db).some((c) => c.args.p_section === 'seo'));
    const brand = saves(db).find((c) => c.args.p_section === 'brand');
    assert.deepEqual(brand.args.p_value, {});
    assert.equal(brand.args.p_expected_updated_at, 'T0');
    assert.equal(token, 'T1');
  });

  test('boş başlık = varsayılana dön (seo.title kaldırılır); şemaya uymayan değer veritabanına gitmez', async () => {
    const db = fakeDb({ draft: { seo: { title: 'Var', robots: 'index', schemaType: 'RealEstateAgent' } } });
    await service.saveSeoDraft(db, ORG, { title: '' });
    assert.equal(saves(db)[0].args.p_value.title, undefined);
    await assert.rejects(() => service.saveSeoDraft(fakeDb(), ORG, { title: 'x'.repeat(71) }));
    await assert.rejects(() => service.saveSeoDraft(fakeDb(), 'kimlik-degil', { title: 'A' }), /Geçersiz site/);
  });
});

describe('SEO-03: eski belirteç ve yetki', () => {
  test('veritabanı stale_draft döndürürse kullanıcıya açık mesaj; ikinci yazım yapılmaz', async () => {
    const db = fakeDb({ rpcError: (name, a) => (name === 'site_save_draft' && a.p_section === 'seo' ? 'stale_draft' : null) });
    await assert.rejects(() => service.saveSeoDraft(db, ORG, { title: 'A', googleSiteVerification: 'kodKodKod_12' }, 'ESKI'), /siz açtıktan sonra değiştirildi/);
    assert.equal(saves(db).length, 1);
    assert.match(mapDbError({ message: 'stale_draft' }), /siz açtıktan sonra/);
  });

  test('/admin/seo işlemi seo.manage ister, kurum oturumdan; ayar tablosuna doğrudan yazmaz', () => {
    const src = read('src/app/actions/admin-content.ts');
    const body = src.slice(src.indexOf('export async function saveSeoSettings(')).split('\nexport ')[0];
    assert.match(body, /requirePermission\('seo\.manage'\)/);
    assert.match(body, /saveSeoDraft\(\s*ctx\.supabase,\s*ctx\.org\.id,/);
    assert.match(body, /return \{ draftToken \}/);
    assert.doesNotMatch(body, /from\('organization_settings'\)/);
    assert.doesNotMatch(body.split('\n')[0], /org|tenant/i);
  });

  test('form her başarılı kayıttan sonra dönen belirteci kullanır (art arda kayıt 409 üretmez)', () => {
    const form = read('src/components/admin/seo/seo-settings-form.tsx');
    assert.match(form, /saveSeoSettings\([\s\S]*?token\.current\)/);
    assert.match(form, /if \(res\.data\?\.draftToken\) token\.current = res\.data\.draftToken;/);
  });
});

describe('SEO-04: yayın ve geri alma ortak yol', () => {
  test('seo bölümü taslak bölümüdür; yayın taslağın tamamını, geri alma sürümün tamamını uygular', () => {
    const svc = read('src/site-editor/service.ts');
    assert.match(svc, /db\.rpc\('site_save_draft', draftArgs\(orgId, 'seo', parsed\.data, token\)\)/);
    const mig = readdirSync(root + 'supabase/migrations').filter((f) => f.endsWith('.sql')).sort().map((f) => read('supabase/migrations/' + f)).join('\n');
    const lastPublish = [...mig.matchAll(/create or replace function public\.site_publish\([\s\S]*?\n\$\$;/g)].pop()[0];
    assert.match(lastPublish, /set published = v_config, draft = v_config/);
    assert.match(lastPublish, /perform public\.site_apply_brand\(p_org, v_row\.draft -> 'brand'\);/);
    const lastRollback = [...mig.matchAll(/create or replace function public\.site_rollback\([\s\S]*?\n\$\$;/g)].pop()[0];
    assert.match(lastRollback, /set published = v_config, draft = v_config/);
    assert.match(lastRollback, /perform public\.site_apply_brand\(p_org, v_config -> 'brand'\);/);
  });
});

const baseInput = {
  settings: { display_name: 'Örnek Ofis', description: 'Canlı açıklama', service_area: 'Ankara', favicon_url: null, og_image_url: null, google_site_verification: 'canliKod_123456', updated_at: '2026-10-07T10:00:00Z' },
  seo: { title: 'Canlı SEO', description: 'Canlı SEO açıklaması', robots: 'index' },
  baseUrl: 'https://ornek-ofis.example',
  indexable: true,
  active: true,
  preview: false,
};

describe('SEO-05/06: metadata üretici (önizleme = taslak, yayın = canlı)', () => {
  test('yayın verisi → yayın metadata; taslak verisi → önizleme metadata (aynı fonksiyon)', () => {
    const pub = meta.buildSiteMetadata(baseInput);
    assert.equal(pub.title.default, 'Canlı SEO');
    assert.equal(pub.description, 'Canlı SEO açıklaması');
    assert.equal(pub.openGraph.title, 'Canlı SEO');
    assert.equal(pub.openGraph.description, 'Canlı SEO açıklaması');
    assert.equal(pub.twitter.title, 'Canlı SEO');
    assert.equal(pub.robots, undefined, 'yayında indekslenebilir olmalı');
    assert.deepEqual(pub.verification, { google: 'canliKod_123456' });

    const draftCfg = parseSiteConfig({ seo: { title: 'Taslak SEO', description: 'Taslak açıklama' } });
    const prev = meta.buildSiteMetadata({ ...baseInput, seo: draftCfg.seo, preview: true });
    assert.equal(prev.title.default, 'Taslak SEO');
    assert.equal(prev.openGraph.title, 'Taslak SEO');
    assert.deepEqual(prev.robots, { index: false, follow: false }, 'önizleme noindex değil');
    assert.equal(prev.verification, undefined, 'önizleme doğrulama etiketi yaymamalı');
  });

  test('robots: önizleme, demo ortamı, bakım ve noindex ayarı kapalı; diğerleri açık', () => {
    assert.equal(meta.siteNoindex({ ...baseInput }), false);
    assert.equal(meta.siteNoindex({ ...baseInput, preview: true }), true);
    assert.equal(meta.siteNoindex({ ...baseInput, indexable: false }), true);
    assert.equal(meta.siteNoindex({ ...baseInput, active: false }), true);
    assert.equal(meta.siteNoindex({ ...baseInput, seo: { ...baseInput.seo, robots: 'noindex' } }), true);
  });

  test('varsayılanlar: başlık/açıklama yoksa ad ve açıklamadan; doğrulama yoksa ortam değeri', () => {
    const m = meta.buildSiteMetadata({ ...baseInput, seo: { robots: 'index' }, settings: { ...baseInput.settings, google_site_verification: null }, envVerification: 'ortamKodu_1234' });
    assert.equal(m.title.default, 'Örnek Ofis | Satılık ve kiralık gayrimenkuller');
    assert.equal(m.description, 'Canlı açıklama');
    assert.deepEqual(m.verification, { google: 'ortamKodu_1234' });
  });

  test('paylaşım görseli: yüklenen görsel; yoksa üretilen görsel — önizlemede ayrı adres', () => {
    const gen = meta.buildSiteMetadata(baseInput).openGraph.images[0];
    assert.match(gen.url, /^\/og\?v=[a-z0-9]+$/);
    const genPrev = meta.buildSiteMetadata({ ...baseInput, preview: true }).openGraph.images[0];
    assert.match(genPrev.url, /^\/og\?v=[a-z0-9]+&onizleme=1$/);
    const custom = meta.buildSiteMetadata({ ...baseInput, settings: { ...baseInput.settings, og_image_url: 'organizations/x/branding/og-1200x630.jpg' } }).openGraph.images[0];
    assert.match(custom.url, /og-1200x630\.jpg$/);
  });

  test('kanonik: metadataBase kiracının çözümlenmiş adresi; düzen kanonik/og:url vermez (alt sayfalara yanlış miras yok)', () => {
    const m = meta.buildSiteMetadata(baseInput);
    assert.equal(String(m.metadataBase), 'https://ornek-ofis.example/');
    assert.equal(m.alternates, undefined);
    assert.equal(m.openGraph.url, undefined);
    // Kod tabanında sabit kiracı alan adı yok
    for (const f of ['src/modules/seo/site-metadata.ts', 'src/modules/seo/og.ts', 'src/app/t/[tenant]/layout.tsx', 'src/app/t/[tenant]/sitemap.xml/route.ts', 'src/app/t/[tenant]/robots.txt/route.ts']) {
      assert.doesNotMatch(read(f), /elvankentgayrimenkul\.com/, f);
    }
  });

  test('kiracı düzeni metadata\'yı tek üreticiden alır; önizlemede taslak (tenant + view.config.seo)', () => {
    const layout = read('src/app/t/[tenant]/layout.tsx');
    assert.match(layout, /buildSiteMetadata\(\{[\s\S]*?settings: tenant\.settings,[\s\S]*?seo: view\.config\.seo,[\s\S]*?preview: view\.preview/);
    assert.match(layout, /const tenant = await requireSiteTenant\(/);
    assert.doesNotMatch(layout, /seo_title|seo_description/);
    const load = read('src/site-config/load.ts');
    assert.match(load, /const raw: unknown = draft \?\? tenant\.site\.published;/);
  });
});

describe('SEO-07: /og, site simgesi, manifest önizleme güvenliği', () => {
  test('rotalar önizleme destekli kiracıyı kullanır; önizleme yanıtı önbelleğe girmez', () => {
    for (const f of ['src/app/t/[tenant]/og/route.tsx', 'src/app/t/[tenant]/site-icon/route.ts', 'src/app/t/[tenant]/site-icon/apple/route.tsx', 'src/app/t/[tenant]/manifest.webmanifest/route.ts']) {
      const src = read(f);
      assert.match(src, /siteTenantForRoute\(/, f);
      assert.match(src, /routeCacheControl\(preview,/, f);
      assert.doesNotMatch(src, /searchParams|onizleme/, `${f}: sorgu parametresiyle taslak açılmamalı`);
    }
  });

  test('taslak yalnızca imzalı önizleme çerezi bu kiracıya aitse (sayfalarla aynı kural)', () => {
    const load = read('src/site-config/load.ts');
    const fn = load.slice(load.indexOf('export async function siteTenantForRoute'));
    assert.match(fn, /const draft = await loadPreviewDraft\(base\.id\);/);
    assert.match(load, /if \(verifyPreviewToken\(token\) !== orgId\) return null;/);
    assert.match(load, /enabled = \(await draftMode\(\)\)\.isEnabled;/);
    // Draft mode kapalıyken (herkese açık istek) taslak ASLA okunmaz
    assert.match(load, /if \(!enabled\) return null;/);
    assert.match(load, /const token = \(await cookies\(\)\)\.get\(PREVIEW_COOKIE\)\?\.value;/);
  });

  test('önbellek başlığı: önizleme private/no-store, yayın değişmez', async () => {
    const src = read('src/site-config/load.ts');
    assert.match(src, /return preview \? 'private, no-store' : published;/);
  });
});

describe('SEO-08: JSON-LD, sitemap, robots', () => {
  test('JSON-LD önizlemede taslak markayı alır (applyBrandDraft); sayfa önizleme destekli kiracıyı kullanır', () => {
    const merged = applyBrandDraft({ display_name: 'Canlı', phone: '1', email: 'a@b.c' }, { display_name: 'Taslak Ad', phone: '2' });
    assert.equal(merged.display_name, 'Taslak Ad');
    assert.equal(merged.phone, '2');
    const home = read('src/app/t/[tenant]/page.tsx');
    assert.match(home, /organizationJsonLd\(tenant,/);
    assert.match(home, /requireSiteTenant\(/);
  });

  test('sitemap ve robots yalnızca yayındaki kiracıyı okur (taslak / önizleme yok)', () => {
    for (const f of ['src/app/t/[tenant]/sitemap.xml/route.ts', 'src/app/t/[tenant]/robots.txt/route.ts']) {
      const src = read(f);
      assert.match(src, /getTenant\(/, f);
      assert.doesNotMatch(src, /siteTenantForRoute|withPreviewBrand|requireSiteTenant|draft/i, f);
    }
  });
});

describe('SEO-09: tek kaynak', () => {
  test('eski organization_settings.seo_title / seo_description kiracı sitesinde ve ofis SEO ekranında okunmaz', () => {
    for (const f of ['src/modules/seo/site-metadata.ts', 'src/app/t/[tenant]/layout.tsx', 'src/app/admin/(panel)/seo/page.tsx', 'src/app/admin/(panel)/site/seo/page.tsx', 'src/app/platform/(konsol)/siteler/[id]/seo/page.tsx']) {
      assert.doesNotMatch(read(f), /seo_title|seo_description/, f);
    }
  });

  test('SEO ekranı taslaktan okur, yayındaki değeri gösterir, ayrı yayın düğmesi yoktur', () => {
    const page = read('src/app/admin/(panel)/seo/page.tsx');
    assert.match(page, /getSiteAdmin\(ctx, ctx\.org\.id\)/);
    assert.match(page, /site\.draft\.seo\.title/);
    assert.match(page, /site\.published\.seo\.title/);
    assert.match(page, /<SiteStatusCards/);
    assert.doesNotMatch(page, /PublishButton|publishOfficeSite/);
  });
});

/** Bir fonksiyonun migration'lardaki SON tanımı */
function lastDefinition(fn) {
  let def = null;
  for (const f of readdirSync(root + 'supabase/migrations').filter((x) => x.endsWith('.sql')).sort()) {
    const sql = read('supabase/migrations/' + f);
    for (const m of sql.matchAll(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\n\\$\\$;`, 'g'))) def = m[0];
  }
  return def;
}

describe('SEO-10: veritabanı', () => {
  test('doğrudan canlı SEO yazımı reddedilir (paylaşım görseli istisnası yok; eski SEO sütunları donduruldu)', () => {
    const guard = lastDefinition('organization_settings_guard');
    assert.match(guard, /f = any \(public\.site_brand_columns\(\)\) or f in \('seo_title', 'seo_description'\)/);
    assert.match(guard, /brand_requires_publish/);
    assert.match(lastDefinition('site_brand_columns'), /'google_site_verification'/);
    assert.match(lastDefinition('site_brand_columns'), /'og_image_url'/);
  });

  test('SEO yetkisi yalnızca seo bölümü ve marka taslağında SEO alanları; yayın/geri alma settings.manage', () => {
    const save = lastDefinition('site_save_draft');
    assert.match(save, /has_org_permission\(p_org, 'seo\.manage'\)\s+and p_section in \('seo', 'brand'\)/);
    assert.match(save, /if not v_full and p_section = 'brand' and exists \(/);
    assert.match(save, /keys\.k <> all \(public\.site_seo_brand_columns\(\)\)/);
    assert.match(lastDefinition('site_seo_brand_columns'), /array\['og_image_url', 'google_site_verification'\]/);
    for (const fn of ['site_publish', 'site_rollback']) assert.match(lastDefinition(fn), /perform public\.assert_site_editor\(p_org\);/);
  });

  test('migration geriye uyumlu: eski SEO değerleri yalnızca boşsa seo bölümüne kopyalanır, sütunlar silinmez', () => {
    const sql = read('supabase/migrations/20261007000001_seo_draft.sql');
    assert.match(sql, /coalesce\(nullif\(p_config -> 'seo' ->> 'title', ''\), p_title\)/);
    assert.match(sql, /update public\.site_configs c\s+set published = public\._p03_merge_seo/);
    assert.match(sql, /update public\.site_config_revisions r/);
    assert.doesNotMatch(sql, /drop column|delete from|truncate/i);
  });
});
