/**
 * FAZ 0 — Ticari yayına hazırlık (launch readiness) birim testleri.
 *
 *  LR-01  Canlı geçiş belgesi depodaki TÜM migration'ları listeler (yeni migration unutulamaz)
 *  LR-02  Son kontrol betiği her KARAY migration'ını ayrı satırla denetler; şema sürümü son dosyayla aynı
 *  LR-03  Yedek iş akışı yetkileri korur (--no-privileges yok) ve kritik veri parmak izini yazar
 *  LR-04  Panel bağlantısı (davet): kendi adresi olmayan ofis BAŞKA müşterinin alan adına düşmez
 *  LR-05  E-posta: geçici hatada sınırlı yeniden deneme, kalıcı hatada deneme yok, aynı anahtar
 *  LR-06  Şifre sıfırlama: KARAY e-posta sağlayıcısı, güvenilir kök adres, hız sınırı, after()
 *  LR-07  Anında yayına çıkan düzenleyiciler bunu açıkça söyler (taslak sanılmaz)
 *  LR-08  CI'nin veritabanı işi E2E ön koşullarını sağlar: demo ortamı, ofis sahibi + süper admin yönetici;
 *         CI'da RLS ve E2E testleri yalnızca geçici yerel Supabase'e bağlanır (production'a yönelirse durur);
 *         CI'nin yazdığı .env.local bash ve Node tarafından aynı değerlerle okunur (K-11)
 *  LR-09  CI ve yedek iş akışlarındaki her iş sabit çalıştırıcı imajında (ubuntu-24.04) çalışır; imaj
 *         ubuntu-latest etiketiyle kendiliğinden değişmez (K-16)
 *  LR-10  KARAYS migration runbook'u (supabase/ops/karays_brand/): uygulama betiğindeki gövde migration
 *         dosyasıyla birebir aynı; okuyan betikler tek SELECT; yazan betikler tek işlem; 03 yalnızca önceki
 *         ya da kendi şema sürümünde uygular (K-17)
 *  LR-11  CI tedarik zinciri: her action tam commit SHA'sıyla sabit; Supabase CLI sürümü sabit; gitleaks
 *         arşivi SHA-256 ile doğrulanır; çalışma anında npx ile paket indirilmez (K-18)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { tenantBaseUrls } from '../../src/platform/tenant/host.ts';
import { isIndexable, showsDemoNotice } from '../../src/lib/site-env.ts';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const migrations = readdirSync(new URL('supabase/migrations/', root)).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

describe('LR-01 canlı geçiş belgesi', () => {
  test('V1 sonrası her migration dosyası belgede ve doğru sırada', () => {
    const doc = read('docs/PRODUCTION_MIGRATION.md');
    const block = doc.slice(doc.indexOf('```', doc.indexOf('## Uygulanacak dosyalar')) + 3);
    const listed = block.slice(0, block.indexOf('```')).split('\n').map((l) => l.trim()).filter(Boolean);
    const expected = migrations.filter((f) => !f.startsWith('20260922'));
    assert.deepEqual(listed, expected, 'docs/PRODUCTION_MIGRATION.md listesi migration klasörüyle aynı olmalı');
    assert.match(doc, new RegExp(`Toplam \\*\\*${expected.length} dosya\\*\\*`));
  });
  test('runbook dosya sayısı güncel', () => {
    const n = migrations.filter((f) => !f.startsWith('20260922')).length;
    const runbook = read('docs/DEPLOYMENT_RUNBOOK.md');
    assert.match(runbook, new RegExp(`\\(${n} dosya, sırayla\\)`));
  });
});

describe('LR-02 son kontrol ve şema sürümü', () => {
  const postflight = read('supabase/ops/postflight_v2.sql');
  test('2026-10-04 ve sonrası her migration son kontrolde adıyla geçer', () => {
    for (const f of migrations.filter((m) => m >= '20261004')) assert.ok(postflight.includes(f), `${f} son kontrolde yok`);
  });
  test('karay_schema_version son migration dosyasının kimliğini döndürür', () => {
    const latest = migrations.at(-1);
    const sql = read(`supabase/migrations/${latest}`);
    assert.match(sql, /function public\.karay_schema_version\(\)/, 'son migration karay_schema_version tanımlamalı');
    assert.ok(sql.includes(`'${latest.slice(0, 14)}'::text`), 'sürüm dosya kimliğiyle aynı olmalı');
  });
  test('ön kontrol (prelaunch) şema sürümünü migration klasöründen okur', () => {
    const pre = read('scripts/prelaunch-check.mjs');
    assert.match(pre, /karay_schema_version/);
    assert.match(pre, /readdirSync\(migrationsDir\)/);
  });
  test('şifre sıfırlama sınırı yalnızca sunucu anahtarıyla', () => {
    const sql = read('supabase/migrations/20261010000001_password_reset_requests.sql');
    assert.match(sql, /revoke all on function public\.auth_password_reset_allowed\(text, text\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.auth_password_reset_allowed\(text, text\) to service_role/);
    assert.match(sql, /security definer\s+set search_path = ''/);
  });
});

describe('LR-03 yedek', () => {
  const wf = read('../.github/workflows/elvankent-backup.yml');
  // Faz 3: pg_dump iş akışından scripts/backup-db.sh betiğine taşındı (iş akışı betiği çalıştırır)
  const script = read('scripts/backup-db.sh');
  test('pg_dump yetkileri korur', () => {
    const dump = script.split('\n').find((l) => /^\s*pg_dump "\$SUPABASE_DB_URL"/.test(l));
    assert.ok(dump, 'pg_dump satırı var');
    assert.doesNotMatch(dump, /--no-privileges/);
    assert.match(dump, /--format=custom/);
    assert.match(wf, /bash elvankent-gayrimenkul\/scripts\/backup-db\.sh/, 'iş akışı yedek betiğini çalıştırır');
    for (const l of wf.split('\n').filter((x) => /\bpg_dump\b/.test(x) && !/^\s*#/.test(x))) assert.doesNotMatch(l, /--no-privileges/);
  });
  test('parmak izi üretilir ve yedekle birlikte saklanır', () => {
    assert.match(script, /backup_fingerprint\.sql/);
    assert.match(wf, /fingerprint\.txt" "dest:\$BUCKET\/db\//);
  });
  test('parmak izi betiği kritik tabloları kapsar ve kişisel veri yazmaz', () => {
    const fp = read('supabase/ops/backup_fingerprint.sql');
    for (const t of ['organizations', 'organization_members', 'organization_domains', 'site_configs', 'site_config_revisions', 'properties', 'media_assets', 'leads', 'organization_invitations', 'auth.users', 'storage.objects']) {
      assert.ok(fp.includes(`'${t}'`), `${t} kapsanmalı`);
    }
    assert.doesNotMatch(fp, /\bemail\b|full_name|phone/, 'kişisel alan okunmaz');
  });
  test('belge sağlayıcı yedeğini KARAY yedeğinden ayırır ve --no-privileges kullanmaz', () => {
    const doc = read('docs/BACKUP_RESTORE.md');
    assert.match(doc, /Sağlayıcı yedeği \(Supabase\)/);
    assert.match(doc, /KARAY'ın kontrol ettiği yedek/);
    assert.match(doc, /`--no-privileges` KULLANMAYIN/);
  });
});

describe('LR-04 panel bağlantısı kökü', () => {
  const base = { slug: 'yeni-ofis', isDefault: false, siteUrl: 'https://ilk-musteri.com/', karayHosts: [] };
  test('aktif birincil alan adı varsa site ve panel o adreste', () => {
    assert.deepEqual(tenantBaseUrls({ ...base, primaryDomain: 'yeniofis.com', karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://yeniofis.com', panelBaseUrl: 'https://yeniofis.com', ownAddress: true });
  });
  test('alan adı yoksa ve KARAY alan adı tanımlıysa panel KARAY adresinde; başka müşterinin alan adında DEĞİL', () => {
    const r = tenantBaseUrls({ ...base, karayHosts: ['karay.com.tr', 'www.karay.com.tr'] });
    assert.equal(r.panelBaseUrl, 'https://karay.com.tr');
    assert.notEqual(new URL(r.panelBaseUrl).host, 'ilk-musteri.com');
  });
  test('platform kök alan adı varsa alt alan adı', () => {
    assert.deepEqual(tenantBaseUrls({ ...base, platformRootDomain: 'KARAY.app', karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://yeni-ofis.karay.app', panelBaseUrl: 'https://yeni-ofis.karay.app', ownAddress: true });
  });
  test('varsayılan kiracı kendi adresini kullanır', () => {
    assert.deepEqual(tenantBaseUrls({ ...base, isDefault: true, karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://ilk-musteri.com', panelBaseUrl: 'https://ilk-musteri.com', ownAddress: true });
  });
  test('yerel geliştirme: localhost KARAY adresi panel kökü olmaz (port kaybolur)', () => {
    assert.equal(tenantBaseUrls({ ...base, siteUrl: 'http://localhost:3000', karayHosts: ['localhost'] }).panelBaseUrl, 'http://localhost:3000');
  });
  test('davet bağlantısı panel kökünü kullanır', () => {
    assert.match(read('src/modules/platform/invitations/service.ts'), /invitationLink\(tenant\.panelBaseUrl, token\)/);
  });
});

describe('LR-05 e-posta sağlayıcısı', async () => {
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 'unit-test-key';
  process.env.RESEND_API_BASE = 'http://email.invalid';
  process.env.EMAIL_FROM = 'KARAY Test <test@example.test>';
  const email = await import('@/modules/notifications/email');
  const realFetch = globalThis.fetch;
  /** Sırayla verilen yanıtlar: sayı → HTTP durumu, 'timeout' / 'network' → istisna */
  function script(steps) {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, key: init.headers['Idempotency-Key'] ?? null, body: JSON.parse(init.body) });
      const step = steps[Math.min(calls.length - 1, steps.length - 1)];
      if (step === 'timeout') throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
      if (step === 'network') throw new TypeError('fetch failed');
      return new Response(JSON.stringify(step === 200 ? { id: `m-${calls.length}` } : { name: 'error' }), { status: step });
    };
    return calls;
  }
  const msg = { to: ['a@example.test'], subject: 'Konu', text: 't', html: '<p>t</p>' };
  const restore = () => (globalThis.fetch = realFetch);

  test('başarı: tek deneme, kimlik döner', async () => {
    const calls = script([200]);
    const r = await email.sendEmail(msg, { idempotencyKey: 'k1' });
    restore();
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].key, 'k1');
  });
  test('5xx ve zaman aşımı: yeniden denenir, AYNI anahtarla (çift e-posta yok)', async () => {
    const calls = script([503, 'timeout', 200]);
    const r = await email.sendEmail(msg, { idempotencyKey: 'davet/1' });
    restore();
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 3);
    assert.deepEqual(calls.map((c) => c.key), ['davet/1', 'davet/1', 'davet/1']);
  });
  test('429 (sağlayıcı hız sınırı) yeniden denenir; deneme sayısı sınırlı', async () => {
    const calls = script([429]);
    const r = await email.sendEmail(msg, { retries: 2 });
    restore();
    assert.equal(r.ok, false);
    assert.equal(calls.length, 3);
    assert.match(r.error, /HTTP 429/);
  });
  test('kalıcı hata (4xx: anahtar/gönderici/alıcı) yeniden denenmez', async () => {
    const calls = script([422]);
    const r = await email.sendEmail(msg);
    restore();
    assert.equal(r.ok, false);
    assert.equal(calls.length, 1);
  });
  test('ağ hatası: istisna fırlatmaz, sonuç döner; içerik loglanmaz', async () => {
    script(['network']);
    const r = await email.sendEmail(msg, { retries: 1 });
    restore();
    assert.equal(r.ok, false);
    assert.equal(r.attempts, 2);
    assert.equal(r.error, 'TypeError');
  });
  test('alıcı yoksa gönderilmez', async () => {
    const calls = script([200]);
    const r = await email.sendEmail({ ...msg, to: [] });
    restore();
    assert.equal(r.skipped, true);
    assert.equal(calls.length, 0);
  });
  test('sağlayıcıya bağımlılık tek dosyada: başka hiçbir yerde Resend API çağrısı yok', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) {
        const p = `${dir}${e.name}`;
        if (e.isDirectory()) walk(`${p}/`);
        else if (/\.(ts|tsx)$/.test(e.name) && p !== 'src/modules/notifications/email.ts' && /api\.resend\.com|resendApiBase|serverEnv\.email\.resendApiKey/.test(read(p))) offenders.push(p);
      }
    };
    walk('src/');
    assert.deepEqual(offenders.filter((p) => p !== 'src/lib/server-env.ts'), []);
  });
});

describe('LR-06 şifre sıfırlama', async () => {
  const auth = read('src/app/actions/auth.ts');
  const fn = auth.slice(auth.indexOf('export async function requestPasswordReset'), auth.indexOf('export async function updatePassword'));
  test('bağlantı güvenilir kök adresle üretilir; X-Forwarded-Host kullanılmaz', () => {
    assert.match(fn, /trustedRequestOrigin\(\)/);
    assert.doesNotMatch(auth, /x-forwarded-host/i);
  });
  test('üretim yolu: hız sınırı → after() içinde generateLink → KARAY e-posta sağlayıcısı', () => {
    const rate = fn.indexOf("rpc('auth_password_reset_allowed'");
    const later = fn.indexOf('after(');
    assert.ok(rate > 0 && later > rate, 'önce hız sınırı, sonra after()');
    // Sınır aşıldıysa bağlantı üretilmeden döner (after() kurulmaz)
    assert.match(fn.slice(rate, later), /if \(!allowed\) return \{ error: 'Çok fazla istek gönderildi/);
    const inAfter = fn.slice(later);
    assert.match(inAfter, /generateLink\(\{ type: 'recovery'/);
    assert.match(inAfter, /sendPasswordResetEmail\(/);
    assert.match(inAfter, /token_hash=\$\{encodeURIComponent\(tokenHash\)\}&type=recovery/);
  });
  test('hesap yoksa da aynı yanıt (kullanıcı listesi tahmin edilemez)', () => {
    assert.match(fn, /if \(linkError \|\| !tokenHash\) return;/);
    assert.ok((fn.match(/return \{ message: RESET_SENT_MESSAGE \}/g) ?? []).length >= 2);
  });
  test('e-posta veritabanına düz yazılmaz (tuzlu özet)', () => {
    assert.match(auth, /createHmac\('sha256', key\)\.update\(`eg-password-reset\|\$\{email\}`\)/);
  });
  test('e-posta konusu bağlantı içermez', async () => {
    const { buildPasswordResetEmail } = await import('@/modules/notifications/auth-emails');
    const link = 'https://ofis.example/admin/auth/callback?token_hash=abcdef0123456789&type=recovery&next=%2Fadmin%2Fsifre-yenile';
    const m = buildPasswordResetEmail({ link, platform: false });
    assert.doesNotMatch(m.subject, /token|http/i);
    assert.ok(m.text.includes(link));
    assert.ok(m.html.includes(link.replace(/&/g, '&amp;')));
  });
  test('güvenilir kök: yalnızca ortam adresleri, geliştirme adresleri veya çözülen kiracı', () => {
    const t = read('src/platform/tenant/tenant.ts');
    const body = t.slice(t.indexOf('export async function trustedRequestOrigin'));
    assert.match(body, /get\('host'\)/);
    assert.doesNotMatch(body.slice(0, body.indexOf('\n}\n')), /x-forwarded/i);
    assert.match(body, /return tenant \? `https:\/\/\$\{host\}` : fallback;/);
  });
});

describe('LR-07 anında yayına çıkan düzenleyiciler', () => {
  test('sayfa metni düzenleyicisi "Kaydet ve yayınla" der ve uyarı gösterir', () => {
    const s = read('src/components/admin/content/page-editor.tsx');
    assert.match(s, /<Save \/>\} Kaydet ve yayınla\s*<\/Button>/, 'düğme etiketi');
    assert.match(s, /text-\[15\.5px\] font-bold">Kaydet ve yayınla</, 'bölüm başlığı');
    assert.match(s, /taslak akışında değildir/);
    assert.match(s, /Sayfa kaydedildi ve sitede yayına alındı\./);
  });
  test('yönlendirme penceresi taslak olmadığını söyler', () => {
    assert.match(read('src/components/admin/seo/redirect-dialog.tsx'), /Taslak yoktur: kaydedildiği anda sitede etkin olur/);
  });
  test('site yönetimi › sayfalar kapsamı ayırır', () => {
    assert.match(read('src/components/site-editor/structure-forms.tsx'), /data-testid="pages-draft-scope"/);
  });
});

describe('LR-08 CI E2E ortamı', () => {
  // E2E ön koşulları (tests/e2e/acceptance.spec.ts): demo ortamı (DEMO ORTAMI şeridi, noindex) ve hem ofis
  // sahibi hem KARAY süper admini olan bir yönetici. CI bunları sağlamazsa testler yerelde geçip CI'da düşer.
  const wf = read('../.github/workflows/elvankent-ci.yml');
  const database = wf.split(/\n {2}database:\n/)[1]?.split(/\n {2}[a-z][\w-]*:\n/)[0] ?? '';
  const tmp = (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-ci-env-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
  };
  const checkEnv = (file) =>
    spawnSync(process.execPath, ['scripts/check-env-file.mjs', file], { cwd: fileURLToPath(root), encoding: 'utf8', timeout: 30_000 });
  // CI'nin .env.local'ı yazan bloğu (env_line … } > .env.local) örnek yerel Supabase değerleriyle geçici klasörde
  // çalıştırılır: testler YAML metnine değil, CI'nin gerçekten yazacağı dosyaya bakar
  const writeCiEnv = (dir) => {
    const block = database.match(/^( *)env_line\(\) \{\n[\s\S]*?^\1\} > \.env\.local$/m);
    assert.ok(block, ".env.local'ı yazan blok bulundu");
    const script = block[0].split('\n').map((l) => l.slice(block[1].length)).join('\n');
    const env = { PATH: process.env.PATH, API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'anon.ornek.imza', SERVICE_ROLE_KEY: 'servis.ornek.imza' };
    const r = spawnSync('bash', ['--noprofile', '--norc', '-c', `set -euo pipefail\n${script}`], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return path.join(dir, '.env.local');
  };
  test('veritabanı işi uygulamayı ve testleri demo ortamında çalıştırır', (t) => {
    assert.ok(database, 'database işi bulundu');
    const text = readFileSync(writeCiEnv(tmp(t)), 'utf8');
    assert.equal(text.match(/^SITE_ENV=/gm)?.length, 1, 'SITE_ENV bir kez yazılır');
    const env = parseEnv(text).SITE_ENV;
    assert.equal(env, 'demo');
    const prev = process.env.SITE_ENV;
    process.env.SITE_ENV = env;
    try {
      assert.equal(showsDemoNotice(), true, 'DEMO ORTAMI şeridi görünür');
      assert.equal(isIndexable(), false, 'noindex');
    } finally {
      if (prev === undefined) delete process.env.SITE_ENV;
      else process.env.SITE_ENV = prev;
    }
  });
  test('E2E yöneticisi ofis sahibi ve süper admin olarak oluşturulur', () => {
    const line = database.split('\n').find((l) => /npm run create-admin -- /.test(l) && !/^\s*#/.test(l));
    assert.ok(line, 'create-admin satırı var');
    assert.match(line, /--role=owner\b/);
    assert.match(line, /--super-admin\b/);
    assert.match(line, /e2e-admin@example\.test/);
    assert.match(database, /E2E_ADMIN_EMAIL: e2e-admin@example\.test/);
  });
  test("CI'da RLS ve E2E testleri yerel olmayan bir Supabase'e bağlanmadan durur", () => {
    const run = (args, env) => spawnSync(process.execPath, args, { cwd: fileURLToPath(root), env: { ...process.env, CI: 'true', ...env }, encoding: 'utf8', timeout: 60_000 });
    const remote = { NEXT_PUBLIC_SUPABASE_URL: 'https://ornek-proje.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x' };
    const config = ['--input-type=module', '-e', "await import('./playwright.config.ts')"];
    for (const args of [['tests/security/rls.test.mjs'], config]) {
      const r = run(args, remote);
      assert.notEqual(r.status, 0, args.join(' '));
      assert.match(r.stderr, /CI: NEXT_PUBLIC_SUPABASE_URL yerel değil/, args.join(' '));
    }
    // Yerel adreste koruma devreye girmez (yalnızca yapılandırma yüklenir; ağ isteği yapılmaz)
    assert.equal(run(config, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).status, 0);
  });
  test('.env.local bash ve Node tarafından aynı değerlerle okunur (K-11)', (t) => {
    const file = writeCiEnv(tmp(t));
    const r = checkEnv(file);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\d+ değişken bash ve Node tarafından aynı değerlerle okunuyor/);
    // K-11'e yol açan değer iki tarafta da aynı metin olarak okunur ("E2E hazırlık" adımı dosyayı bash ile yükler)
    const sender = 'KARAY CI <davet@example.test>';
    const sh = spawnSync('bash', ['--noprofile', '--norc', '-c', 'set -euo pipefail; set -a; . "$1"; set +a; printf %s "$EMAIL_FROM"', 'bash', file], {
      env: { PATH: process.env.PATH },
      encoding: 'utf8',
    });
    assert.equal(sh.status, 0, sh.stderr);
    assert.equal(sh.stdout, sender);
    assert.equal(parseEnv(readFileSync(file, 'utf8')).EMAIL_FROM, sender);
    // CI dosyayı yazar yazmaz, testlerden ve "E2E hazırlık" adımından önce denetler
    assert.match(database, /\} > \.env\.local\n +node scripts\/check-env-file\.mjs \.env\.local\n/);
  });
  test('denetleyici bash ile Node farklı okuduğunda durur ve değer yazdırmaz', (t) => {
    const dir = tmp(t);
    const cases = [
      // K-11'in kendisi (eski CI satırı): bash için yönlendirme ve sözdizimi hatası, Node için metin
      ['EMAIL_FROM=KARAY CI <davet@example.test>', /bash dosyayı okuyamadı \(çıkış \d+\); satır 2: EMAIL_FROM$/m],
      // iki taraf da okur ama farklı değerle: Node çift tırnak içinde \n'i satır sonuna çevirir, bash çevirmez
      ['SATIR="birinci\\nikinci-5b2e"', /^ {2}- SATIR: bash ve Node farklı değer okuyor$/m],
      // bash "true" komutunu çalıştırır ve değişkeni tanımlamaz; Node değeri "komut-degeri-3f9a true" okur
      ['KOMUT=komut-degeri-3f9a true', /^ {2}- KOMUT: bash tanımlamıyor$/m],
      // yalnızca bash'in tanımladığı değişken (Node satırı başka bir ad olarak okur)
      ['declare ICINDE=bash-degeri-9d1f', /^ {2}- ICINDE: yalnızca bash tanımlıyor$/m],
    ];
    cases.forEach(([line, expected], i) => {
      const file = path.join(dir, `durum-${i}.env`);
      writeFileSync(file, `GIZLI_ORNEK='gizli-ornek-7c1d'\n${line}\n`);
      const r = checkEnv(file);
      assert.equal(r.status, 1, `${line}: ${r.stdout}`);
      assert.match(r.stderr, expected, line);
      assert.doesNotMatch(r.stdout + r.stderr, /gizli-ornek-7c1d|davet@example|ikinci-5b2e|komut-degeri-3f9a|bash-degeri-9d1f/, `${line}: değer yazdırılmaz`);
    });
    const quoted = path.join(dir, 'tirnakli.env');
    writeFileSync(quoted, "EMAIL_FROM='KARAY CI <davet@example.test>'\n");
    assert.equal(checkEnv(quoted).status, 0, 'aynı değer tek tırnakla iki tarafta da aynı okunur');
  });
});

describe('LR-09 sabit çalıştırıcı imajı (K-16)', () => {
  // ubuntu-latest 19.10.2026'dan itibaren Ubuntu 26'ya taşınıyor. CI'nin doğruladığı ortam ubuntu-24.04'tür;
  // yeni imaj, CI'da doğrulanıp ayrı bir commit'le seçilir (etiket kendiliğinden kaymaz).
  for (const file of ['elvankent-ci.yml', 'elvankent-backup.yml']) {
    test(`${file}: her iş ubuntu-24.04 üzerinde çalışır`, () => {
      const jobs = read(`../.github/workflows/${file}`).split(/\njobs:\n/)[1] ?? '';
      const names = [...jobs.matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((m) => m[1]);
      const runners = [...jobs.matchAll(/^ {4}runs-on:(.*)$/gm)].map((m) => m[1].trim());
      assert.ok(names.length >= 2, `${file}: işler bulundu`);
      assert.equal(runners.length, names.length, `${file}: her işte runs-on var (${names.join(', ')})`);
      assert.deepEqual([...new Set(runners)], ['ubuntu-24.04']);
    });
  }
});

describe('LR-10 KARAYS migration runbook (K-17)', () => {
  // supabase/ops/karays_brand/: 20261018000001'i canlıda tek başına uygulayan betikler. Migration dosyası
  // değişip 03 değişmezse canlıya provası yapılmamış bir gövde gider; okuyan betikler canlıya yazamaz.
  const dir = 'supabase/ops/karays_brand/';
  const file = '20261018000001_karays_brand.sql';
  const prev = migrations[migrations.indexOf(file) - 1];
  // Tırnak içindeki metin (ör. üretilen 'begin;' satırları) ifade sayılmaz
  const statements = (sql) =>
    sql
      .split('\n')
      .filter((l) => !/^\s*--/.test(l))
      .join('\n')
      .replace(/'(?:[^']|'')*'/g, "''")
      .trim();
  test('03 uygulama betiğindeki migration gövdesi dosyayla birebir aynı', () => {
    const apply = read(`${dir}03_apply.sql`);
    const start = apply.indexOf(`-- ---- ${file}`);
    const end = apply.indexOf('-- ---- gövde sonu');
    assert.ok(start > 0 && end > start, 'gövde işaretleri var');
    const migration = read(`supabase/migrations/${file}`);
    // Gövde ilk ifadeyle başlar (başlıktaki yorumlu geri dönüş satırları gövde değildir)
    const bodyStart = migration.search(/^alter table /m);
    assert.ok(bodyStart > 0, 'migration gövdesi bulundu');
    assert.equal(apply.slice(apply.indexOf('\n', start) + 1, end).trim(), migration.slice(bodyStart).trim());
  });
  test('okuyan betikler (01, 02, 04) tek bir SELECT', () => {
    for (const f of ['01_preflight.sql', '02_rollback_script.sql', '04_postflight.sql']) {
      const code = statements(read(dir + f));
      assert.match(code, /^with\n/, `${f}: with … select`);
      assert.equal(code.match(/;/g)?.length, 1, `${f}: tek ifade`);
      assert.ok(code.endsWith(';'), `${f}: ifade sonda biter`);
      assert.doesNotMatch(code, /^\s*(begin|commit|insert|update|delete|alter|create|drop|grant|revoke|do)\b/im, `${f}: yazma ifadesi yok`);
      // xpath(query_to_xml(…, tableforest)) boş sonuçta hata verir ve değeri XML kaçışlı (&amp;) döndürür
      assert.doesNotMatch(code, /\bxpath\(/, `${f}: değerler xmltable ile okunur`);
      // '…'::regprocedure sorgu derlenirken çözülür: nesne yoksa CASE koruması işe yaramaz (to_regprocedure kullanılır)
      assert.doesNotMatch(code, /''::reg(procedure|class)\b/, `${f}: nesne adı sabit dönüşümle çözülmez`);
    }
  });
  test('yazan betikler (03, 05) tek işlem ve kilit zaman aşımıyla', () => {
    for (const f of ['03_apply.sql', '05_rollback.sql']) {
      const sql = read(dir + f);
      assert.match(sql, /^begin;\nset local lock_timeout = '5s';\nset local statement_timeout = '60s';$/m, f);
      assert.equal(sql.match(/^begin;$/gm)?.length, 1, `${f}: tek begin`);
      assert.equal(sql.match(/^commit;$/gm)?.length, 1, `${f}: tek commit`);
    }
  });
  test('03 yalnızca önceki ya da kendi şema sürümünde uygular (daha yenisinde sürüm geriye gitmez)', () => {
    assert.ok(prev, 'önceki migration bulundu');
    assert.match(
      read(`${dir}03_apply.sql`),
      new RegExp(`if surum is null or surum not in \\('${prev.slice(0, 14)}', '${file.slice(0, 14)}'\\) then\n\\s+raise exception 'DUR:`),
    );
  });
  test('05 genel geri dönüş bir önceki migration dosyasının şema sürümüne döner', () => {
    assert.ok(prev, 'önceki migration bulundu');
    assert.match(read(`${dir}05_rollback.sql`), new RegExp(`eski_surum +constant text := '${prev.slice(0, 14)}'`));
  });
});

describe('LR-11 CI tedarik zinciri (K-18)', () => {
  // Etiket (@v4) ve dal (@v1) taşınabilir: ele geçirilen bir etiket depodaki her iş akışında kod çalıştırır.
  // Tam commit SHA'sı çalışan kodu sabitler; yorumdaki sürüm güncelleme için okunur.
  const workflows = ['elvankent-ci.yml', 'elvankent-backup.yml'].map((f) => [f, read(`../.github/workflows/${f}`)]);
  test('her action tam commit SHA ile sabit ve sürüm yorumu taşır', () => {
    for (const [f, wf] of workflows) {
      const uses = [...wf.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)].map((m) => [m[1], m[2].trim()]);
      assert.ok(uses.length > 0, `${f}: action bulundu`);
      for (const [ref, comment] of uses) {
        assert.match(ref, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${f}: ${ref} SHA ile sabit değil`);
        assert.match(comment, /^# v\d+\.\d+\.\d+$/, `${f}: ${ref} sürüm yorumu yok`);
      }
    }
  });
  test('Supabase CLI sürümü sabit (latest/beta değil)', () => {
    const ci = workflows[0][1];
    // Adım, bir sonraki "- " ile başlayan (girintili) adımda biter; sonraki adımların version: alanı sayılmaz
    const step = ci.slice(ci.indexOf('supabase/setup-cli@')).split(/\n\s*- /)[0];
    assert.match(step, /^\s+version: \d+\.\d+\.\d+$/m);
  });
  test('gitleaks arşivi SHA-256 ile doğrulanıp öyle açılır', () => {
    const ci = workflows[0][1];
    const archive = ci.match(/gitleaks_(\d+\.\d+\.\d+)_linux_x64\.tar\.gz/)?.[0];
    assert.ok(archive, 'gitleaks arşivi bulundu');
    const check = ci.indexOf(`  ${archive}' | sha256sum -c -`);
    assert.ok(check > 0, 'arşiv özeti denetleniyor');
    assert.match(ci.slice(check - 80, check), /'[0-9a-f]{64}$/, 'özet 64 haneli SHA-256');
    assert.ok(ci.indexOf(`tar -xzf ${archive}`) > check, 'arşiv özet denetiminden sonra açılır');
    assert.doesNotMatch(ci, /curl[^\n]*\|\s*tar/, 'indirilen arşiv denetlenmeden açılmaz');
  });
  test('çalışma anında npx ile paket indirilmez', () => {
    for (const [f, wf] of workflows) assert.doesNotMatch(wf, /npx\s+(--yes|-y)\b/, f);
  });
});
