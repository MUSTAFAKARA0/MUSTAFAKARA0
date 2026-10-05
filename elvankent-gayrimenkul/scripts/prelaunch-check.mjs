#!/usr/bin/env node
/**
 * Canlıya çıkış öncesi kontrol. Hiçbir veriyi DEĞİŞTİRMEZ; yalnızca okur.
 *
 * Kullanım:
 *   npm run prelaunch                  (.env.local ile; demo/test ortamı kontrolü)
 *   npm run prelaunch -- --production  (production kuralları: demo ilan, hukuki onay vb. HATA sayılır)
 *   npm run prelaunch -- --org=ornek-ofis
 *
 * Çıkış kodu: kritik hata varsa 1 (CI veya dağıtım betiğinde kapı olarak kullanılabilir).
 * Gizli değerler ekrana yazılmaz; yalnızca tanımlı olup olmadıkları raporlanır.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    }),
);
const production = Boolean(flags.production);
// --org verilmezse DEFAULT_TENANT_SLUG, o da yoksa varsayılan olarak işaretli organizasyon (is_default)
const orgSlug = typeof flags.org === 'string' ? flags.org : process.env.DEFAULT_TENANT_SLUG?.trim() || null;

const results = [];
const add = (level, area, message) => results.push({ level, area, message });
const env = (name) => (process.env[name] ?? '').trim();

// ---------------------------------------------------------------- Ortam değişkenleri
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'IP_HASH_SALT', 'CRON_SECRET']) {
  if (!env(name)) add('error', 'env', `${name} tanımlı değil`);
}
for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'IP_HASH_SALT', 'CRON_SECRET', 'MAP_API_KEY', 'RESEND_API_KEY', 'SENTRY_DSN', 'VERCEL_API_TOKEN']) {
  if (env(`NEXT_PUBLIC_${name}`)) add('error', 'env', `NEXT_PUBLIC_${name} tanımlı: gizli değer tarayıcıya sızar, hemen kaldırın`);
}
const siteEnv = env('SITE_ENV') || (env('VERCEL_ENV') === 'production' ? 'production' : '');
if (production && siteEnv !== 'production') add('error', 'env', `SITE_ENV=production olmalı (şu an: ${siteEnv || 'tanımsız'}); aksi halde site noindex kalır`);
if (!production && siteEnv === 'production') add('warn', 'env', 'SITE_ENV=production: bu ortam arama motorlarına açık');
if (production && !/^https:\/\//.test(env('NEXT_PUBLIC_SITE_URL'))) add('error', 'env', 'NEXT_PUBLIC_SITE_URL https:// ile başlamalı');
if (env('IP_HASH_SALT') && env('IP_HASH_SALT').length < 16) add('warn', 'env', 'IP_HASH_SALT en az 16 karakter olmalı');
if (env('CRON_SECRET') && env('CRON_SECRET').length < 32) add('warn', 'env', 'CRON_SECRET en az 32 karakter olmalı');
if (env('NEXT_IMAGE_ALLOW_LOCAL_IP') === '1' && production) add('error', 'env', 'NEXT_IMAGE_ALLOW_LOCAL_IP=1 production\'da kapalı olmalı');

const mapProvider = (env('MAP_PROVIDER') || (env('MAP_TILE_URL') ? 'custom' : 'osm')).toLowerCase();
if (mapProvider === 'osm') add(production ? 'warn' : 'info', 'harita', 'Harita: OpenStreetMap genel döşemeleri (yoğun ticari kullanım için MapTiler/Stadia anahtarı önerilir)');
else if (mapProvider !== 'custom' && !env('MAP_API_KEY')) add('error', 'harita', `MAP_PROVIDER=${mapProvider} için MAP_API_KEY gerekli`);

const emailProvider = (env('EMAIL_PROVIDER') || 'none').toLowerCase();
if (emailProvider === 'none') add(production ? 'error' : 'warn', 'bildirim', 'EMAIL_PROVIDER tanımlı değil: yeni talepler e-postayla bildirilmez');
if (emailProvider === 'resend' && !env('RESEND_API_KEY')) add('error', 'bildirim', 'EMAIL_PROVIDER=resend için RESEND_API_KEY gerekli');
if (emailProvider !== 'none' && !env('EMAIL_FROM')) add('error', 'bildirim', 'EMAIL_FROM tanımlı değil (ör. "Elvankent Gayrimenkul <bildirim@alanadiniz.com>")');

if (production && emailProvider === 'log') add('error', 'bildirim', 'EMAIL_PROVIDER=log production\'da kullanılamaz (davet ve şifre sıfırlama e-postaları gönderilmez)');

// Ofis paneli bağlantıları (davet / aktivasyon): kendi adresi olmayan ofis için KARAY'ın alan adı
// kullanılır. İkisi de yoksa davet bağlantısı varsayılan kiracının (başka bir müşterinin) alan adına düşer.
if (!env('KARAY_HOSTS') && !env('PLATFORM_ROOT_DOMAIN')) {
  add(production ? 'error' : 'info', 'alan adı', 'KARAY_HOSTS (veya PLATFORM_ROOT_DOMAIN) tanımlı değil: alan adı henüz bağlanmamış ofislerin davet bağlantıları varsayılan kiracının alan adına gider');
}
if (!env('DOMAIN_TARGET_CNAME') && !env('DOMAIN_TARGET_A')) {
  add(production ? 'warn' : 'info', 'alan adı', 'DOMAIN_TARGET_CNAME / DOMAIN_TARGET_A tanımlı değil: özel alan adı bağlantısını yalnızca süper admin elle onaylayabilir');
}

if (!env('SENTRY_DSN') && !env('ERROR_WEBHOOK_URL')) add(production ? 'warn' : 'info', 'izleme', 'Hata izleme hedefi yok (SENTRY_DSN veya ERROR_WEBHOOK_URL); hatalar yalnızca Vercel loglarında görünür');

// ---------------------------------------------------------------- Veritabanı
const url = env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SERVICE_ROLE_KEY');
if (url && key) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Şema sürümü: veritabanındaki son KARAY migration'ı, depodaki son migration dosyasıyla aynı olmalı
  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
  const expectedVersion = readdirSync(migrationsDir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort().at(-1)?.slice(0, 14) ?? null;
  const { data: dbVersion, error: versionError } = await db.rpc('karay_schema_version');
  if (versionError) add('error', 'veritabanı', `Şema sürümü okunamadı (karay_schema_version yok): migration'lar eksik — docs/PRODUCTION_MIGRATION.md (beklenen ${expectedVersion})`);
  else if (expectedVersion && dbVersion !== expectedVersion) add('error', 'veritabanı', `Şema sürümü ${dbVersion}, beklenen ${expectedVersion}: eksik migration var — docs/PRODUCTION_MIGRATION.md`);
  else add('info', 'veritabanı', `Şema sürümü ${dbVersion} (güncel)`);
  const { data: org, error } = await (orgSlug ? db.from('organizations').select('id, name, status').eq('slug', orgSlug) : db.from('organizations').select('id, name, status').eq('is_default', true)).maybeSingle();
  if (error) add('error', 'veritabanı', `Bağlantı/şema hatası: ${error.message} (V2 migration'ları uygulandı mı?)`);
  else if (!org) add('error', 'veritabanı', orgSlug ? `"${orgSlug}" organizasyonu bulunamadı` : 'varsayılan organizasyon (is_default) bulunamadı');
  else {
    if (org.status !== 'active') add('error', 'veritabanı', `Organizasyon durumu: ${org.status}`);

    const demo = await db.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('is_demo', true).is('deleted_at', null);
    const real = await db.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('is_demo', false).eq('status', 'published').is('deleted_at', null);
    if (demo.count) add(production ? 'error' : 'info', 'içerik', `${demo.count} DEMO ilan var${production ? ' — canlıda Ayarlar › Demo ilanlar › "Demo ilanları kaldır"' : ''}`);
    if (production && !real.count) add('warn', 'içerik', 'Yayında gerçek ilan yok');

    const legalKeys = ['kvkk', 'privacy', 'cookies', 'terms'];
    const { data: pages } = await db.from('pages').select('key, legal_reviewed').eq('organization_id', org.id).in('key', legalKeys);
    const reviewed = new Set((pages ?? []).filter((p) => p.legal_reviewed).map((p) => p.key));
    const missing = legalKeys.filter((k) => !reviewed.has(k));
    if (missing.length) add(production ? 'error' : 'info', 'hukuk', `Hukukçu onayı bekleyen metinler: ${missing.join(', ')}`);

    const { data: s } = await db.from('organization_settings').select('phone, email, address_line').eq('organization_id', org.id).maybeSingle();
    for (const [field, label] of [['phone', 'telefon'], ['email', 'e-posta'], ['address_line', 'adres']]) {
      if (!s?.[field]) add(production ? 'warn' : 'info', 'işletme', `Şirket ${label} bilgisi boş`);
    }
    const { data: notify } = await db.from('organization_notification_settings').select('notify_new_lead, emails').eq('organization_id', org.id).maybeSingle();
    if (notify?.notify_new_lead === false) add(production ? 'warn' : 'info', 'bildirim', 'Yeni talep e-posta bildirimi kapalı');
    else if (!(notify?.emails?.length) && !s?.email) add(production ? 'error' : 'warn', 'bildirim', 'Talep bildirimi alacak e-posta adresi yok (Ayarlar › Bildirimler veya şirket e-postası)');

    const owners = await db.from('organization_members').select('user_id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('role', 'owner').eq('status', 'active');
    if (!owners.count) add('error', 'kullanıcı', 'Aktif sahip (owner) yok');
    const supers = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_super_admin', true);
    if (!supers.count) add('warn', 'kullanıcı', 'Süper admin hesabı yok (npm run create-admin -- e-posta --super-admin)');
    const { data: orgPolicy } = await db.from('organizations').select('require_admin_mfa').eq('id', org.id).maybeSingle();
    if (orgPolicy && !orgPolicy.require_admin_mfa) add(production ? 'warn' : 'info', 'güvenlik', 'Sahip/yöneticiler için iki adımlı doğrulama zorunlu değil (Kullanıcılar › Güvenlik politikası)');
  }
} else {
  add('error', 'veritabanı', 'Veritabanı kontrolleri atlandı (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok)');
}

// ---------------------------------------------------------------- Rapor
const icon = { error: '✗', warn: '!', info: '·' };
console.info(`\nCanlıya çıkış kontrolü — ${production ? 'PRODUCTION kuralları' : 'demo/test kuralları'} — organizasyon: ${orgSlug ?? 'varsayılan (is_default)'}\n`);
for (const level of ['error', 'warn', 'info']) {
  for (const r of results.filter((x) => x.level === level)) console.info(`  ${icon[level]} [${r.area}] ${r.message}`);
}
const errors = results.filter((r) => r.level === 'error').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.info(`\n${errors ? '✗' : '✓'} ${errors} kritik, ${warns} uyarı\n`);
process.exit(errors ? 1 : 0);
