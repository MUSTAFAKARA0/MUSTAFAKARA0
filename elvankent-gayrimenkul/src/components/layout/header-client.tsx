'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, ChevronDown, GitCompareArrows, Heart, Menu, MapPin, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { useCompare, useFavorites, useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/site-config/nav';

function isActive(pathname: string, item: NavItem): boolean {
  return (item.match ?? [item.href]).some((m) => pathname === m || pathname.startsWith(`${m}-`) || pathname.startsWith(`${m}/`));
}

/** Site içi bağlantı Next Link, dış bağlantı yeni sekmede */
function NavLink({ item, children, ...props }: { item: NavItem; children: React.ReactNode } & Omit<React.ComponentProps<'a'>, 'href'>) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={item.href} {...props}>
      {children}
    </Link>
  );
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Ana menü" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item) || (item.children ?? []).some((c) => isActive(pathname, c));
          const hasChildren = (item.children?.length ?? 0) > 0;
          return (
            <li key={item.href + item.label} className={cn(hasChildren && 'group relative')}>
              <NavLink
                item={item}
                aria-current={active && !hasChildren ? 'page' : undefined}
                aria-haspopup={hasChildren ? 'true' : undefined}
                className={cn(
                  'relative inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                {item.label}
                {hasChildren && <ChevronDown className="size-3.5 opacity-60" aria-hidden />}
                {active && <span className="absolute inset-x-3 -bottom-[17px] h-[2px] rounded-full bg-primary" aria-hidden />}
              </NavLink>
              {hasChildren && (
                // Alt menü: fareyle üzerine gelince veya klavyeyle odaklanınca açılır
                <ul className="invisible absolute top-full left-0 z-50 mt-2 min-w-52 rounded-xl border border-border bg-surface p-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {item.children!.map((c) => (
                    <li key={c.href + c.label}>
                      <NavLink item={c} className="block rounded-lg px-3 py-2 text-[14px] text-foreground/80 hover:bg-surface-muted hover:text-foreground">
                        {c.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10.5px] leading-[18px] font-bold text-accent-fg ring-2 ring-surface">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function HeaderActions({
  phoneHref,
  phoneLabel,
  whatsappHref = null,
  mobilePhoneHref = null,
  showFavorites = true,
  cta = null,
}: {
  phoneHref: string | null;
  phoneLabel: string | null;
  whatsappHref?: string | null;
  mobilePhoneHref?: string | null;
  showFavorites?: boolean;
  cta?: { label: string; href: string } | null;
}) {
  const { items: favorites } = useFavorites();
  const { items: compare } = useCompare();
  const hydrated = useHydrated();
  const favCount = hydrated ? favorites.length : 0;
  const compareCount = hydrated ? compare.length : 0;
  return (
    <>
      {compareCount > 0 && (
        <Link
          href="/karsilastir"
          className="relative hidden size-10 items-center justify-center rounded-xl text-foreground/80 transition hover:bg-surface-muted hover:text-foreground sm:inline-flex"
          aria-label={`Karşılaştırma listesi (${compareCount} ilan)`}
        >
          <GitCompareArrows className="size-5" />
          <CountBadge count={compareCount} />
        </Link>
      )}
      {showFavorites && (
        <Link
          href="/favoriler"
          className="relative inline-flex size-10 items-center justify-center rounded-xl text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          aria-label={favCount > 0 ? `Favorilerim (${favCount} ilan)` : 'Favorilerim'}
        >
          <Heart className="size-5" />
          <CountBadge count={favCount} />
        </Link>
      )}
      {mobilePhoneHref && (
        <a
          href={mobilePhoneHref}
          className="inline-flex size-10 items-center justify-center rounded-xl text-foreground/80 transition hover:bg-surface-muted hover:text-foreground md:hidden"
          aria-label="Arayın"
        >
          <Phone className="size-5" />
        </a>
      )}
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden size-10 items-center justify-center rounded-xl text-foreground/80 transition hover:bg-surface-muted hover:text-foreground md:inline-flex"
          aria-label="WhatsApp'tan yazın"
        >
          <WhatsAppIcon className="size-5" />
        </a>
      )}
      {cta ? (
        <Button asChild size="sm" className="ml-1 hidden h-10 rounded-xl px-4 md:inline-flex">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : phoneHref ? (
        <Button asChild size="sm" className="ml-1 hidden h-10 rounded-xl px-4 md:inline-flex">
          <a href={phoneHref}>
            <Phone />
            <span className="numeric">{phoneLabel}</span>
          </a>
        </Button>
      ) : (
        <Button asChild size="sm" className="ml-1 hidden h-10 rounded-xl px-4 md:inline-flex">
          <Link href="/iletisim">Bize ulaşın</Link>
        </Button>
      )}
    </>
  );
}

export function MobileMenu({
  items,
  name,
  phoneHref,
  phoneLabel,
  whatsappHref,
  address,
  showFavorites = true,
}: {
  items: NavItem[];
  name: string;
  phoneHref: string | null;
  phoneLabel: string | null;
  whatsappHref: string | null;
  address: string | null;
  showFavorites?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { items: compare } = useCompare();
  const hydrated = useHydrated();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl text-foreground transition hover:bg-surface-muted lg:hidden"
          aria-label="Menüyü aç"
        >
          <Menu className="size-6" />
        </button>
      </DialogTrigger>
      <SheetContent
        title={name}
        description="Site menüsü"
        footer={
          <div className="grid grid-cols-2 gap-2 pb-1">
            {phoneHref && (
              <Button asChild variant="outline">
                <a href={phoneHref}>
                  <Phone /> Arayın
                </a>
              </Button>
            )}
            {whatsappHref && (
              <Button asChild variant="whatsapp" className={phoneHref ? '' : 'col-span-2'}>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-5" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        }
      >
        <nav aria-label="Mobil menü">
          <ul className="-mx-2 space-y-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href + item.label}>
                  <NavLink
                    item={item}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-3.5 font-display text-[1.35rem] transition-colors',
                      active ? 'bg-primary-soft text-primary-ink' : 'text-foreground hover:bg-surface-muted',
                    )}
                  >
                    {item.label}
                    <ArrowRight className="size-5 opacity-40" aria-hidden />
                  </NavLink>
                  {(item.children?.length ?? 0) > 0 && (
                    <ul className="mb-1 ml-3 border-l border-border pl-2">
                      {item.children!.map((c) => (
                        <li key={c.href + c.label}>
                          <NavLink
                            item={c}
                            onClick={() => setOpen(false)}
                            className="block rounded-lg px-3 py-2.5 text-[15.5px] text-foreground/80 hover:bg-surface-muted hover:text-foreground"
                          >
                            {c.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={cn('mt-6 grid grid-cols-2 gap-2 text-sm', !showFavorites && 'hidden')}>
          <Link href="/favoriler" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-3 font-medium">
            <Heart className="size-4" /> Favorilerim
          </Link>
          <Link href="/karsilastir" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-3 font-medium">
            <GitCompareArrows className="size-4" /> Karşılaştır{hydrated && compare.length > 0 ? ` (${compare.length})` : ''}
          </Link>
        </div>
        {(phoneLabel || address) && (
          <div className="mt-6 space-y-2 rounded-2xl bg-surface-muted p-4 text-sm text-muted-foreground">
            {phoneLabel && (
              <p className="flex items-center gap-2 text-foreground">
                <Phone className="size-4" /> <span className="numeric">{phoneLabel}</span>
              </p>
            )}
            {address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" /> {address}
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Dialog>
  );
}
