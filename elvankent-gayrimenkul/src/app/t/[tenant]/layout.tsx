import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { CompareBar, CookieConsent, FloatingWhatsApp } from '@/components/layout/site-extras';
import { whatsappHref } from '@/lib/contact-links';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { brandingUrl } from '@/modules/media/variants';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { buildTheme, themeCss } from '@/platform/branding/theme';
import { requireTenant } from '@/platform/tenant/tenant';

export async function generateMetadata({ params }: LayoutProps<'/t/[tenant]'>): Promise<Metadata> {
  const tenant = await requireTenant((await params).tenant);
  const s = tenant.settings;
  const name = s.display_name;
  const description =
    s.seo_description ??
    s.description ??
    `${name}: ${s.service_area ? `${s.service_area} ` : ''}satılık ve kiralık daire, villa, ticari gayrimenkul ve arsa ilanları.`;
  const favicon = brandingUrl(s.favicon_url);
  const og = siteOgImage(tenant);
  return {
    metadataBase: new URL(tenant.baseUrl),
    title: { default: s.seo_title ?? `${name} | Satılık ve kiralık gayrimenkuller`, template: `%s | ${name}` },
    description,
    applicationName: name,
    openGraph: { type: 'website', ...baseOpenGraph(tenant), images: [og] },
    twitter: { card: 'summary_large_image', images: [og] },
    manifest: '/manifest.webmanifest',
    ...(favicon ? { icons: { icon: favicon, apple: favicon } } : {}),
    verification: {
      google: s.google_site_verification ?? process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? undefined,
    },
  };
}

export default async function TenantLayout({ children, params }: LayoutProps<'/t/[tenant]'>) {
  const tenant = await requireTenant((await params).tenant);
  const [posts, regions] = await Promise.all([getPublishedPosts(tenant.id, 1), getRegionPages(tenant.id)]);
  const s = tenant.settings;
  const css = themeCss(buildTheme(s.primary_color, s.accent_color));
  return (
    <>
      <style href={`theme-${tenant.id}`} precedence="high">
        {css}
      </style>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        İçeriğe geç
      </a>
      <SiteHeader tenant={tenant} hasBlog={posts.length > 0} />
      <main id="icerik" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter tenant={tenant} regions={regions.map((r) => ({ slug: r.slug, name: r.name }))} hasBlog={posts.length > 0} />
      <FloatingWhatsApp href={whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.')} />
      <CompareBar />
      <CookieConsent />
    </>
  );
}
