import type { Metadata } from 'next';
import { AuthCard } from '@/components/panel/auth-card';
import { firstParam } from '@/lib/utils';
import { ResetRequestForm } from '@/components/panel/reset-request-form';

export const metadata: Metadata = { title: 'Şifremi unuttum' };

export default async function ForgotPasswordPage({ searchParams }: PageProps<'/admin/sifremi-unuttum'>) {
  const invalid = firstParam((await searchParams).hata) === 'gecersiz';
  return (
    <AuthCard title="Şifrenizi mi unuttunuz?" description="Hesabınızın e-posta adresini girin; şifre yenileme bağlantısı gönderelim.">
      {invalid && (
        <p role="alert" className="mb-5 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning">
          Bağlantının süresi dolmuş veya daha önce kullanılmış. Lütfen yeni bir bağlantı isteyin.
        </p>
      )}
      <ResetRequestForm />
    </AuthCard>
  );
}
