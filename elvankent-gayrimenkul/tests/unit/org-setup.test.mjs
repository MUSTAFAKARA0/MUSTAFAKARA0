/**
 * PILOT · İlk kurulum ve tek seferlik tasarım seçimi (bekleyen migration I: supabase/pending/20261108000005_org_setup.sql).
 *
 *  SU-01  Durum çözümleme: bozuk / bilinmeyen satır → null (kimse akışa zorlanmaz); adım 0–4'e kırpılır; aile kimliği doğrulanır
 *  SU-02  Yönlendirme: yalnız açık kurulum + ayar yetkisi; tamamlanmış / eski ofis / satır yok → yönlendirme yok
 *  SU-03  Kilit: yalnız setup_completed + onboarding; eski (legacy) ofis ve satırsız ofis kilitlenmez; kilitli bölümler aile paketi
 *  SU-04  Devam: aday aile yoksa tasarım adımına döner; ön seçim yalnız izinli ailelerden
 *  SU-05  Sunucu sınırları: organizasyon oturumdan; panel düzeni yönlendirir; ofis işlemleri kilidi denetler; konsol akışı
 *  SU-06  Migration: var olan ofisler legacy+tamamlandı; definer + boş search_path; yetkiler; kilit tetikleyicisi; satır kilidi
 *  SU-07  Otomatik davet: açılışta mevcut güvenli davet servisi; yalnız yeni hesap; hata organizasyonu silmez; "sağlayıcı kabul etti" dili
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseOrgSetup,
  setupRequired,
  shouldRedirectToSetup,
  designLocked,
  isLockedDesignChange,
  sectionTouchesLockedKeys,
  resumeStep,
  initialFamily,
  familyToRecord,
  DESIGN_STEP,
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
  test('kapsam veritabanıyla aynı: yalnız tema ve style.origin.family; yazı tipi, renk, bileşen stili, marka, metin serbest', () => {
    const cur = { draftTheme: 'rezidans', publishedTheme: 'rezidans', draftFamily: 'sinematik-vitrin', publishedFamily: 'sinematik-vitrin' };
    assert.equal(isLockedDesignChange('theme', 'klasik', cur), true);
    assert.equal(isLockedDesignChange('theme', 'rezidans', cur), false);
    assert.equal(isLockedDesignChange('style', { origin: { family: 'klasik-guven' } }, cur), true);
    assert.equal(isLockedDesignChange('style', { hero: 'centered' }, cur), true, 'aile kaldırılamaz');
    assert.equal(isLockedDesignChange('style', { hero: 'centered', origin: { family: 'sinematik-vitrin' } }, cur), false);
    // Yayınla / taslağı geri al: mevcut taslak ya da yayın değeri yazılabilir
    assert.equal(isLockedDesignChange('theme', 'klasik', { ...cur, draftTheme: 'klasik' }), false);
    for (const s of ['typography', 'colors', 'brand', 'header', 'navigation', 'home', 'footer', 'pages', 'seo']) {
      assert.equal(sectionTouchesLockedKeys(s), false, s);
      assert.equal(isLockedDesignChange(s, { theme: 'x' }, cur), false, s);
    }
    assert.equal(sectionTouchesLockedKeys('theme'), true);
    assert.equal(sectionTouchesLockedKeys('style'), true);
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

describe('SU-08 varsayılan tasarım ≠ emlakçının seçimi (CI #224 PO-3)', () => {
  test('aile yalnız tasarım adımından ileri geçerken kaydedilir', () => {
    assert.equal(DESIGN_STEP, 2);
    for (const step of [0, 1, 2]) assert.equal(familyToRecord(step, 'sinematik-vitrin'), null, `adım ${step}`);
    assert.equal(familyToRecord(3, 'sinematik-vitrin'), 'sinematik-vitrin');
    assert.equal(familyToRecord(4, 'klasik-guven'), 'klasik-guven');
    assert.equal(familyToRecord(3, null), null);
  });
  test('istemci ve sunucu işlemi aynı kuralı kullanır (önceden işaretli aile tasarım adımına girerken gönderilmez)', () => {
    assert.match(read('src/components/admin/setup-flow.tsx'), /saveSetupStep\(next, familyToRecord\(next, chosen\?\.id \?\? null\)\)/);
    assert.doesNotMatch(read('src/components/admin/setup-flow.tsx'), /next >= 2 \? \(chosen/);
    assert.match(read('src/app/actions/setup.ts'), /saveSetupProgress\(ctx\.supabase, ctx\.org\.id, step, familyToRecord\(step, family\.data\)\)/);
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
    assert.match(actions, /await assertSectionAllowed\(ctx, section, value\);/);
    assert.match(actions, /if \(isLockedDesignChange\(section, value, current\)\) throw new ActionError\(DESIGN_LOCKED, 'design_locked'\);/);
    // Geri almada kilit reddi bağlama özel mesajla
    assert.match(actions, /Bu sürüm farklı bir tasarım kullanıyor; tasarım kilitli olduğu için bu sürüme dönülemez\./);
    assert.match(actions, /e\.code === 'design_locked'\) throw new ActionError\(ROLLBACK_DESIGN_LOCKED, 'design_locked'\)/);
    assert.match(actions, /export async function applyOfficeDesignFamily[\s\S]*?await assertDesignUnlocked\(ctx\);/);
    assert.match(read('src/app/admin/(panel)/site/tasarim/page.tsx'), /data-testid="design-locked"/);
    assert.match(read('src/app/admin/(panel)/site/layout.tsx'), /TABS\.filter\(\(t\) => t\.slug !== 'tasarim'\)/);
    assert.match(read('src/app/admin/(panel)/tasarim/onizleme/page.tsx'), /designLocked\([\s\S]*redirect\('\/admin\/site\/tasarim'\)/);
  });
  test('eski şemada okuma hata vermez (yalnız eksik şema → akış ve kilit yok); diğer hatalar fırlatılır', () => {
    const server = read('src/site-editor/setup.ts');
    assert.match(server, /if \(isMissingDesignAccessSchema\(error\)\) return \{ available: false, setup: null \};/);
    assert.match(server, /throw new ActionError\('Kurulum durumu okunamadı\. Lütfen sayfayı yenileyin\.', 'setup_read_failed'\);/);
    assert.match(read('src/modules/platform/design-access.ts'), /\['PGRST202', 'PGRST205', '42883', '42P01'\]/);
    // Aile seçilmeden tamamlanmaz
    assert.match(server, /if \(!familyId\) throw new ActionError\('Devam etmek için bir tasarım seçin\.', 'family_required'\);/);
  });
  test('sihirbazla açılan ofis: yalnız seçilen aile izinli; kurulumda o aile önceden seçili', () => {
    assert.match(read('src/app/actions/site-create.ts'), /platform_set_org_design_families', \{ p_org: orgId, p_families: \[family\] \}/);
    assert.match(read('src/app/admin/kurulum/page.tsx'), /initialFamily\(allowed, setup\.selectedFamily, site\.published\.style\.origin\?\.family \?\? null\)/);
    assert.equal(initialFamily(['sinematik-vitrin'], null, 'sinematik-vitrin'), 'sinematik-vitrin');
  });
  test('açılışta aile izni yazılamazsa uyarı sonuca taşınır (yutulmaz)', () => {
    const code = read('src/app/actions/platform.ts');
    assert.match(code, /if \(grant\.error\) \{[\s\S]*?warnings\.push\(/);
    assert.match(read('src/components/platform/org-controls.tsx'), /data-testid="create-warnings"/);
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
    assert.match(fn('org_setup_complete'), /if p_family is null then\s+raise exception 'family_required'/);
    assert.match(fn('org_setup_complete'), /v_version := public\.site_apply_design\(p_org, p_family, p_sections\);/);
    assert.match(fn('platform_reopen_org_setup'), /completed_at = null, completed_by = null,/);
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
    // Ucuz jsonb karşılaştırması oturum / süper yönetici denetiminden önce
    assert.ok(lock.indexOf("(new.draft -> 'theme') is not distinct from v_old_draft_theme") < lock.indexOf('public.is_super_admin()'));
    // Kapsam: yalnız tema ve aile
    assert.doesNotMatch(lock, /typography|colors|'hero'/);
  });
  test('tetikleyiciler işlemin sonunda; yalnız varsa (pg_trigger) kaldırılır, koşulsuz drop trigger yok', () => {
    const body = sql.slice(sql.indexOf('\ncreate table if not exists public.organization_setup ('));
    assert.doesNotMatch(body, /^drop trigger if exists/m);
    assert.match(body, /if exists \(select 1 from pg_trigger where tgname = 'organization_setup_init'/);
    const lastFn = body.lastIndexOf('create or replace function');
    for (const t of ['create trigger organization_setup_init', 'create trigger site_configs_design_lock']) assert.ok(body.indexOf(t) > lastFn, t);
    const rollback = read('supabase/ops/org_setup/05_rollback.sql');
    assert.match(rollback, /if exists \(select 1 from pg_trigger where tgname = 'site_configs_design_lock'[\s\S]*?drop trigger if exists site_configs_design_lock on public\.site_configs;/);
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
  test('arayüz "e-posta sağlayıcısı tarafından kabul edildi" der; "ulaştı" / "teslim edildi" demez', () => {
    const card = read('src/components/platform/owner-invitation.tsx');
    assert.match(card, /e-posta sağlayıcısı tarafından kabul edildi/);
    assert.doesNotMatch(card, /ulaştı|teslim edildi/);
  });
  test('gönderildi işareti yazılamazsa uyarı döner', () => {
    assert.match(service, /const marked = await session\.supabase\.rpc\('platform_mark_invitation_sent'[\s\S]*?if \(marked\.error\) \{[\s\S]*?warning:/);
  });
});
