import Link from '@/components/common/intent-link';
import { Logo } from '@/components/brand/logo';
import { PlatformWordmark } from '@/components/brand/platform-wordmark';
import { brandingUrl } from '@/modules/media/variants';
import { PLATFORM_SCOPE, platformThemeCss } from '@/platform/branding/platform-brand';
import { platformFont } from '@/platform/branding/platform-font';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

/**
 * Giriş / şifre / doğrulama sayfalarının ortak çerçevesi.
 *   brand="tenant"   → bulunulan alan adındaki ofisin markası (ofis paneli girişi)
 *   brand="platform" → KARAY platform markası (süper admin girişi); ofis markası kullanılmaz
 */
export async function AuthCard({
  title,
  description,
  children,
  brand = 'tenant',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  brand?: 'tenant' | 'platform';
}) {
  if (brand === 'platform') {
    return (
      <div className={`${PLATFORM_SCOPE} ${platformFont.className} min-h-dvh bg-background`}>
        <style href="platform-theme" precedence="high">
          {platformThemeCss(platformFont.style.fontFamily)}
        </style>
        <main className="flex min-h-dvh items-center justify-center px-4 py-10">
          <div className="w-full max-w-[26rem]">
            <div className="mb-8 flex flex-col items-center text-center">
              <PlatformWordmark height={64} />
              <h1 className="mt-7 text-[1.5rem] leading-tight font-semibold text-foreground">{title}</h1>
              {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
          </div>
        </main>
      </div>
    );
  }
  const tenant = await getTenantFromRequest().catch(() => null);
  const name = tenant?.settings.display_name ?? 'Yönetim Paneli';
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo name={name} logoUrl={brandingUrl(tenant?.settings.logo_url)} href="/" />
          <h1 className="mt-6 font-display text-[1.75rem] leading-tight text-foreground">{title}</h1>
          {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Siteye dön
          </Link>
        </p>
      </div>
    </main>
  );
}
