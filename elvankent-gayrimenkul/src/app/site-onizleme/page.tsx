import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { decodePreviewPayload } from '@/site-factory/site-info';
import { buildPreviewModel } from '@/site-preview/model';
import { PreviewPage } from '@/site-preview/render';
import { parsePreviewSurface } from '@/site-preview/surfaces';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * GERÇEK ÖNİZLEME: ?p= manifest + site bilgileri (sihirbazdan), ?s= yüzey (ana sayfa, ilanlar,
 * ilan detayı). Yalnızca KARAY süper admini; kiracı alan adında rota yoktur (proxy 404). Girdi
 * kapalı şemayla doğrulanır; geçersizse 404. Kiracı sitesinin AYNI bileşenleri manifestten
 * derlenen yapılandırma ve örnek içerikle çizilir. Bağlantılar ve formlar devre dışıdır.
 */
export default async function SitePreviewPage({ searchParams }: PageProps<'/site-onizleme'>) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const payload = decodePreviewPayload(typeof sp.p === 'string' ? sp.p : null);
  if (!payload) notFound();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost'}`;
  let model;
  try {
    model = buildPreviewModel(payload, origin);
  } catch {
    notFound();
  }
  const { tenant, view, data, listing, detail } = model;
  const r = view.style;
  return (
    <PreviewPage
      surface={parsePreviewSurface(sp.s)}
      tenant={tenant}
      view={view}
      hasBlog={false}
      regions={data.regions.map((x) => ({ slug: x.slug, name: x.name }))}
      content={{ home: data, listing, detail }}
      label="Önizleme · örnek içerik"
      attributes={{
        'data-preview-family': payload.manifest.designFamily,
        'data-preview-site-type': payload.manifest.siteType,
        'data-preview-variants': [r.hero, r.headerLayout, r.card, r.cardLayout, r.footerLayout, r.motion].join(' '),
      }}
    />
  );
}
