import type { Metadata, Viewport } from 'next';
import { buildTheme, themeCss } from '@/platform/branding/theme';
import { getTenantFromRequest } from '@/platform/tenant/tenant';

export const metadata: Metadata = {
  title: { default: 'Yönetim Paneli', template: '%s | Yönetim Paneli' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

export const viewport: Viewport = { themeColor: '#f5f4f1' };

/** Yönetim paneli kökü: bulunulan alan adındaki ofisin marka renkleri uygulanır */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantFromRequest().catch(() => null);
  const css = tenant ? themeCss(buildTheme(tenant.settings.primary_color, tenant.settings.accent_color)) : null;
  return (
    <div className="min-h-dvh bg-[#f5f4f1] text-foreground">
      {css && tenant && (
        <style href={`theme-${tenant.id}`} precedence="high">
          {css}
        </style>
      )}
      {children}
    </div>
  );
}
