import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/admin/auth-card';
import { firstParam } from '@/lib/utils';
import { getOrgContext, getSessionUser } from '@/platform/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage({ searchParams }: PageProps<'/admin/giris'>) {
  const session = await getSessionUser();
  if (session && ((await getOrgContext()) || session.profile.isSuperAdmin)) redirect('/admin');
  const next = firstParam((await searchParams).next);
  return (
    <AuthCard title="Yönetim paneli" description="Devam etmek için hesabınızla giriş yapın.">
      <LoginForm next={next} />
    </AuthCard>
  );
}
