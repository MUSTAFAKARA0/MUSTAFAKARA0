'use client';

import Link from '@/components/common/intent-link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/platform', label: 'Genel bakış', exact: true },
  { href: '/platform/organizasyonlar', label: 'Organizasyonlar' },
  { href: '/platform/siteler', label: 'Web Siteleri' },
  { href: '/platform/planlar', label: 'Planlar ve abonelikler' },
  { href: '/platform/kullanicilar', label: 'Tüm kullanıcılar' },
  { href: '/platform/kayitlar', label: 'Sistem kayıtları' },
];

export function PlatformNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform menüsü" className="scrollbar-none relative -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn('shrink-0 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition', active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white')}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
