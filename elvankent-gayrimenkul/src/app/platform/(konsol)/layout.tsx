import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { PlatformNav } from '@/components/platform/platform-nav';
import { PlatformWordmark } from '@/components/platform/platform-wordmark';
import { signOutPlatform } from '@/app/actions/auth';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { requireSuperAdminPage } from '@/platform/auth/session';

/**
 * KARAY süper admin konsolu: kiracılar (emlak ofisleri), abonelikler, planlar,
 * kullanıcılar ve sistem kayıtları. Erişim sunucuda doğrulanır (süper admin değilse
 * sayfa yoktur → 404); veritabanı fonksiyonları ayrıca is_super_admin() ile kontrol eder.
 *
 * Bu alan hiçbir kiracının markasını taşımaz. Süper adminin bir ofiste üyeliği varsa
 * o ofisin paneline geçiş, organizasyon ayrıntı sayfasından yapılır (başlıkta değil).
 */
export default async function PlatformConsoleLayout({ children }: LayoutProps<'/platform'>) {
  const session = await requireSuperAdminPage();
  return (
    <>
      <header className="text-white" style={{ background: PLATFORM_BRAND.headerBackground }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-4 pb-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/platform" className="flex min-w-0 items-center gap-3" aria-label={`${PLATFORM_BRAND.name} ${PLATFORM_BRAND.consoleName}`}>
              <PlatformWordmark tone="dark" tagline={false} height={34} />
              <span className="hidden rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold tracking-wide text-white/80 uppercase sm:inline">
                {PLATFORM_BRAND.consoleName}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden max-w-56 truncate text-[13px] text-white/70 md:block">{session.user.email}</span>
              <form action={signOutPlatform}>
                <button type="submit" aria-label="Çıkış" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white">
                  <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Çıkış</span>
                </button>
              </form>
            </div>
          </div>
          <PlatformNav />
        </div>
      </header>
      <main id="icerik" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
