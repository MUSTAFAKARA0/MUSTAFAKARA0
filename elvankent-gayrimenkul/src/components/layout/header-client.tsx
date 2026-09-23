'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Heart, Menu, Phone } from 'lucide-react';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { useFavorites } from '@/hooks/use-favorites';
import { cn } from '@/lib/utils';
import { MAIN_NAV } from './nav-items';

function isActive(pathname: string, href: string) {
  if (href === '/satilik') return pathname === '/satilik' || pathname.startsWith('/satilik-');
  if (href === '/kiralik') return pathname === '/kiralik' || pathname.startsWith('/kiralik-');
  return pathname === href;
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana menü" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {MAIN_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className={cn(item.wideOnly && 'hidden xl:block')}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-[14.5px] font-semibold text-sand-700 transition-colors hover:bg-sand-100 hover:text-ink',
                  active && 'text-brand-800 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-accent-500',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FavoritesLink() {
  const { favorites } = useFavorites();
  const count = favorites.length;
  return (
    <Link
      href="/favoriler"
      className="relative inline-flex size-10 items-center justify-center rounded-xl text-sand-700 transition hover:bg-sand-100 hover:text-ink"
      aria-label={count ? `Favorilerim (${count} ilan)` : 'Favorilerim'}
    >
      <Heart className="size-[21px]" />
      {count > 0 && (
        <span className="absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10.5px] leading-[18px] font-bold text-brand-950">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

export function MobileMenu({ tel, whatsapp, businessName }: { tel: string | null; whatsapp: string | null; businessName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink transition hover:bg-sand-100 lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="size-6" />
        </button>
      </DialogTrigger>
      <SheetContent
        title={businessName}
        footer={
          (tel || whatsapp) && (
            <div className="grid grid-cols-2 gap-2 pb-1">
              {tel && (
                <Button asChild variant="outline">
                  <a href={tel}>
                    <Phone /> Ara
                  </a>
                </Button>
              )}
              {whatsapp && (
                <Button asChild variant="whatsapp" className={cn(!tel && 'col-span-2')}>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          )
        }
      >
        <nav aria-label="Mobil menü">
          <ul className="space-y-1">
            {MAIN_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center rounded-xl px-3 py-3 text-[15px] font-semibold text-sand-800 transition hover:bg-sand-100',
                      active && 'bg-brand-50 text-brand-800',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-line pt-2">
              <Link
                href="/favoriler"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-sand-800 transition hover:bg-sand-100"
              >
                <Heart className="size-[18px]" /> Favorilerim
              </Link>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Dialog>
  );
}
