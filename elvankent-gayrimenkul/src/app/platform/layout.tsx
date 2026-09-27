import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { PlatformNav } from '@/components/platform/platform-nav';
import { signOut } from '@/app/actions/auth';
import { getOrgContext, requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = {
  title: { default: 'Platform yönetimi', template: '%s | Platform yönetimi' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

export const viewport: Viewport = { themeColor: '#101816' };

/**
 * Süper admin paneli: tüm organizasyonlar, kullanıcılar, planlar ve sistem
 * kayıtları. Erişim sunucuda doğrulanır; veritabanı fonksiyonları ayrıca
 * is_super_admin() ile kontrol eder.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdminPage();
  // Süper adminin üye olduğu (aktif) ofis: başlıktaki bağlantı o ofisin paneline gider
  const office = await getOrgContext();
  return (
    <div className="min-h-dvh bg-[#f5f4f1] text-foreground">
      <header className="bg-[#101816] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-4 pb-2 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/platform" className="flex items-center gap-2.5 font-semibold">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] leading-tight">Platform yönetimi</span>
                <span className="block text-[12px] font-normal text-white/60">Süper admin</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden max-w-56 truncate text-[13px] text-white/70 sm:block">{session.user.email}</span>
              {office && (
                <Link
                  href="/admin"
                  className="max-w-64 truncate rounded-lg px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                  title={`${office.org.name} ofis paneline git`}
                  aria-label={`Ofis paneli · ${office.org.name}`}
                >
                  Ofis paneli<span className="hidden sm:inline"> · {office.org.name}</span>
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white">
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
    </div>
  );
}
