'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { PlatformWordmark } from '@/components/brand/platform-wordmark';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { KARAY_NAV } from '@/modules/karay/nav';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';


/**
 * KARAY şirket sayfasının başlığı. Kiracı (emlak ofisi) sitesinin başlığından tamamen
 * ayrıdır: KARAY logosu, ürün menüsü, emlakçı müşteri girişi ve demo talebi.
 */
export function KarayHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="ky-header sticky top-0 z-40 border-b border-[#e3e8f0] bg-white/97 backdrop-blur supports-[backdrop-filter]:bg-white/97">
      <span aria-hidden className="ky-progress" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
        <Link href="/karay" className="flex shrink-0 items-center rounded-lg" aria-label={`${PLATFORM_BRAND.name} ana sayfa`}>
          <PlatformWordmark height={30} />
        </Link>
        <nav aria-label={`${PLATFORM_BRAND.name} menüsü`} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {KARAY_NAV.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="ky-navlink rounded-lg px-3 py-2 text-[14px] font-medium text-[#33415c] transition hover:text-[#0b1b3a]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/admin/giris" prefetch={false} className="hidden rounded-lg px-3 py-2 text-[14px] font-semibold text-[#33415c] hover:text-[#0b1b3a] md:inline-flex">
            Müşteri girişi
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="/karay#demo">Demo talep et</a>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl text-[#0b1b3a] hover:bg-[#f1f4f9] lg:hidden" aria-label="Menüyü aç">
                <Menu className="size-6" />
              </button>
            </DialogTrigger>
            <SheetContent title={PLATFORM_BRAND.name} description={PLATFORM_BRAND.product} className="platform-scope">
              <nav aria-label={`${PLATFORM_BRAND.name} mobil menü`}>
                <ul className="space-y-1">
                  {KARAY_NAV.map((l) => (
                    <li key={l.href}>
                      <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl px-3 text-[16px] font-semibold text-[#0b1b3a] hover:bg-[#f1f4f9]">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-6 grid gap-2">
                <Button asChild size="lg">
                  <a href="/karay#demo" onClick={() => setOpen(false)}>
                    Demo talep et
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/admin/giris" prefetch={false}>Müşteri girişi</Link>
                </Button>
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
