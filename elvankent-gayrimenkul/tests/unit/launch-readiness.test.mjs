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
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { tenantBaseUrls } from '../../src/platform/tenant/host.ts';

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
  test('pg_dump yetkileri korur', () => {
    const dump = wf.split('\n').find((l) => /^\s*pg_dump "\$SUPABASE_DB_URL"/.test(l));
    assert.ok(dump, 'pg_dump satırı var');
    assert.doesNotMatch(dump, /--no-privileges/);
    assert.match(dump, /--format=custom/);
  });
  test('parmak izi üretilir ve yedekle birlikte saklanır', () => {
    assert.match(wf, /backup_fingerprint\.sql/);
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
    assert.deepEqual(tenantBaseUrls({ ...base, primaryDomain: 'yeniofis.com', karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://yeniofis.com', panelBaseUrl: 'https://yeniofis.com' });
  });
  test('alan adı yoksa ve KARAY alan adı tanımlıysa panel KARAY adresinde; başka müşterinin alan adında DEĞİL', () => {
    const r = tenantBaseUrls({ ...base, karayHosts: ['karay.com.tr', 'www.karay.com.tr'] });
    assert.equal(r.panelBaseUrl, 'https://karay.com.tr');
    assert.notEqual(new URL(r.panelBaseUrl).host, 'ilk-musteri.com');
  });
  test('platform kök alan adı varsa alt alan adı', () => {
    assert.deepEqual(tenantBaseUrls({ ...base, platformRootDomain: 'KARAY.app', karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://yeni-ofis.karay.app', panelBaseUrl: 'https://yeni-ofis.karay.app' });
  });
  test('varsayılan kiracı kendi adresini kullanır', () => {
    assert.deepEqual(tenantBaseUrls({ ...base, isDefault: true, karayHosts: ['karay.com.tr'] }), { siteBaseUrl: 'https://ilk-musteri.com', panelBaseUrl: 'https://ilk-musteri.com' });
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
