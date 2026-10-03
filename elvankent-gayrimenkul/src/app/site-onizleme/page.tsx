import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { SiteFrame } from '@/components/site/site-frame';
import { SiteHome } from '@/components/site/site-home';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { decodePreviewPayload } from '@/site-factory/site-info';
import { buildPreviewModel } from '@/site-preview/model';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * GERÇEK ÖNİZLEME: ?p= manifest + site bilgileri (sihirbazdan). Yalnızca KARAY süper admini;
 * kiracı alan adında rota yoktur (proxy 404). Girdi kapalı şemayla doğrulanır; geçersizse 404.
 * Kiracı sitesinin AYNI bileşenleri (SiteFrame + SiteHome) manifestten derlenen yapılandırma ve
 * örnek içerikle çizilir. Önizlemede bağlantılar ve formlar devre dışıdır (gezinme yok).
 */
export default async function SitePreviewPage({ searchParams }: PageProps<'/site-onizleme'>) {
  await requireSuperAdminPage();
  const raw = (await searchParams).p;
  const payload = decodePreviewPayload(typeof raw === 'string' ? raw : null);
  if (!payload) notFound();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost'}`;
  let model;
  try {
    model = buildPreviewModel(payload, origin);
  } catch {
    notFound();
  }
  const { tenant, view, data } = model;
  const r = view.style;
  return (
    <div data-site-preview="" data-preview-family={payload.manifest.designFamily} data-preview-site-type={payload.manifest.siteType} data-preview-variants={[r.hero, r.headerLayout, r.card, r.cardLayout, r.footerLayout, r.motion].join(' ')}>
      <style href="site-preview-inert" precedence="low">
        {'[data-site-preview] a,[data-site-preview] button[type=submit],[data-site-preview] form{pointer-events:none}'}
      </style>
      <p className="fixed bottom-3 left-3 z-[70] rounded-full bg-neutral-900/85 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg" role="status">
        Önizleme · örnek içerik
      </p>
      <SiteFrame tenant={tenant} view={view} hasBlog={false} regions={data.regions.map((x) => ({ slug: x.slug, name: x.name }))} version="onizleme" mode="preview">
        <SiteHome tenant={tenant} view={view} data={data} />
      </SiteFrame>
    </div>
  );
}
