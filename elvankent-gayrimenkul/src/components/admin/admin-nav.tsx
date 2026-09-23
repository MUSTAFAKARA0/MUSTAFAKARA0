'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Building2, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, PlusCircle, Settings } from 'lucide-react';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { LogoMark } from '@/components/layout/logo';
import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'Panel', icon: LayoutDashboard, exact: true },
  { href: '/admin/ilanlar', label: 'İlanlar', icon: Building2 },
  { href: '/admin/ilan-ekle', label: 'Yeni İlan Ekle', icon: PlusCircle },
  { href: '/admin/mesajlar', label: 'Mesajlar', icon: Inbox, badge: true },
  { href: '/admin/ayarlar', label: 'Ayarlar', icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === '/admin/ilanlar') return pathname.startsWith('/admin/ilanlar') || pathname.startsWith('/admin/ilan/');
  return pathname.startsWith(href);
}

function NavList({ newMessages, onNavigate }: { newMessages: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim menüsü" className="flex flex-1 flex-col">
      <ul className="space-y-1">
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = isActive(pathname, href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition',
                  active ? 'bg-white/12 text-white' : 'text-brand-100 hover:bg-white/8 hover:text-white',
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                <span className="flex-1">{label}</span>
                {badge && newMessages > 0 && (
                  <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-bold text-brand-950">
                    {newMessages}
                    <span className="sr-only"> yeni mesaj</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold text-brand-100 transition hover:bg-white/8 hover:text-white"
        >
          <ExternalLink className="size-[18px]" aria-hidden /> Siteyi görüntüle
        </a>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-brand-100 transition hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-[18px]" aria-hidden /> Çıkış yap
          </button>
        </form>
      </div>
    </nav>
  );
}

export function AdminSidebar({ businessName, email, newMessages }: { businessName: string; email: string; newMessages: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 px-4 py-5 lg:flex">
      <Link href="/admin" className="mb-8 flex items-center gap-3 px-2">
        <LogoMark className="size-9" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{businessName}</span>
          <span className="block truncate text-xs text-brand-300">{email}</span>
        </span>
      </Link>
      <NavList newMessages={newMessages} />
    </aside>
  );
}

export function AdminMobileBar({ businessName, newMessages }: { businessName: string; newMessages: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
      <Link href="/admin" className="flex items-center gap-2.5">
        <LogoMark className="size-8" />
        <span className="text-sm font-bold text-ink">Yönetim</span>
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" aria-label="Menüyü aç" className="relative rounded-lg p-2 text-ink hover:bg-sand-100">
            <Menu className="size-6" />
            {newMessages > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-accent-500" aria-hidden />}
          </button>
        </DialogTrigger>
        <SheetContent title={businessName} side="left" className="bg-brand-900 text-white [&_h2]:text-white">
          <div className="flex min-h-full flex-col">
            <NavList newMessages={newMessages} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>
    </div>
  );
}
