import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteView, type SiteView } from '@/site-config/load';
import type { PageKey, PageSettings } from '@/site-config/schema';
import type { Tenant } from '@/platform/tenant/tenant';

/** Sayfa sitede açık mı (KARAY › Sayfalar'dan gizlenmiş veya özelliği kapalıysa hayır) */
export function isPageAvailable(view: SiteView, key: PageKey): boolean {
  if (key === 'blog' && !view.features.blog) return false;
  if (key === 'degerleme' && !view.features.valuation) return false;
  return view.config.pages[key]?.visible !== false;
}

/** Sayfa bileşenleri için: gizliyse 404 */
export async function guardSitePage(tenant: Tenant, key: PageKey): Promise<PageSettings | undefined> {
  const view = await getSiteView(tenant);
  if (!isPageAvailable(view, key)) notFound();
  return view.config.pages[key];
}

export async function sitePageSettings(tenant: Tenant, key: PageKey): Promise<PageSettings | undefined> {
  return (await getSiteView(tenant)).config.pages[key];
}

/** Sayfa SEO ayarlarını (başlık, açıklama, paylaşım başlığı/açıklaması) sayfanın varsayılanlarının üzerine uygular */
export function applyPageSeo(p: PageSettings | undefined, meta: Metadata): Metadata {
  if (!p) return meta;
  const title = p.seoTitle ?? meta.title;
  const description = p.seoDescription ?? meta.description;
  const og = p.ogTitle || p.ogDescription ? { ...(meta.openGraph ?? {}), ...(p.ogTitle ? { title: p.ogTitle } : {}), ...(p.ogDescription ? { description: p.ogDescription } : {}) } : meta.openGraph;
  return { ...meta, title, description, ...(og ? { openGraph: og } : {}) };
}
