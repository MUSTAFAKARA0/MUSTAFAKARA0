import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/admin/auth-card';
import { firstParam } from '@/lib/utils';
import { getMfaRequirement, getOrgContext, getSessionUser, mfaUrl } from '@/platform/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage({ searchParams }: PageProps<'/admin/giris'>) {
  const session = await getSessionUser();
  const next = firstParam((await searchParams).next);
  // Şifre doğru girilmiş, iki adımlı doğrulama bekleniyor
  if (session && (await getMfaRequirement())) redirect(mfaUrl(next));
  if (session && ((await getOrgContext()) || session.profile.isSuperAdmin)) redirect('/admin');
  return (
    <AuthCard title="Yönetim paneli" description="Devam etmek için hesabınızla giriş yapın.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
