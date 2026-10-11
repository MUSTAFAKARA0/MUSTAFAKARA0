import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/panel/auth-card';
import { PlatformAuthCard } from '@/components/panel/platform-auth-card';
import { MfaCodeForm, MfaEnrollForm } from '@/components/admin/mfa/mfa-forms';
import { signOut, signOutPlatform } from '@/app/actions/auth';
import { firstParam } from '@/lib/utils';
import { getMfaRequirement, getSessionUser } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'İki adımlı doğrulama', robots: { index: false } };

/** Yalnızca panel içi göreli adreslere dönülür (açık yönlendirme engeli) */
function safeNext(value: string | undefined): string {
  if (!value || value.startsWith('//') || value.includes('\\')) return '/admin';
  return /^\/(admin|platform)(\/|\?|$)/.test(value) ? value : '/admin';
}

export default async function MfaPage({ searchParams }: PageProps<'/admin/dogrulama'>) {
  const session = await getSessionUser();
  const params = await searchParams;
  const next = safeNext(firstParam(params.next));
  // Platform (KARAY) girişinden gelindiyse platform markası; değilse ofis markası
  const brand = next.startsWith('/platform') ? 'platform' : 'tenant';
  if (!session) redirect(brand === 'platform' ? '/platform/giris' : '/admin/giris');
  const requirement = await getMfaRequirement();
  const voluntarySetup = firstParam(params.kurulum) === '1' && !session.mfa.factorId;

  const signOutLink = (
    <form action={brand === 'platform' ? signOutPlatform : signOut} className="mt-6 text-center">
      <button type="submit" className="text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
        Farklı hesapla giriş yap
      </button>
    </form>
  );

  // KARAY girişinden gelen doğrulama KARAY çerçevesiyle, ofis girişi ofis markasıyla gösterilir
  const Card = brand === 'platform' ? PlatformAuthCard : AuthCard;

  if (requirement === 'challenge') {
    return (
      <Card title="Doğrulama kodu" description="Hesabınız iki adımlı doğrulama ile korunuyor.">
        <MfaCodeForm next={next} />
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted-foreground">
          {brand === 'platform'
            ? 'Telefonunuza erişemiyorsanız doğrulama faktörü Supabase › Authentication › Users bölümünden sıfırlanabilir.'
            : 'Telefonunuza erişemiyorsanız ofis sahibinden iki adımlı doğrulamanızı sıfırlamasını isteyin.'}
        </p>
        {signOutLink}
      </Card>
    );
  }
  if (requirement === 'enroll' || voluntarySetup) {
    return (
      <Card title="İki adımlı doğrulama" description="Şifrenize ek olarak telefonunuzdaki uygulamanın ürettiği kod istenir.">
        <MfaEnrollForm next={next} required={requirement === 'enroll'} />
        {signOutLink}
      </Card>
    );
  }
  redirect(next);
}
