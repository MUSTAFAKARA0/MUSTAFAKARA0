/**
 * FAZ 1 — Müşteri operasyonları.
 *
 *  CO-01  Kurulum bayrakları: bozuk / eksik veri = false (yanlış "tamam" gösterilmez)
 *  CO-02  Kurulum adımları: alan adı yalnızca planda varsa zorunlu; "yayına açma" KARAY adımı, zorunlu değil
 *  CO-03  Yayın adımı: yayınlanmamış taslak değişiklik varken tamam sayılmaz
 *  CO-04  İlerleme yüzdesi: yalnızca zorunlu adımlar
 *  CO-05  Müşteri durumu öncelik sırası: askıda → dikkat → davet → yayında → hazır → kurulum
 *  CO-06  Dikkat nedenleri: süresi dolmuş davet, ödeme gecikmesi, deneme bitişi, abonelik yok, bekleyen alan adı
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOnboardingFlags,
  onboardingSteps,
  onboardingProgress,
  customerStatus,
  customerIssues,
  DOMAIN_WAIT_DAYS,
} from '../../src/modules/platform/customer-status.ts';

const ALL = { company: true, logo: true, contact: true, design: true, seo: true, listing: true, published: true, pending_changes: false, domain: false, domain_available: false, live: false };
const NOW = new Date('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const base = (over = {}) => ({
  orgStatus: 'active',
  ownerPending: false,
  hasOwner: true,
  invitationStatus: 'accepted',
  subscriptionStatus: 'active',
  trialEndsAt: null,
  domainsWaiting: 0,
  domainWaitingSince: null,
  flags: { ...ALL },
  ...over,
});

describe('CO-01 kurulum bayrakları', () => {
  test('null / dizi / metin → hepsi false', () => {
    for (const raw of [null, undefined, 'x', 42, []]) {
      const f = parseOnboardingFlags(raw);
      assert.ok(Object.values(f).every((v) => v === false), JSON.stringify(raw));
    }
  });
  test('yalnızca tam true kabul edilir ("true", 1 kabul edilmez)', () => {
    const f = parseOnboardingFlags({ company: 'true', logo: 1, contact: true, unknown: true });
    assert.equal(f.company, false);
    assert.equal(f.logo, false);
    assert.equal(f.contact, true);
    assert.equal('unknown' in f, false);
  });
});

describe('CO-02 kurulum adımları', () => {
  test('alan adı planda yoksa zorunlu değil ve bağlantı yok', () => {
    const steps = onboardingSteps({ ...ALL, domain_available: false });
    const d = steps.find((s) => s.key === 'domain');
    assert.equal(d.required, false);
    assert.equal(d.href, null);
  });
  test('alan adı planda varsa zorunlu', () => {
    const d = onboardingSteps({ ...ALL, domain_available: true }).find((s) => s.key === 'domain');
    assert.equal(d.required, true);
    assert.equal(d.href, '/admin/site/alan-adi');
  });
  test('"yayına açıldı" KARAY adımıdır: zorunlu değil, ofise bağlantı yok', () => {
    const l = onboardingSteps(ALL).find((s) => s.key === 'live');
    assert.equal(l.required, false);
    assert.equal(l.href, null);
  });
  test('ofis bağlantıları yalnızca /admin altında', () => {
    for (const s of onboardingSteps({ ...ALL, domain_available: true })) {
      if (s.href) assert.match(s.href, /^\/admin\//);
    }
  });
});

describe('CO-03 yayın adımı', () => {
  test('hiç yayınlanmamış → tamam değil', () => {
    assert.equal(onboardingSteps({ ...ALL, published: false }).find((s) => s.key === 'publish').done, false);
  });
  test('yayınlanmış ama taslak değişiklik var → tamam değil', () => {
    assert.equal(onboardingSteps({ ...ALL, pending_changes: true }).find((s) => s.key === 'publish').done, false);
  });
  test('yayınlanmış ve bekleyen değişiklik yok → tamam', () => {
    assert.equal(onboardingSteps(ALL).find((s) => s.key === 'publish').done, true);
  });
});

describe('CO-04 ilerleme', () => {
  test('hepsi tamam (alan adı planda yok) → 7/7, %100', () => {
    assert.deepEqual(onboardingProgress(onboardingSteps(ALL)), { done: 7, total: 7, percent: 100 });
  });
  test('alan adı planda var ama bağlı değil → 7/8', () => {
    const p = onboardingProgress(onboardingSteps({ ...ALL, domain_available: true }));
    assert.deepEqual(p, { done: 7, total: 8, percent: 88 });
  });
  test('hiçbiri → 0', () => {
    assert.deepEqual(onboardingProgress(onboardingSteps(parseOnboardingFlags(null))), { done: 0, total: 7, percent: 0 });
  });
  test('"yayına açıldı" yüzdeyi değiştirmez', () => {
    const a = onboardingProgress(onboardingSteps({ ...ALL, live: false }));
    const b = onboardingProgress(onboardingSteps({ ...ALL, live: true }));
    assert.deepEqual(a, b);
  });
});

describe('CO-05 müşteri durumu', () => {
  test('askıda her şeyden önce gelir (sorunlar gösterilmez)', () => {
    const s = customerStatus(base({ orgStatus: 'suspended', subscriptionStatus: 'past_due' }), NOW);
    assert.equal(s.key, 'suspended');
    assert.deepEqual(s.issues, []);
  });
  test('sorun varsa dikkat', () => {
    assert.equal(customerStatus(base({ subscriptionStatus: 'past_due' }), NOW).key, 'attention');
  });
  test('sahip daveti bekliyor', () => {
    assert.equal(customerStatus(base({ ownerPending: true, invitationStatus: 'pending', flags: parseOnboardingFlags(null) }), NOW).key, 'invited');
  });
  test('yayında: site açık ve yayınlanmış', () => {
    assert.equal(customerStatus(base({ flags: { ...ALL, live: true } }), NOW).key, 'live');
  });
  test('yayına hazır: zorunlu adımlar tamam, site açılmamış', () => {
    assert.equal(customerStatus(base(), NOW).key, 'ready');
  });
  test('kurulumda: bir zorunlu adım eksik', () => {
    assert.equal(customerStatus(base({ flags: { ...ALL, logo: false } }), NOW).key, 'setup');
  });
  test('kurulumda: alan adı planda var ve bağlı değil', () => {
    assert.equal(customerStatus(base({ flags: { ...ALL, domain_available: true } }), NOW).key, 'setup');
  });
  test('yayında olan müşteride taslak değişiklik → yine yayında', () => {
    assert.equal(customerStatus(base({ flags: { ...ALL, live: true, pending_changes: true } }), NOW).key, 'live');
  });
});

describe('CO-06 dikkat nedenleri', () => {
  test('sahip yok', () => {
    assert.ok(customerIssues(base({ hasOwner: false }), NOW).includes('Aktif sahip hesabı yok'));
  });
  test('davet süresi doldu / davet gönderilmedi', () => {
    assert.ok(customerIssues(base({ ownerPending: true, invitationStatus: 'expired' }), NOW).includes('Sahip davetinin süresi doldu'));
    assert.ok(customerIssues(base({ ownerPending: true, invitationStatus: null }), NOW).includes('Sahip daveti gönderilmedi'));
    assert.ok(customerIssues(base({ ownerPending: true, invitationStatus: 'not_sent' }), NOW).includes('Sahip daveti gönderilmedi'));
    assert.deepEqual(customerIssues(base({ ownerPending: true, invitationStatus: 'pending' }), NOW), []);
  });
  test('deneme bitti: yalnızca bitiş tarihi geçmişse', () => {
    const past = new Date(NOW.getTime() - 1000).toISOString();
    const future = new Date(NOW.getTime() + DAY).toISOString();
    assert.ok(customerIssues(base({ subscriptionStatus: 'trialing', trialEndsAt: past }), NOW).includes('Deneme süresi bitti'));
    assert.deepEqual(customerIssues(base({ subscriptionStatus: 'trialing', trialEndsAt: future }), NOW), []);
    assert.deepEqual(customerIssues(base({ subscriptionStatus: 'trialing', trialEndsAt: null }), NOW), []);
  });
  test('abonelik yok', () => {
    assert.ok(customerIssues(base({ subscriptionStatus: null }), NOW).includes('Aktif abonelik yok'));
  });
  test(`alan adı ${DOMAIN_WAIT_DAYS} günden uzun bekliyor`, () => {
    const old = new Date(NOW.getTime() - (DOMAIN_WAIT_DAYS * DAY + 1000)).toISOString();
    const fresh = new Date(NOW.getTime() - (DOMAIN_WAIT_DAYS * DAY - 1000)).toISOString();
    assert.equal(customerIssues(base({ domainsWaiting: 1, domainWaitingSince: old }), NOW).length, 1);
    assert.deepEqual(customerIssues(base({ domainsWaiting: 1, domainWaitingSince: fresh }), NOW), []);
    assert.deepEqual(customerIssues(base({ domainsWaiting: 0, domainWaitingSince: old }), NOW), []);
  });
  test('site açık ama hiç yayınlanmamış', () => {
    assert.ok(customerIssues(base({ flags: { ...ALL, live: true, published: false } }), NOW).includes('Site ziyaretçilere açık ama hiç yayınlanmadı'));
  });
  test('sağlıklı müşteri: sorun yok', () => {
    assert.deepEqual(customerIssues(base({ flags: { ...ALL, live: true } }), NOW), []);
  });
});

// ---------------------------------------------------------------- F1-1 site adresi
import { readFileSync } from 'node:fs';
import { tenantBaseUrls } from '../../src/platform/tenant/host.ts';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');

describe('CO-07 sitenin kendi adresi', () => {
  const b = { slug: 'yeni-ofis', isDefault: false, siteUrl: 'https://ilk-musteri.com', karayHosts: ['karay.com.tr'] };
  test('alan adı yok, kök yok → kendi adresi YOK (siteBaseUrl başka müşterinin)', () => {
    const r = tenantBaseUrls(b);
    assert.equal(r.ownAddress, false);
    assert.equal(r.siteBaseUrl, 'https://ilk-musteri.com');
  });
  test('birincil alan adı / varsayılan kiracı / platform kökü → kendi adresi var', () => {
    assert.equal(tenantBaseUrls({ ...b, primaryDomain: 'ofis.com' }).ownAddress, true);
    assert.equal(tenantBaseUrls({ ...b, isDefault: true }).ownAddress, true);
    assert.equal(tenantBaseUrls({ ...b, platformRootDomain: 'karay.app' }).ownAddress, true);
  });
  test('Tenant.siteAddress yalnızca kendi adresi varken dolu', () => {
    assert.match(read('src/platform/tenant/tenant.ts'), /siteAddress: ownAddress \? baseUrl : null/);
  });
  test('önizleme bağlantısı kendi adresi olmadan üretilmez ve siteAddress kullanır', () => {
    const src = read('src/site-editor/preview-link.ts');
    assert.match(src, /if \(!tenant\.siteAddress\) throw new ActionError\(NO_SITE_ADDRESS\)/);
    assert.match(src, /return `\$\{tenant\.siteAddress\}\/api\/site-preview/);
    assert.doesNotMatch(src, /tenant\.baseUrl/);
  });
  test('"Siteyi aç" / geçerli adres bağlantıları başka müşterinin adresine gitmez', () => {
    for (const p of [
      'src/app/platform/(konsol)/organizasyonlar/[id]/page.tsx',
      'src/app/platform/(konsol)/siteler/[id]/alan-adi/page.tsx',
      'src/app/admin/(panel)/site/alan-adi/page.tsx',
    ]) {
      const src = read(p);
      assert.doesNotMatch(src, /href=\{tenant\.baseUrl\}/, p);
      assert.doesNotMatch(src, /fallbackUrl=\{tenant\?\.baseUrl/, p);
    }
    const list = read('src/app/platform/(konsol)/siteler/page.tsx');
    assert.match(list, /return urls\.ownAddress \? urls\.siteBaseUrl : null/);
    assert.doesNotMatch(list, /\? publicEnv\.siteUrl/);
  });
  test('canlıya çıkış kontrolü: production\'da PLATFORM_ROOT_DOMAIN zorunlu', () => {
    assert.match(read('scripts/prelaunch-check.mjs'), /if \(!env\('PLATFORM_ROOT_DOMAIN'\)\) \{\n  add\(production \? 'error'/);
  });
});

// ---------------------------------------------------------------- F1-3 müşteri listesi
import { filterCustomers, customerMetrics, isCustomerFilter, CUSTOMER_FILTERS } from '../../src/modules/platform/customers.ts';

const row = (over) => ({
  id: over.id ?? 'x',
  name: 'Ofis',
  slug: 'ofis',
  status: 'active',
  plan_id: 'baslangic',
  primary_domain: null,
  ownerEmail: null,
  ownerPending: false,
  siteStatus: 'draft',
  publishedVersion: 0,
  domainsWaiting: 0,
  customer: { key: 'setup' },
  ...over,
});

describe('CO-08 müşteri listesi arama / filtre / metrik', () => {
  const rows = [
    row({ id: '1', name: 'Işık Emlak', slug: 'isik', ownerEmail: 'sahip@isik.com', customer: { key: 'live' }, siteStatus: 'active', publishedVersion: 3, plan_id: 'kurumsal', primary_domain: 'isikemlak.com' }),
    row({ id: '2', name: 'Deniz Gayrimenkul', slug: 'deniz', ownerPending: true, customer: { key: 'invited' } }),
    row({ id: '3', name: 'Kapalı', slug: 'kapali', status: 'cancelled', customer: { key: 'suspended' }, plan_id: 'profesyonel' }),
    row({ id: '4', name: 'Yeni', slug: 'yeni', domainsWaiting: 1, customer: { key: 'attention' } }),
  ];
  test('Türkçe büyük/küçük harf duyarsız arama (I/ı, İ/i)', () => {
    assert.deepEqual(filterCustomers(rows, 'IŞIK', null).map((r) => r.id), ['1']);
    assert.deepEqual(filterCustomers(rows, 'ışık', null).map((r) => r.id), ['1']);
  });
  test('alan adı ve sahip e-postasında arar', () => {
    assert.deepEqual(filterCustomers(rows, 'isikemlak.com', null).map((r) => r.id), ['1']);
    assert.deepEqual(filterCustomers(rows, 'sahip@isik', null).map((r) => r.id), ['1']);
  });
  test('durum filtresi + arama birlikte', () => {
    assert.deepEqual(filterCustomers(rows, '', 'invited').map((r) => r.id), ['2']);
    assert.deepEqual(filterCustomers(rows, 'deniz', 'live').map((r) => r.id), []);
  });
  test('geçersiz filtre değeri kabul edilmez', () => {
    assert.equal(isCustomerFilter('live'), true);
    assert.equal(isCustomerFilter('drop table'), false);
    assert.equal(isCustomerFilter(['live']), false);
    assert.deepEqual(CUSTOMER_FILTERS.slice().sort(), ['attention', 'invited', 'live', 'ready', 'setup', 'suspended']);
  });
  test('operasyon metrikleri', () => {
    const m = customerMetrics(rows);
    assert.equal(m.total, 4);
    assert.equal(m.active, 3);
    assert.equal(m.live, 1);
    assert.equal(m.invited, 1);
    assert.equal(m.attention, 1);
    assert.equal(m.suspended, 1);
    assert.equal(m.pendingInvitations, 1);
    assert.equal(m.publishedSites, 1);
    assert.equal(m.domainsWaiting, 1);
    // Plan dağılımı kapatılmış müşteriyi saymaz
    assert.deepEqual(Object.fromEntries(m.plans), { kurumsal: 1, baslangic: 2 });
  });
});

describe('CO-09 yeni müşteri sitesi taslak açılır (teslim = KARAY yayına açar)', () => {
  const prov = read('src/modules/platform/provisioning.ts');
  test('her iki açılış yolu provisionOrganization içinde site_set_status draft çağırır', () => {
    assert.match(prov, /rpc\('site_set_status', \{ p_org: orgId as string, p_status: 'draft'/);
    assert.match(read('src/app/actions/platform.ts'), /provisionOrganization\(session, raw\)/);
    assert.match(read('src/app/actions/site-create.ts'), /provisionOrganization\(session, account\)/);
  });
  test('taslak açılamazsa sessiz geçilmez', () => {
    assert.match(prov, /if \(draft\.error\) \{\n\s+throw new ActionError/);
  });
});

describe('CO-10 ekip daveti (geçici şifre yerine)', () => {
  const users = read('src/app/actions/admin-users.ts');
  const member = read('src/modules/platform/invitations/member.ts');
  const sql = read('supabase/migrations/20261011000001_customer_operations.sql');
  const fn = (name) => {
    const start = sql.indexOf(`create or replace function public.${name}(`);
    return sql.slice(start, sql.indexOf('$$;', start));
  };
  test('e-posta varsa hesap şifresiz + doğrulanmamış açılır; geçici şifre yalnızca e-posta yoksa', () => {
    assert.match(users, /const invite = memberInvitationsAvailable\(\);\n\s+const password = invite \? null : temporaryPassword\(\);/);
    assert.match(users, /\{ email: input\.email, email_confirm: false, user_metadata: \{ full_name: input\.full_name \} \}/);
    assert.match(users, /password_change_required: !invite/);
  });
  test('davet üyelik açıldıktan SONRA gönderilir (veritabanı aktif üye şartı)', () => {
    assert.ok(users.indexOf("from('organization_members')\n      .insert(") < users.indexOf('sendMemberInvitation(ctx, userId)'));
  });
  test('istemciden yalnızca kullanıcı kimliği: organizasyon ve işlemi yapan oturumdan', () => {
    assert.match(member, /p_actor: ctx\.user\.id, p_org: ctx\.org\.id, p_user: userId/);
    assert.match(users, /export async function resendMemberInvitation\(userId: string\)/);
  });
  test('tekrar gönder: users.manage + kendine değil + sahip kuralı', () => {
    const body = users.slice(users.indexOf('export async function resendMemberInvitation'), users.indexOf('// Rol, durum, çıkarma'));
    for (const guard of ["requirePermission('users.manage')", 'assertNotSelf(ctx, userId)', 'assertOwnerRules(ctx, member.role)']) assert.ok(body.includes(guard), guard);
  });
  test('veritabanı: yalnızca sunucu anahtarı; yetki, kendine davet, sahip kuralı, etkin hesap, hız sınırı', () => {
    assert.match(sql, /revoke all on function public\.org_send_member_invitation\(uuid, uuid, uuid, text\) from public, anon, authenticated;\ngrant execute on function public\.org_send_member_invitation\(uuid, uuid, uuid, text\) to service_role;/);
    const f = fn('org_send_member_invitation');
    assert.match(f, /rp\.permission = 'users\.manage'/);
    assert.match(f, /o\.status = 'active'/);
    assert.match(f, /if p_actor = p_user then/);
    assert.match(f, /v_member\.role = 'owner' and v_actor_role <> 'owner'/);
    assert.match(f, /_invitation_account_pending\(p_user, v_email\)/);
    assert.match(f, />= 20 then/);
    // Rol istemciden gelmez: üyelikten okunur
    assert.match(f, /values \(p_org, p_user, v_email, v_member\.role, p_token_hash/);
  });
  test('"gönderildi" yalnızca e-posta sağlayıcısı kabul ettikten sonra', () => {
    assert.doesNotMatch(fn('org_send_member_invitation'), /last_sent_at, created_by\)/);
    assert.ok(member.indexOf('if (!sent.ok)') < member.indexOf("rpc('org_mark_member_invitation_sent'"));
  });
  test('sahip davet fonksiyonları yalnızca sahip satırlarını görür (ekip davetleri karışmaz)', () => {
    for (const name of ['platform_owner_invitation', 'platform_send_owner_invitation', 'platform_revoke_owner_invitation']) {
      assert.match(fn(name), /role = 'owner'/, name);
    }
    // Sahip davet kartının durum sözleşmesi değişmez (pending | expired | accepted | revoked)
    assert.doesNotMatch(fn('platform_owner_invitation'), /not_sent/);
  });
});

describe('CO-11 KARAY notları ve müşteri görünümü yetkisi', () => {
  const sql = read('supabase/migrations/20261011000001_customer_operations.sql');
  test('notlar: RLS açık, yalnızca süper admin okur/yazar, düzenleme/silme yok, yazar = oturum', () => {
    assert.match(sql, /alter table public\.platform_org_notes enable row level security;/);
    assert.match(sql, /grant select, insert on public\.platform_org_notes to authenticated;/);
    assert.doesNotMatch(sql, /grant[^;]*(update|delete)[^;]*platform_org_notes/);
    assert.match(sql, /with check \(public\.is_super_admin\(\) and author_id = \(select auth\.uid\(\)\)\)/);
  });
  test('not eylemi: süper admin + uzunluk sınırı + yazar oturumdan', () => {
    const a = read('src/app/actions/karay-admin.ts');
    const body = a.slice(a.indexOf('export async function addOrgNote'));
    assert.match(body, /requireSuperAdmin\(\)/);
    assert.match(body, /text\.length > 2000\)/);
    assert.match(body, /author_id: session\.user\.id/);
  });
  test('genel görünüm yalnızca süper admin; kurulum bayrakları ofiste settings.manage', () => {
    assert.match(sql, /platform_customer_overview\(\)[\s\S]*?perform public\.assert_super_admin\(\);/);
    const ob = sql.slice(sql.indexOf('create or replace function public.org_onboarding('));
    assert.match(ob, /public\.is_super_admin\(\) or public\.has_org_permission\(p_org, 'settings\.manage'\)/);
    assert.match(sql, /revoke all on function public\._org_onboarding_flags\(uuid\) from public, anon, authenticated;/);
  });
  test('ofis kurulum listesi yalnızca settings.manage kullanıcılarında', () => {
    const page = read('src/app/admin/(panel)/page.tsx');
    assert.match(page, /const canSetup = ctx\.can\('settings\.manage'\)/);
    assert.match(page, /canSetup \? ctx\.supabase\.rpc\('org_onboarding'/);
  });
});

// ---------------------------------------------------------------- Son kontrol (postflight) 26. satır
import { readdirSync } from 'node:fs';

describe('CO-12 son kontrol: eksik migration çökme değil HATA üretir', () => {
  const postflight = read('supabase/ops/postflight_v2.sql');
  const migrations = readdirSync(root + 'supabase/migrations').filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
  const createdIn = (table) =>
    migrations.find((f) => new RegExp(`create table (if not exists )?public\\.${table}\\b`).test(read(`supabase/migrations/${f}`)));
  test("'public.X'::regclass sabiti yalnızca ilk V2 dosyalarında oluşan tablolara başvurur (ayrıştırma anında çözülür)", () => {
    const literals = [...postflight.matchAll(/'public\.([a-z_]+)'::regclass/g)].map((m) => m[1]);
    for (const table of literals) {
      const file = createdIn(table);
      assert.ok(file, `${table} hiçbir migration'da oluşturulmuyor`);
      assert.ok(file < '20260927', `${table} ${file} içinde oluşuyor: to_regclass() kullanılmalı (tablo yokken son kontrol çöker)`);
    }
  });
  test('26. satır: not tablosu to_regclass ile; tablo yoksa önce "uygulanmamış" HATA', () => {
    const row = postflight.slice(postflight.indexOf('select 26,'));
    assert.doesNotMatch(row, /'public\.platform_org_notes'::regclass/);
    assert.ok(row.indexOf("to_regclass('public.platform_org_notes') is null") < row.indexOf('HATA: 20261011000001_customer_operations.sql uygulanmamış'));
    assert.ok(row.indexOf('HATA: 20261011000001_customer_operations.sql uygulanmamış') < row.indexOf('HATA: platform_org_notes RLS / yetki hatalı'));
  });
});
