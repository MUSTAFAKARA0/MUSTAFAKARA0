import type { Metadata } from 'next';
import { AuthCard } from '@/components/panel/auth-card';
import { ResetRequestForm } from '@/components/panel/reset-request-form';
import { firstParam } from '@/lib/utils';

export const metadata: Metadata = { title: 'Şifremi unuttum' };

/** KARAY platform şifre yenileme isteği (ofis markası kullanılmaz; bağlantı platform sayfasına döner) */
export default async function PlatformForgotPasswordPage({ searchParams }: PageProps<'/platform/sifremi-unuttum'>) {
  const invalid = firstParam((await searchParams).hata) === 'gecersiz';
  return (
    <AuthCard brand="platform" title="Şifrenizi mi unuttunuz?" description="Platform yöneticisi hesabınızın e-posta adresini girin; şifre yenileme bağlantısı gönderelim.">
      {invalid && (
        <p role="alert" className="mb-5 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning">
          Bağlantının süresi dolmuş veya daha önce kullanılmış. Lütfen yeni bir bağlantı isteyin.
        </p>
      )}
      <ResetRequestForm scope="platform" />
    </AuthCard>
  );
}
