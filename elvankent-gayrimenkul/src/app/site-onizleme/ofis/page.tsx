import type { Metadata } from 'next';
import { loadOfficePreview } from '@/site-preview/office';
import { PreviewPage } from '@/site-preview/render';
import { parsePreviewSurface } from '@/site-preview/surfaces';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * OFİS TASARIM ÖNİZLEMESİ çerçevesi (Ofis paneli › Site tasarımı › Önizle). ?aile= izinli tasarım
 * ailesi, ?s= yüzey. Yetki, aile izni ve veri kapsamı site-preview/office.ts'te doğrulanır.
 * Kiracı sitesinin AYNI bileşenleri ofisin gerçek (yayındaki) verisiyle çizilir; hiçbir şey yayınlanmaz.
 */
export default async function OfficeDesignPreviewPage({ searchParams }: PageProps<'/site-onizleme/ofis'>) {
  const sp = await searchParams;
  const surface = parsePreviewSurface(sp.s);
  const p = await loadOfficePreview(sp.aile, surface);
  return (
    <PreviewPage
      surface={surface}
      tenant={p.tenant}
      view={p.view}
      hasBlog={p.hasBlog}
      regions={p.regions}
      content={p.content}
      label={`Önizleme · ${p.family.name} · yayınlanmadı`}
      attributes={{ 'data-preview-family': p.family.id }}
      empty={
        <div className="container-page py-24 text-center">
          <p className="font-display text-display-lg text-foreground">Henüz yayında ilanınız yok</p>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">İlan detayı önizlemesi, sitenizde yayında olan ilanlarınızdan biriyle gösterilir.</p>
        </div>
      }
    />
  );
}
