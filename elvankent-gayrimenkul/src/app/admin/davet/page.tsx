import type { Metadata } from 'next';
import { AuthCard } from '@/components/panel/auth-card';
import { ActivationForm } from '@/components/panel/activation-form';

export const metadata: Metadata = { title: 'Hesabınızı etkinleştirin', referrer: 'no-referrer' };

/**
 * Davet bağlantısı (P0.4): /admin/davet#t=<token>. Token URL parçasında olduğu için sunucu bu
 * sayfayı tokensız işler; form tokenı tarayıcıda okuyup sunucu işlemine gönderir.
 */
export default function InvitationPage() {
  return (
    <AuthCard title="Hesabınızı etkinleştirin" description="Yönetim paneli için şifrenizi belirleyin.">
      <ActivationForm />
    </AuthCard>
  );
}
