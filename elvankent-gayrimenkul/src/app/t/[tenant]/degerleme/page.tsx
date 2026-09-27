import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { LeadForm } from '@/components/forms/lead-form';
import { requireTenant } from '@/platform/tenant/tenant';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Gayrimenkul değerleme talebi',
  description: 'Satmak veya kiraya vermek istediğiniz gayrimenkulün bilgilerini paylaşın; bölgedeki güncel piyasa koşullarıyla birlikte değerlendirip size dönüş yapalım.',
  alternates: { canonical: '/degerleme' },
};

const POINTS = [
  'Mülkünüzün konum, alan, oda sayısı ve bina yaşı bilgilerini paylaşırsınız.',
  'Bölgedeki benzer ilanlar ve güncel piyasa koşullarıyla birlikte değerlendiririz.',
  'Satış veya kiralama için gerçekçi bir fiyat aralığı ve pazarlama önerisiyle size dönüş yaparız.',
];

/**
 * Değerleme talebi (lead formu). Sistem otomatik "tahmini değer" ÜRETMEZ:
 * gerçek bir veri modeli olmadan rakam vermek yanıltıcı olur.
 */
export default async function ValuationPage({ params }: PageProps<'/t/[tenant]/degerleme'>) {
  const tenant = await requireTenant((await params).tenant);
  return (
    <>
      <PageHeader
        tenant={tenant}
        eyebrow="Mülk sahipleri için"
        title="Gayrimenkulünüzün değerini birlikte belirleyelim"
        description="Satmak veya kiraya vermek istediğiniz gayrimenkulün bilgilerini paylaşın; uzman gözüyle değerlendirip size dönüş yapalım."
        crumbs={[{ name: 'Değerleme talebi', path: '/degerleme' }]}
      />
      <div className="container-page grid grid-cols-1 gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <h2 className="font-display text-2xl">Nasıl işler?</h2>
          <ol className="mt-6 space-y-5">
            {POINTS.map((p, i) => (
              <li key={p} className="flex gap-4">
                <span className="numeric flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-ink">
                  {i + 1}
                </span>
                <p className="pt-1.5 text-[15.5px] leading-relaxed text-foreground/85">{p}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex gap-2.5 rounded-2xl bg-surface-muted p-4 text-sm leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Resmi değerleme raporu (ör. kredi işlemleri için) yalnızca SPK lisanslı değerleme uzmanlarınca hazırlanabilir; gerektiğinde
            sizi yönlendiririz.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-surface p-6 shadow-sm sm:p-8">
          <LeadForm kind="valuation" />
        </div>
      </div>
    </>
  );
}
