import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { ContactCta, ServicesGrid } from '@/components/home/home-sections';
import { VALUES } from '@/content/site-content';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { getSiteSettings } from '@/lib/data/settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    title: 'Hakkımızda',
    description: `${s.business_name} hakkında: Etimesgut ve Elvankent bölgesinde konut, iş yeri ve arsa danışmanlığı.`,
    alternates: { canonical: '/hakkimizda' },
  };
}

export default async function AboutPage() {
  const s = await getSiteSettings();
  const paragraphs = (s.about_text ?? '').split(/\n{2,}/).filter(Boolean);
  return (
    <>
      <PageHeader title="Hakkımızda" eyebrow={s.business_name} path="/hakkimizda" description={s.tagline ?? undefined} />
      <div className="container-page space-y-16 py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5 text-[16px] leading-[1.85] text-sand-800">
            {paragraphs.length ? (
              paragraphs.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>Hakkımızda metni yönetim paneli &gt; Ayarlar bölümünden düzenlenebilir.</p>
            )}
          </div>
          <ul className="grid gap-4">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-surface p-5 ring-1 ring-line/80">
                <Icon className="size-6 shrink-0 text-accent-600" aria-hidden />
                <div>
                  <h2 className="font-bold text-ink">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-sand-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <section aria-labelledby="h-hizmet">
          <h2 id="h-hizmet" className="font-display text-2xl text-ink sm:text-3xl">
            Neler yapıyoruz?
          </h2>
          <div className="mt-6">
            <ServicesGrid />
          </div>
        </section>
        <ContactCta tel={telHref(s.phone)} whatsapp={whatsappHref(s.whatsapp ?? s.phone, `Merhaba, ${s.business_name} web sitesinden yazıyorum.`)} />
      </div>
    </>
  );
}
