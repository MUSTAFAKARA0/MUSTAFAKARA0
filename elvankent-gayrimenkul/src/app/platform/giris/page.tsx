import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/admin/auth-card';
import { LoginForm } from '@/app/admin/giris/login-form';
import { signOutPlatform } from '@/app/actions/auth';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { getMfaRequirement, getSessionUser, mfaUrl } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Giriş' };

/** KARAY platform (süper admin) girişi — emlak ofisi girişinden ayrıdır */
export default async function PlatformLoginPage() {
  const session = await getSessionUser();
  if (session?.profile.isSuperAdmin) {
    if (await getMfaRequirement()) redirect(mfaUrl('/platform'));
    redirect('/platform');
  }
  if (session) {
    // Oturum açmış bir ofis kullanıcısı: platform alanına yetkisi yok
    return (
      <AuthCard brand="platform" title={PLATFORM_BRAND.consoleName} description="Bu alan yalnızca platform yöneticileri içindir.">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Oturum açtığınız hesap bir emlak ofisine ait. Ofis panelinize ofisinizin giriş sayfasından ulaşabilirsiniz.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/admin" className="text-primary-ink hover:underline">
            Ofis paneline dön
          </Link>
          <form action={signOutPlatform}>
            <button type="submit" className="text-muted-foreground hover:text-foreground">
              Farklı hesapla giriş yap
            </button>
          </form>
        </div>
      </AuthCard>
    );
  }
  return (
    <AuthCard brand="platform" title={PLATFORM_BRAND.consoleName} description="Platform yöneticisi hesabınızla giriş yapın.">
      <LoginForm next="/platform" scope="platform" />
    </AuthCard>
  );
}
