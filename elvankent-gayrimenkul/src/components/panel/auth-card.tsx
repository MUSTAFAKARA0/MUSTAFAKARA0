import Link from '@/components/common/intent-link';
import { Logo } from '@/components/brand/logo';
import { brandingUrl } from '@/modules/media/variants';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

/**
 * Ofis paneli giriş / şifre / doğrulama sayfalarının çerçevesi: bulunulan alan adındaki
 * ofisin markası. KARAY (platform) girişi için PlatformAuthCard kullanılır — bu dosya
 * KARAY yazı tipini içe aktarmaz, ofis girişleri onu yüklemez.
 */
export async function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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
