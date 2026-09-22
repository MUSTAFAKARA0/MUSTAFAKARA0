#!/usr/bin/env node
/**
 * Yönetici hesabı oluşturur veya mevcut bir hesabı yönetici yapar.
 *
 * Kullanım:
 *   npm run create-admin -- ornek@eposta.com 'Güçlü-Bir-Şifre-123'
 *
 * Gerekli ortam değişkenleri (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Not: Bu betik yalnızca kendi bilgisayarınızda / sunucuda çalıştırılmalıdır.
 * service_role anahtarı hiçbir zaman tarayıcıya veya git deposuna konmamalıdır.
 */
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı (.env.local).');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Kullanım: npm run create-admin -- eposta@ornek.com 'Sifre'");
if (!password || password.length < 10) fail('Şifre en az 10 karakter olmalıdır.');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page++) {
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
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Kullanıcı oluşturulamadı: ${error.message}`);
  user = data.user;
  console.info(`• Kullanıcı oluşturuldu: ${email}`);
}

const { error: roleError } = await supabase.from('profiles').upsert({ id: user.id, role: 'admin' });
if (roleError) fail(`Yönetici yetkisi verilemedi: ${roleError.message}`);

console.info('✓ Yönetici yetkisi verildi. /admin/giris adresinden giriş yapabilirsiniz.\n');
