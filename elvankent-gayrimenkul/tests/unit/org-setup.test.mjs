/**
 * PILOT · İlk kurulum ve tek seferlik tasarım seçimi (bekleyen migration I: supabase/pending/20261108000005_org_setup.sql).
 *
 *  SU-01  Durum çözümleme: bozuk / bilinmeyen satır → null (kimse akışa zorlanmaz); adım 0–4'e kırpılır; aile kimliği doğrulanır
 *  SU-02  Yönlendirme: yalnız açık kurulum + ayar yetkisi; tamamlanmış / eski ofis / satır yok → yönlendirme yok
 *  SU-03  Kilit: yalnız setup_completed + onboarding; eski (legacy) ofis ve satırsız ofis kilitlenmez; kilitli bölümler aile paketi
 *  SU-04  Devam: aday aile yoksa tasarım adımına döner; ön seçim yalnız izinli ailelerden
 *  SU-05  Sunucu sınırları: organizasyon oturumdan; panel düzeni yönlendirir; ofis işlemleri kilidi denetler; konsol akışı
 *  SU-06  Migration: var olan ofisler legacy+tamamlandı; definer + boş search_path; yetkiler; kilit tetikleyicisi; satır kilidi
 *  SU-07  Otomatik davet: açılışta mevcut güvenli davet servisi; yalnız yeni hesap; hata organizasyonu silmez; "teslim edildi" dili
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseOrgSetup,
  setupRequired,
  shouldRedirectToSetup,
  designLocked,
  isLockedSection,
  resumeStep,
  initialFamily,
  SETUP_STATES,
  SETUP_STEPS,
  LAST_SETUP_STEP,
} from '../../src/modules/onboarding/setup-state.ts';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const row = (over = {}) => ({ state: 'setup_pending', origin: 'onboarding', step: 0, selected_family: null, completed_at: null, reopened_at: null, ...over });

describe('SU-01 durum çözümleme', () => {
  test('bozuk / bilinmeyen değer null döner', () => {
    for (const raw of [null, undefined, 'x', 42, {}, { state: 'bitti' }, row({ state: 'SETUP_COMPLETED' })]) assert.equal(parseOrgSetup(raw), null);
  });
  test('beş durum tanınır; adım kırpılır; geçersiz aile kimliği atılır', () => {
    assert.deepEqual([...SETUP_STATES], ['setup_pending', 'theme_selection_pending', 'theme_selected', 'setup_completed', 'reopened_by_platform']);
    for (const state of SETUP_STATES) assert.equal(parseOrgSetup(row({ state }))?.state, state);
    assert.equal(parseOrgSetup(row({ step: 99 })).step, LAST_SETUP_STEP);
    assert.equal(parseOrgSetup(row({ step: -3 })).step, 0);
    assert.equal(parseOrgSetup(row({ step: 1.5 })).step, 0);
    assert.equal(parseOrgSetup(row({ selected_family: '../x' })).selectedFamily, null);
    assert.equal(parseOrgSetup(row({ selected_family: 'sinematik-vitrin' })).selectedFamily, 'sinematik-vitrin');
    assert.equal(parseOrgSetup(row({ origin: 'legacy' })).origin, 'legacy');
    assert.equal(parseOrgSetup(row({ origin: '?' })).origin, 'onboarding');
    assert.equal(SETUP_STEPS.length, 5);
    assert.deepEqual(SETUP_STEPS.map((s) => s.label), ['Hoş geldiniz', 'Ofis bilgileri', 'Tasarım', 'Önizleme', 'Tamamla']);
  });
});

describe('SU-02 yönlendirme', () => {
  test('yalnız açık kurulum ve ayar yetkisi yönlenir', () => {
    for (const state of ['setup_pending', 'theme_selection_pending', 'theme_selected', 'reopened_by_platform']) {
      const s = parseOrgSetup(row({ state }));
      assert.equal(setupRequired(s), true, state);
      assert.equal(shouldRedirectToSetup(s, true), true, state);
      assert.equal(shouldRedirectToSetup(s, false), false, `${state}: danışman / görüntüleyici yönlenmez`);
    }
    assert.equal(shouldRedirectToSetup(parseOrgSetup(row({ state: 'setup_completed' })), true), false);
    assert.equal(shouldRedirectToSetup(parseOrgSetup(row({ state: 'setup_completed', origin: 'legacy' })), true), false);
    // Eski şema / satırsız ofis
    assert.equal(shouldRedirectToSetup(null, true), false);
  });
});

describe('SU-03 tasarım kilidi', () => {
  test('yalnız onboarding ile tamamlanmış kurulum kilitlidir', () => {
    assert.equal(designLocked(parseOrgSetup(row({ state: 'setup_completed' }))), true);
    assert.equal(designLocked(parseOrgSetup(row({ state: 'setup_completed', origin: 'legacy' }))), false);
    assert.equal(designLocked(null), false);
    for (const state of ['setup_pending', 'theme_selection_pending', 'theme_selected', 'reopened_by_platform']) assert.equal(designLocked(parseOrgSetup(row({ state }))), false, state);
  });
  test('kilitli bölümler aile paketi; renk, marka, metin, menü, ana sayfa, SEO serbest', () => {
    for (const s of ['theme', 'style', 'typography']) assert.equal(isLockedSection(s), true, s);
    for (const s of ['colors', 'brand', 'header', 'navigation', 'home', 'footer', 'pages', 'seo']) assert.equal(isLockedSection(s), false, s);
  });
});

describe('SU-04 devam ve ön seçim', () => {
  test('aday aile yoksa önizleme / onay adımından tasarım adımına dönülür', () => {
    assert.equal(resumeStep(parseOrgSetup(row({ step: 3 }))), 2);
    assert.equal(resumeStep(parseOrgSetup(row({ step: 4, selected_family: 'klasik-guven' }))), 4);
    assert.equal(resumeStep(parseOrgSetup(row({ step: 1 }))), 1);
  });
  test('ön seçim yalnız izinli ailelerden: aday → mevcut → ilk izinli', () => {
    const allowed = ['klasik-guven', 'sinematik-vitrin'];
    assert.equal(initialFamily(allowed, 'sinematik-vitrin', 'klasik-guven'), 'sinematik-vitrin');
    assert.equal(initialFamily(allowed, 'yalin-galeri', 'klasik-guven'), 'klasik-guven');
    assert.equal(initialFamily(allowed, 'yalin-galeri', 'editoryal-luks'), 'klasik-guven');
    assert.equal(initialFamily([], 'klasik-guven', 'klasik-guven'), null);
  });
});

describe('SU-05 sunucu sınırları', () => {
  test('kurulum işlemleri organizasyonu oturumdan alır ve settings.manage ister', () => {
    const code = read('src/app/actions/setup.ts');
    assert.match(code, /requirePermission\('settings\.manage'\)/);
    assert.doesNotMatch(code, /orgId|organizationId|p_org/, 'istemciden organizasyon alınmaz');
    assert.match(code, /saveSetupProgress\(ctx\.supabase, ctx\.org\.id,/);
    assert.match(code, /completeSetup\(ctx\.supabase, ctx\.org\.id,/);
  });
  test('panel düzeni açık kurulumda /admin/kurulum\'a yönlendirir; kurulum sayfası tamamlanmışta /admin\'e döner', () => {
    assert.match(read('src/app/admin/(panel)/layout.tsx'), /if \(shouldRedirectToSetup\(setup, ctx\.can\('settings\.manage'\)\)\) redirect\('\/admin\/kurulum'\);/);
    const page = read('src/app/admin/kurulum/page.tsx');
    assert.match(page, /if \(!setup \|\| !shouldRedirectToSetup\(setup, true\)\) redirect\('\/admin'\);/);
    assert.match(page, /selectableFamilies\(ctx\.supabase, ctx\.org\.id\)/);
  });
  test('ofis tasarım işlemleri ve sayfaları kilidi denetler; tasarım sekmesi kilitliyken menüde yok', () => {
    const actions = read('src/app/actions/admin-site.ts');
    assert.match(actions, /if \(isLockedSection\(section\)\) await assertDesignUnlocked\(ctx\);/);
    assert.match(actions, /export async function applyOfficeDesignFamily[\s\S]*?await assertDesignUnlocked\(ctx\);/);
    assert.match(read('src/app/admin/(panel)/site/tasarim/page.tsx'), /data-testid="design-locked"/);
    assert.match(read('src/app/admin/(panel)/site/layout.tsx'), /TABS\.filter\(\(t\) => t\.slug !== 'tasarim'\)/);
    assert.match(read('src/app/admin/(panel)/tasarim/onizleme/page.tsx'), /designLocked\([\s\S]*redirect\('\/admin\/site\/tasarim'\)/);
  });
  test('eski şemada okuma hata vermez (tablo / fonksiyon yok → akış ve kilit yok)', () => {
    const server = read('src/site-editor/setup.ts');
    assert.match(server, /return \{ available: !isMissingDesignAccessSchema\(error\), setup: null \};/);
  });
  test('önizleme mevcut ofis önizleme çerçevesini kullanır (ikinci motor yok)', () => {
    const flow = read('src/components/admin/setup-flow.tsx');
    assert.match(flow, /src=\{`\/site-onizleme\/ofis\?\$\{new URLSearchParams\(\{ aile: chosen\.id, s: 'ana-sayfa' \}\)\}`\}/);
    assert.match(flow, /LivePreview/);
    assert.doesNotMatch(flow, /localStorage|sessionStorage/);
  });
});

describe('SU-06 migration', () => {
  const sql = read('supabase/pending/20261108000005_org_setup.sql');
  const fn = (name) => sql.slice(sql.indexOf(`create or replace function public.${name}(`), sql.indexOf('\n$$;', sql.indexOf(`create or replace function public.${name}(`)));
  test('var olan ofisler tamamlanmış (legacy) işaretlenir; var olan satıra dokunulmaz', () => {
    assert.match(sql, /insert into public\.organization_setup \(organization_id, state, origin, step, completed_at\)\nselect o\.id, 'setup_completed', 'legacy', 4, now\(\) from public\.organizations o\non conflict \(organization_id\) do nothing;/);
  });
  test('yeni ofis yalnız süper yönetici oturumuyla açılınca kurulum bekler', () => {
    assert.match(fn('organization_setup_init'), /if \(select auth\.uid\(\)\) is not null and public\.is_super_admin\(\) then/);
  });
  test('beş fonksiyon security definer ve boş search_path; RPC yetkileri', () => {
    for (const name of ['organization_setup_init', 'site_configs_design_lock', 'org_setup_progress', 'org_setup_complete', 'platform_reopen_org_setup']) {
      assert.match(fn(name), /security definer\nset search_path = ''/, name);
    }
    for (const sig of ['org_setup_progress(uuid, integer, text)', 'org_setup_complete(uuid, text, jsonb)', 'platform_reopen_org_setup(uuid, text)']) {
      assert.ok(sql.includes(`revoke all on function public.${sig} from public, anon, service_role;`), sig);
      assert.ok(sql.includes(`grant execute on function public.${sig} to authenticated;`), sig);
    }
    assert.match(sql, /revoke insert, update, delete, truncate on public\.organization_setup from authenticated;/);
  });
  test('yetki ve tek kazanan: settings.manage, satır kilidi, tamamlanmışta reddedilir; yeniden açma süper yönetici + denetim', () => {
    for (const name of ['org_setup_progress', 'org_setup_complete']) {
      const body = fn(name);
      assert.match(body, /has_org_permission\(p_org, 'settings\.manage'\)/, name);
      assert.match(body, /where s\.organization_id = p_org for update;/, name);
      assert.match(body, /if v_row\.state = 'setup_completed' then\s+raise exception 'setup_completed'/, name);
    }
    assert.match(fn('org_setup_complete'), /v_version := public\.site_apply_design\(p_org, p_family, p_sections\);/);
    const reopen = fn('platform_reopen_org_setup');
    assert.match(reopen, /perform public\.assert_super_admin\(\);/);
    assert.match(reopen, /perform public\.write_audit\(p_org, 'site\.setup_reopened'/);
  });
  test('kilit tetikleyicisi taslak ve yayında tema / aile değişimini süper yönetici olmayan oturumda reddeder', () => {
    const lock = fn('site_configs_design_lock');
    assert.match(lock, /if \(select auth\.uid\(\)\) is null or public\.is_super_admin\(\) then\s+return new;/);
    assert.match(lock, /s\.state = 'setup_completed' and s\.origin = 'onboarding'/);
    assert.match(lock, /raise exception 'design_locked' using errcode = '42501'/);
    assert.match(sql, /before update of draft, published on public\.site_configs/);
  });
});

describe('SU-07 otomatik davet', () => {
  const service = read('src/modules/platform/invitations/service.ts');
  test('açılışta mevcut davet servisi; yalnız yeni hesap; hata organizasyonu silmez', () => {
    const body = service.slice(service.indexOf('export async function sendInitialOwnerInvitation'));
    assert.match(body, /if \(ownerAccount !== 'invitation_pending'\) return \{ status: 'not_applicable' \};/);
    assert.match(body, /const sent = await sendOwnerInvitation\(session, orgId\);/);
    assert.match(body, /catch \(e\) \{\s+return \{ status: 'failed'/);
    for (const p of ['src/app/actions/platform.ts', 'src/app/actions/site-create.ts']) {
      assert.match(read(p), /await sendInitialOwnerInvitation\(session, [\w.]+, created\.ownerAccount\)/, p);
    }
    assert.doesNotMatch(service, /deleteUser|delete\(\)/);
  });
  test('arayüz "e-posta sağlayıcıya teslim edildi" der, "ulaştı" demez', () => {
    const card = read('src/components/platform/owner-invitation.tsx');
    assert.match(card, /e-posta sağlayıcıya teslim edildi/);
    assert.doesNotMatch(card, /ulaştı/);
  });
});
