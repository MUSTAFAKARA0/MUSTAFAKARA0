'use client';

import Link from '@/components/common/intent-link';
import { Brush, ExternalLink, FileText, Globe, MoreHorizontal, Power, Search, Settings2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Web Siteleri listesindeki hızlı işlemler (her biri Site Kontrol Merkezi'nin ilgili sekmesine gider) */
export function SiteRowMenu({ orgId, name, siteUrl, size = 'xs' }: { orgId: string; name: string; siteUrl: string | null; size?: 'xs' | 'sm' }) {
  const base = `/platform/siteler/${orgId}`;
  const items = [
    { href: base, label: 'Site ayarları', Icon: Settings2 },
    { href: `${base}/tema`, label: 'Tema ve görünüm', Icon: Brush },
    { href: `${base}/sayfalar`, label: 'Sayfalar', Icon: FileText },
    { href: `${base}/seo`, label: 'SEO', Icon: Search },
    { href: `${base}/alan-adi`, label: 'Alan adı', Icon: Globe },
    { href: `${base}/ozellikler`, label: 'Gelişmiş (özellikler)', Icon: SlidersHorizontal },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size === 'xs' ? 'icon-xs' : 'icon-sm'} aria-label={`${name}: diğer işlemler`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        {siteUrl && (
          <>
            <DropdownMenuItem asChild>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Siteyi görüntüle
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {items.map(({ href, label, Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild destructive>
          <Link href={`${base}#site-durumu`}>
            <Power /> Yayından kaldır / bakım modu
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
