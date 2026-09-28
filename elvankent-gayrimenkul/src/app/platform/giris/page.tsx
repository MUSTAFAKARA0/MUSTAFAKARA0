import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/admin/auth-card';
import { LoginForm } from '@/app/admin/giris/login-form';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { getMfaRequirement, getSessionScope, getSessionUser, mfaUrl } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Giriş' };

/** KARAY platform (süper admin) girişi — emlak ofisi girişinden ayrıdır */
export default async function PlatformLoginPage() {
  const session = await getSessionUser();
  const scope = session ? await getSessionScope() : null;
  // Yalnızca platform girişinden açılmış süper admin oturumu doğrudan konsola gider
  if (session?.profile.isSuperAdmin && scope === 'platform') {
    if (await getMfaRequirement()) redirect(mfaUrl('/platform'));
    redirect('/platform');
  }
  return (
    <AuthCard brand="platform" title={PLATFORM_BRAND.consoleName} description="Platform yöneticisi hesabınızla giriş yapın.">
      {session && (
        // Ofis panelinden açılmış oturum platforma geçemez: şifreyle yeniden giriş gerekir
        <p role="status" className="mb-5 rounded-xl bg-info-soft px-3.5 py-2.5 text-sm text-info">
          Bu alan yalnızca platform yöneticileri içindir. Ofis paneli oturumunuz platforma geçiş sağlamaz; giriş yaptığınızda o oturum kapanır.
        </p>
      )}
      <LoginForm next="/platform" scope="platform" />
    </AuthCard>
  );
}
