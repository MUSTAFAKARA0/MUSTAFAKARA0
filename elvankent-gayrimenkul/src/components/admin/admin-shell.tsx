'use client';

import Link from '@/components/common/intent-link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';
import {
  BarChart3,
  Building,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  ExternalLink,
  FolderHeart,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Monogram } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, SheetContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { signOut, switchOrganization } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import type { AdminIconKey, AdminNavItem, AdminNavSection } from '@/components/admin/nav-config';

const ICONS: Record<AdminIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  listings: Building2,
  customers: Users,
  leads: Inbox,
  appointments: CalendarDays,
  collections: FolderHeart,
  analytics: BarChart3,
  media: Images,
  regions: MapPinned,
  content: Newspaper,
  seo: Search,
  settings: SlidersHorizontal,
  users: UserCog,
  company: Building,
  security: ShieldCheck,
};

export interface ShellProps {
  nav: AdminNavSection[];
  /** logoUrl: ofisin yüklediği logo (Şirket ayarları); yoksa ad baş harfleri gösterilir */
  org: { id: string; name: string; logoUrl?: string | null };
  orgs: { id: string; name: string; roleLabel: string }[];
  user: { name: string; email: string; roleLabel: string };
  siteUrl: string | null;
  canCreateListing: boolean;
  passwordChangeRequired: boolean;
  /** Menü öğesi yanında gösterilecek sayılar (ör. yeni talepler) */
  badges?: Record<string, number>;
  children: React.ReactNode;
}

function isActive(item: AdminNavItem, pathname: string): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => (p === '/admin' ? pathname === '/admin' : pathname === p || pathname.startsWith(`${p}/`)));
}

function SubLinks({ item, onNavigate }: { item: AdminNavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = `${pathname}${params.get('durum') ? `?durum=${params.get('durum')}` : ''}`;
  return (
    <ul className="mt-1 mb-2 ml-[1.35rem] space-y-0.5 border-l border-border pl-3">
      {item.children?.map((child) => {
        const active = current === child.href;
        return (
          <li key={child.href}>
            <Link
              href={child.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-2.5 py-1.5 text-[13px] transition',
                active ? 'bg-primary-soft font-semibold text-primary-ink' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
              )}
            >
              {child.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavList({ nav, badges, onNavigate }: { nav: AdminNavSection[]; badges?: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim menüsü" className="space-y-6">
      {nav.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.12em] text-muted-foreground/80 uppercase">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active && !item.children ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition',
                      active ? 'bg-surface text-foreground shadow-xs ring-1 ring-border' : 'text-foreground/75 hover:bg-surface/70 hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                    {item.label}
                    {(badges?.[item.href] ?? 0) > 0 && (
                      <span className="numeric ml-auto rounded-full bg-primary px-2 py-0.5 text-[12px] leading-none font-bold text-primary-fg">
                        {badges![item.href] > 99 ? '99+' : badges![item.href]}
                        <span className="sr-only"> yeni</span>
                      </span>
                    )}
                  </Link>
                  {active && item.children && item.children.length > 0 && (
                    <Suspense fallback={null}>
                      <SubLinks item={item} onNavigate={onNavigate} />
                    </Suspense>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Menü öğeleri sunucu eylemini doğrudan çağırır: menü seçimde kapanıp içeriğini
// kaldırdığı için içindeki bir <form> gönderilmeden DOM'dan çıkar ("form is not connected").
function OrgSwitcher({ org, orgs }: Pick<ShellProps, 'org' | 'orgs'>) {
  const [pending, startTransition] = useTransition();
  const trigger = (
    <span className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left">
      {/* Ofis kimliği: logo (en-boy oranı korunur) + ofis adı + "Ofis Yönetimi". Platform (KARAY) markası burada yer almaz. */}
      {org.logoUrl ? (
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- marka görseli Storage'dan, sabit küçük kutu */}
          <img src={org.logoUrl} alt="" width={40} height={40} className="max-h-full max-w-full object-contain" />
        </span>
      ) : (
        <Monogram name={org.name} className="size-11 text-[1rem]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] leading-tight font-bold text-foreground">{org.name}</span>
        <span className="mt-0.5 block text-[12px] font-medium text-muted-foreground">Ofis Yönetimi</span>
      </span>
      {orgs.length > 1 && <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </span>
  );
  if (orgs.length <= 1) return <div>{trigger}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-2xl transition hover:bg-surface/70" aria-label="Ofis değiştir">
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Ofisleriniz</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem
            key={o.id}
            disabled={pending}
            onSelect={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set('orgId', o.id);
                await switchOrganization(data);
              })
            }
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{o.name}</span>
              <span className="block text-[12px] text-muted-foreground">{o.roleLabel}</span>
            </span>
            {o.id === org.id && <Check className="!text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user, siteUrl }: Pick<ShellProps, 'user' | 'siteUrl'>) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-surface/70" aria-label="Hesap menüsü">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-inverse text-[13px] font-bold text-white">
          {user.name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{user.name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{user.roleLabel}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-[12.5px] font-medium text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/admin/hesap">
            <UserRound /> Hesabım
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/hesap#sifre">
            <KeyRound /> Şifre değiştir
          </Link>
        </DropdownMenuItem>
        {siteUrl && (
          <DropdownMenuItem asChild>
            <a href={siteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Siteyi görüntüle
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={pending} onSelect={() => startTransition(() => signOut())}>
          <LogOut /> {pending ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchBox({ className }: { className?: string }) {
  return (
    <form action="/admin/ara" method="get" role="search" className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <label htmlFor="admin-search" className="sr-only">
        Panelde ara
      </label>
      <input
        id="admin-search"
        name="q"
        type="search"
        placeholder="İlan no, başlık, müşteri, telefon…"
        maxLength={80}
        className="h-10 w-full rounded-xl border border-border bg-surface pr-3 pl-9 text-base sm:text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
      />
    </form>
  );
}

export function AdminShell({ nav, org, orgs, user, siteUrl, canCreateListing, passwordChangeRequired, badges, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-4 pb-3">
        <OrgSwitcher org={org} orgs={orgs} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <NavList nav={nav} badges={badges} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-border px-3 py-3">
        <UserMenu user={user} siteUrl={siteUrl} />
        {/* Hiyerarşi: ofis, KARAY altyapısının müşterisidir (platform yönetimine erişim yoktur) */}
        <p className="mt-2 px-2 text-[11px] text-muted-foreground/80">KARAY altyapısıyla çalışır</p>
      </div>
    </div>
  );

  return (
    <div className="lg:pl-[17rem]">
      <a
        href="#admin-icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        İçeriğe geç
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] border-r border-border bg-[#efeee9] lg:block">{sidebar()}</aside>

      <header className="sticky top-0 z-20 border-b border-border bg-[#f5f4f1]/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-xl text-foreground transition hover:bg-surface lg:hidden"
                aria-label="Menüyü aç"
              >
                <Menu className="size-6" />
              </button>
            </DialogTrigger>
            <SheetContent side="left" title={org.name} description="Yönetim menüsü" hideHeader className="bg-[#efeee9] p-0 [&>div:nth-child(2)]:p-0">
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </Dialog>
          {/* Telefonda ofis kimliği (masaüstünde yan menüde) */}
          <Link href="/admin" className="shrink-0 lg:hidden" aria-label={`${org.name} – Ofis Yönetimi`}>
            {org.logoUrl ? (
              <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- marka görseli, sabit küçük kutu */}
                <img src={org.logoUrl} alt="" width={36} height={36} className="max-h-full max-w-full object-contain" />
              </span>
            ) : (
              <Monogram name={org.name} className="size-10 text-[0.95rem]" />
            )}
          </Link>
          <SearchBox className="max-w-md min-w-0 flex-1" />
          <div className="ml-auto flex items-center gap-2">
            {siteUrl && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Siteyi gör
                </a>
              </Button>
            )}
            {canCreateListing && (
              <Button asChild size="sm">
                <Link href="/admin/ilanlar/yeni">
                  <Plus /> <span className="hidden sm:inline">Yeni ilan</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
        {passwordChangeRequired && (
          <div className="border-t border-warning/25 bg-warning-soft px-4 py-2.5 text-[13px] font-medium text-warning sm:px-6 lg:px-8">
            Güvenliğiniz için geçici şifrenizi değiştirin.{' '}
            <Link href="/admin/hesap#sifre" className="font-bold underline underline-offset-2">
              Şifreyi şimdi değiştir
            </Link>
          </div>
        )}
      </header>

      <main id="admin-icerik" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
