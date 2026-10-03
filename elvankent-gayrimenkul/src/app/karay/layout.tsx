import type { Metadata, Viewport } from 'next';
import { KarayFooter } from '@/components/karay/karay-footer';
import { KarayHeader } from '@/components/karay/karay-header';
import { karaySiteUrl } from '@/modules/karay/site';
import { getKarayProfile } from '@/modules/karay/profile';
import { PLATFORM_BRAND, PLATFORM_SCOPE, platformThemeCss } from '@/platform/branding/platform-brand';
import { platformFont } from '@/platform/branding/platform-font';

const DEFAULT_TITLE = 'KARAY · Gayrimenkul Teknolojileri ve SaaS Platformu';
const DEFAULT_DESCRIPTION =
  'Emlak ofisleri için web sitesi, ilan yönetimi, CRM, müşteri talepleri, marka ve tema yönetimini tek platformda toplayan gayrimenkul teknolojileri altyapısı.';

/**
 * KARAY'ın herkese açık şirket/ürün sayfası. Platform sahibinin sitesidir: emlak ofisi
 * (kiracı) sitelerinden, KARAY süper admin panelinden ve ofis panellerinden ayrıdır.
 * SEO kiracı SEO'sundan ayrıdır (Platform › KARAY ayarları).
 */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getKarayProfile();
  const base = await karaySiteUrl();
  const title = profile.seoTitle || DEFAULT_TITLE;
  const description = profile.seoDescription || DEFAULT_DESCRIPTION;
  return {
    metadataBase: new URL(base.origin),
    title: { default: title, template: `%s | ${PLATFORM_BRAND.name}` },
    description,
    applicationName: `${PLATFORM_BRAND.name} ${PLATFORM_BRAND.product}`,
    alternates: { canonical: base.path('/') },
    robots: profile.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      siteName: PLATFORM_BRAND.name,
      title,
      description,
      url: base.path('/'),
      images: [{ url: '/karay/og-karay.png', width: 1200, height: 630, alt: 'KARAY Gayrimenkul Teknolojileri' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/karay/og-karay.png'] },
    icons: {
      icon: [
        { url: PLATFORM_BRAND.icons.ico, sizes: '32x32' },
        { url: PLATFORM_BRAND.icons.svg, type: 'image/svg+xml' },
      ],
      apple: PLATFORM_BRAND.icons.apple,
    },
  };
}

export const viewport: Viewport = { themeColor: '#ffffff' };

export default async function KarayLayout({ children }: LayoutProps<'/karay'>) {
  const profile = await getKarayProfile();
  return (
    <div className={`${PLATFORM_SCOPE} ${platformFont.className} karay-site min-h-dvh bg-white text-foreground`}>
      <style href="platform-theme" precedence="high">
        {platformThemeCss(platformFont.style.fontFamily)}
      </style>
      <a href="#icerik" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        İçeriğe geç
      </a>
      <KarayHeader />
      <main id="icerik">{children}</main>
      <KarayFooter profile={profile} />
    </div>
  );
}
