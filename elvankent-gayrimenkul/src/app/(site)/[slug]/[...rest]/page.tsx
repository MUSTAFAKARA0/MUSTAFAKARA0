import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { findRedirect } from '@/lib/data/properties';

/**
 * Çok segmentli bilinmeyen yollar (ör. eski sitenin /ilanlar/detay/123 adresleri).
 * Veritabanındaki `redirects` tablosunda karşılığı varsa 301/302 ile yönlendirir.
 */
export default async function LegacyPathPage({ params }: PageProps<'/[slug]/[...rest]'>) {
  const { slug, rest } = await params;
  const path = `/${[slug, ...rest].map(encodeURIComponent).join('/')}`;
  const r = await findRedirect(decodeURIComponent(path));
  if (r) {
    if (r.status_code === 301 || r.status_code === 308) permanentRedirect(r.to_path);
    redirect(r.to_path);
  }
  notFound();
}
