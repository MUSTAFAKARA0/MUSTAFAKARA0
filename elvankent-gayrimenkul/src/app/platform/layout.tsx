import type { Metadata, Viewport } from 'next';
import { RootDocument, rootViewport } from '@/components/common/root-document';
import { PLATFORM_BRAND, PLATFORM_SCOPE, platformThemeCss } from '@/platform/branding/platform-brand';
import { platformFont } from '@/platform/branding/platform-font';
import '@/app/globals.css';

const title = `${PLATFORM_BRAND.name} · ${PLATFORM_BRAND.consoleName}`;

export const metadata: Metadata = {
  formatDetection: { telephone: false },
  title: { default: title, template: `%s | ${title}` },
  applicationName: `${PLATFORM_BRAND.name} ${PLATFORM_BRAND.product}`,
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
  // KARAY simgesi (logo paketi); kiracı simgesi kullanılmaz
  icons: {
    icon: [
      { url: PLATFORM_BRAND.icons.ico, sizes: '32x32' },
      { url: PLATFORM_BRAND.icons.svg, type: 'image/svg+xml' },
    ],
    apple: PLATFORM_BRAND.icons.apple,
  },
};

export const viewport: Viewport = rootViewport(PLATFORM_BRAND.headerBackground);

/**
 * KARAY platform alanının kökü: platform markası, teması ve yazı tipi (Poppins). Kiracı
 * sitesi tema CSS'i ve tema yazı tipleri yüklenmez (yalnızca site oluşturucunun tema
 * önizlemesi kendi ihtiyacını yükler). Kiracı (emlak ofisi)
 * teması, logosu veya simgesi bu alanda kullanılmaz; platform teması da yalnızca
 * bu kapsayıcının içinde geçerlidir (kiracı sitelerini/panellerini etkilemez).
 */
export default function PlatformRootLayout({ children }: LayoutProps<'/platform'>) {
  return (
    <RootDocument>
      <div className={`${PLATFORM_SCOPE} ${platformFont.className} min-h-dvh bg-background text-foreground`}>
        <style href="platform-theme" precedence="high">
          {platformThemeCss(platformFont.style.fontFamily)}
        </style>
        {children}
      </div>
    </RootDocument>
  );
}
