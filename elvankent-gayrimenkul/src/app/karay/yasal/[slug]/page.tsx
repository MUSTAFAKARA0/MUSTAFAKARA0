import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findKarayLegal, KARAY_LEGAL } from '@/modules/karay/legal';

export function generateStaticParams() {
  return KARAY_LEGAL.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<'/karay/yasal/[slug]'>): Promise<Metadata> {
  const doc = findKarayLegal((await params).slug);
  // Taslak metinler arama motorlarına kapalıdır
  return { title: doc ? `${doc.title} (taslak)` : 'Bulunamadı', robots: { index: false, follow: true } };
}

/** KARAY yasal metinleri — TASLAK (hukuki onay ve şirket bilgileri bekleniyor) */
export default async function KarayLegalPage({ params }: PageProps<'/karay/yasal/[slug]'>) {
  const doc = findKarayLegal((await params).slug);
  if (!doc) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
      <nav aria-label="Konum" className="text-[13px] text-[#5b6b85]">
        <Link href="/karay" className="hover:text-[#0b1b3a]">
          KARAY
        </Link>{' '}
        › <span className="text-[#0b1b3a]">{doc.title}</span>
      </nav>
      <h1 className="mt-4 text-[2rem] leading-tight font-semibold tracking-tight text-[#0b1b3a]">{doc.title}</h1>
      <p role="note" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-900">
        TASLAK — Bu metin henüz hukuki olarak onaylanmamıştır; köşeli parantez içindeki bilgiler şirket tarafından girilecektir.
      </p>
      <div className="mt-8 space-y-7">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[17px] font-semibold text-[#0b1b3a]">{s.heading}</h2>
            <p className="mt-2 text-[15.5px] leading-relaxed text-[#33415c]">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
