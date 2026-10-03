import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/panel/auth-card';
import { firstParam } from '@/lib/utils';
import { getMfaRequirement, getOrgContext, getSessionScope, getSessionUser, mfaUrl } from '@/platform/auth/session';
import { LoginForm } from '@/components/panel/login-form';

export const metadata: Metadata = { title: 'Giriş' };

/** Yalnızca ofis paneli adreslerine dönülür (platforma asla; açık yönlendirme yok) */
function safeNext(value: string | undefined): string {
  if (!value || value.startsWith('//') || value.includes('\\')) return '/admin';
  return /^\/admin(\/|\?|$)/.test(value) && !value.startsWith('/admin/giris') ? value : '/admin';
}

export default async function LoginPage({ searchParams }: PageProps<'/admin/giris'>) {
  const session = await getSessionUser();
  const next = firstParam((await searchParams).next);
  const platformSession = session ? (await getSessionScope()) === 'platform' : false;
  // Şifre doğru girilmiş, iki adımlı doğrulama bekleniyor (yalnızca ofis oturumu)
  if (session && !platformSession && (await getMfaRequirement())) redirect(mfaUrl(safeNext(next)));
  // Açık ofis oturumu → panel. Platform oturumu ofis paneline geçemez: ofis hesabıyla giriş gerekir.
  if (session && !platformSession && (await getOrgContext())) redirect(safeNext(next));
  return (
    <AuthCard title="Yönetim paneli" description="Devam etmek için hesabınızla giriş yapın.">
      {platformSession && (
        <p role="status" className="mb-5 rounded-xl bg-info-soft px-3.5 py-2.5 text-sm text-info">
          Ofis paneli ayrı bir giriş gerektirir. Ofis hesabınızla giriş yapın; açık olan diğer oturum kapanır.
        </p>
      )}
      <LoginForm next={next ? safeNext(next) : undefined} />
    </AuthCard>
  );
}
