import type { Metadata, Viewport } from 'next';
import { RootDocument, rootMetadata, rootViewport } from '@/components/common/root-document';
import { baseFontVariables } from '@/components/ui/base-fonts';
import { buildTheme, themeCss } from '@/platform/branding/theme';
import { getTenantFromRequest } from '@/platform/tenant/tenant';
import '@/app/globals.css';

export const metadata: Metadata = {
  ...rootMetadata,
  title: { default: 'Yönetim Paneli', template: '%s | Yönetim Paneli' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
  // Bulunulan alan adındaki ofisin simgesi (ofis girişi o ofisin markasını taşır)
  icons: { icon: { url: '/site-icon', type: 'image/svg+xml' } },
};

export const viewport: Viewport = rootViewport('#f5f4f1');

/**
 * Ofis (emlakçı) paneli kökü: yalnızca temel yazı tipleri (Manrope, Fraunces) ve ortak
 * stiller yüklenir; kiracı sitesi tema CSS'i ve KARAY yazı tipi yüklenmez. Bulunulan alan
 * adındaki ofisin marka renkleri uygulanır.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromRequest().catch(() => null);
  const css = tenant ? themeCss(buildTheme(tenant.settings.primary_color, tenant.settings.accent_color)) : null;
  return (
    <RootDocument fontClassName={baseFontVariables}>
      <div className="min-h-dvh bg-[#f5f4f1] text-foreground">
        {css && tenant && (
          <style href={`theme-${tenant.id}`} precedence="high">
            {css}
          </style>
        )}
        {children}
      </div>
    </RootDocument>
  );
}
