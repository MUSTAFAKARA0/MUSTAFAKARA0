import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { AuthCard } from '@/components/panel/auth-card';
import { PasswordForm } from '@/components/panel/password-form';
import { getSessionUser } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Yeni şifre belirle' };

/**
 * KARAY platform şifre yenileme. Bağlantıyla açılan oturum platform konsoluna erişim VERMEZ;
 * yeni şifre belirlendikten sonra platform girişinden (şifreyle) giriş yapılır.
 */
export default async function PlatformResetPasswordPage() {
  const session = await getSessionUser();
  return (
    <AuthCard brand="platform" title="Yeni şifre belirleyin" description={session ? session.user.email : undefined}>
      {session ? (
        <PasswordForm onDoneHref="/platform/giris" onDoneLabel="Platform girişine git" />
      ) : (
        <div className="text-center text-sm leading-relaxed text-muted-foreground">
          <p>Şifre yenileme bağlantısının süresi dolmuş veya geçersiz.</p>
          <Link href="/platform/sifremi-unuttum" className="mt-4 inline-block font-semibold text-primary-ink hover:underline">
            Yeni bağlantı iste
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
