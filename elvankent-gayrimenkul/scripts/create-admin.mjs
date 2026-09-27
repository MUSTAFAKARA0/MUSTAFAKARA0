#!/usr/bin/env node
/**
 * Yönetici hesabı oluşturur (veya mevcut hesabın şifresini günceller) ve
 * organizasyona üye yapar. İsteğe bağlı olarak platform süper admin yetkisi verir.
 *
 * Kullanım:
 *   npm run create-admin -- ornek@eposta.com 'Güçlü-Bir-Şifre-123'
 *   npm run create-admin -- ornek@eposta.com 'Şifre' --org=elvankent --role=owner --name="Ad Soyad"
 *   npm run create-admin -- ornek@eposta.com 'Şifre' --super-admin          (platform yöneticisi)
 *   npm run create-admin -- ornek@eposta.com 'Şifre' --super-admin --no-org (yalnızca platform)
 *
 * Seçenekler:
 *   --org=<kısa-ad>   Üye yapılacak organizasyon (varsayılan: DEFAULT_TENANT_SLUG veya "elvankent")
 *   --role=<rol>      owner | admin | agent | editor | viewer (varsayılan: owner)
 *   --name=<ad>       Profil adı
 *   --super-admin     Platform süper admin yetkisi verir (/platform)
 *   --no-org          Organizasyon üyeliği eklemez
 *
 * Gerekli ortam değişkenleri (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Not: Bu betik yalnızca kendi bilgisayarınızda / sunucuda çalıştırılmalıdır.
 * service_role anahtarı hiçbir zaman tarayıcıya veya git deposuna konmamalıdır.
 * Şifre ekrana veya loglara yazdırılmaz.
 */
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.length ? v.join('=') : true];
    }),
);
const [email, password] = positional;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROLES = ['owner', 'admin', 'agent', 'editor', 'viewer'];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı (.env.local).');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Kullanım: npm run create-admin -- eposta@ornek.com 'Sifre' [--org=kisa-ad] [--role=owner] [--super-admin]");
if (!password || password.length < 10 || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) {
  fail('Şifre en az 10 karakter olmalı ve harf ile rakam içermelidir.');
}
const role = typeof flags.role === 'string' ? flags.role : 'owner';
if (!ROLES.includes(role)) fail(`Geçersiz rol: ${role}. Seçenekler: ${ROLES.join(', ')}`);
const orgSlug = typeof flags.org === 'string' ? flags.org : process.env.DEFAULT_TENANT_SLUG || 'elvankent';
const fullName = typeof flags.name === 'string' ? flags.name.trim().slice(0, 100) : null;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Kullanıcılar listelenemedi: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUserByEmail(email);
if (user) {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) fail(`Şifre güncellenemedi: ${error.message}`);
  console.info(`• Mevcut kullanıcı bulundu, şifresi güncellendi: ${email}`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (error) fail(`Kullanıcı oluşturulamadı: ${error.message}`);
  user = data.user;
  console.info(`• Kullanıcı oluşturuldu: ${email}`);
}

// Şifreyi yönetici belirlediği için ilk girişte değiştirme zorunluluğu kaldırılır
const profilePatch = { id: user.id, password_change_required: false };
if (fullName) profilePatch.full_name = fullName;
if (flags['super-admin']) profilePatch.is_super_admin = true;
const { error: profileError } = await supabase.from('profiles').upsert(profilePatch);
if (profileError) fail(`Profil güncellenemedi: ${profileError.message}`);
if (flags['super-admin']) console.info('• Platform süper admin yetkisi verildi (/platform).');

if (!flags['no-org']) {
  const { data: org, error: orgError } = await supabase.from('organizations').select('id, name').eq('slug', orgSlug).maybeSingle();
  if (orgError) fail(`Organizasyon okunamadı: ${orgError.message}`);
  if (!org) fail(`"${orgSlug}" kısa adlı organizasyon bulunamadı. --org=<kısa-ad> ile belirtin.`);
  const { error: memberError } = await supabase
    .from('organization_members')
    .upsert({ organization_id: org.id, user_id: user.id, role, status: 'active' }, { onConflict: 'organization_id,user_id' });
  if (memberError) fail(`Üyelik eklenemedi: ${memberError.message}${memberError.message === 'plan_limit_users' ? ' (plan kullanıcı limiti dolu)' : ''}`);
  console.info(`• "${org.name}" organizasyonuna ${role} rolüyle eklendi.`);
}

console.info('✓ Tamamlandı. /admin/giris adresinden giriş yapabilirsiniz.\n');
