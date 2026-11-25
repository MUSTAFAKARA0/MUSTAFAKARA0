import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Rocket } from 'lucide-react';
import { JsonLd } from '@/components/common/json-ld';
import { KarayLeadForm } from '@/components/karay/karay-lead-form';
import { KarayTourVideo } from '@/components/karay/karay-tour-video';
import { HelperMascot } from '@/components/brand/helper-mascot';
import { Bento } from '@/components/karay/bento';
import { Compare } from '@/components/karay/compare';
import { FAQ, PANEL_WORDS, ROLES, STEPS, FEATURES } from '@/components/karay/content';
import { FactsBand } from '@/components/karay/facts-band';
import { HeroStack } from '@/components/karay/hero-stack';
import { Reveal } from '@/components/karay/reveal';
import { RotatingWord } from '@/components/karay/rotating-word';
import { Security } from '@/components/karay/security';
import { ThemeStage } from '@/components/karay/theme-stage';
import { MotionToggle } from '@/components/karay/motion-toggle';
import { DesignGallery, GALLERY_FAMILIES } from '@/components/karay/design-gallery';
import { Timeline } from '@/components/karay/timeline';
import { Walkthrough } from '@/components/karay/walkthrough';
import { Wave } from '@/components/karay/wave';
import { Button } from '@/components/ui/button';
import { karaySiteUrl } from '@/modules/karay/site';
import { getKarayProfile } from '@/modules/karay/profile';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { parseSiteConfig } from '@/site-config/schema';
import { THEME_LIST } from '@/theme-engine/themes';
import './karay.css';

/*
 * KARAY şirket/ürün sayfası: "Canlı Vitrin" (taslaktan yayına). İçerik yalnızca platformda GERÇEKTEN var olan
 * özellikleri anlatır (components/karay/content.ts); müşteri sayısı, istatistik, referans veya yorum gibi
 * doğrulanmamış hiçbir bilgi yoktur. Ekran görüntüleri platformun kendisinden (örnek bir ofisle) alınmıştır; tema
 * önizlemeleri gerçek tema motoruyla çizilir. Ekran görüntüleri statik import edilir (bkz. hero-stack.tsx):
 * /karay/ yolu proxy'de alan adına göre korunur, görsel iyileştiricinin Host başlığı taşımayan iç isteği orada 404
 * alır (P3-F1); statik görsel /_next/static/media altından okunur (proxy'den geçmez).
 * Hareketler yalnızca "hareketi azalt" tercihi yokken çalışır; tercih varsa ya da JavaScript yoksa sayfa durağan ve eksiksizdir.
 */

export default async function KarayPage() {
  const profile = await getKarayProfile();
  const base = await karaySiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.companyName,
    description: 'Gayrimenkul teknolojileri ve SaaS platformu',
    url: `${base.origin}${base.path('/')}`,
    logo: `${base.origin}${PLATFORM_BRAND.icons.app}`,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.socials.length ? { sameAs: profile.socials.map((s) => s.href) } : {}),
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Saklanan "animasyonları durdur" tercihi hidratasyondan ÖNCE uygulanır (CSP script-src 'unsafe-inline' izin verir): hareket bir an bile oynamaz */}
      <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('ky:motion')==='off'){document.documentElement.setAttribute('data-motion','off');var s=document.querySelector('.karay-site');if(s)s.setAttribute('data-motion','off')}}catch(e){}" }} />
      {/* 1. Hero: koyu sahne, katmanlı cihaz yığını */}
      <section aria-labelledby="karay-hero" className="ky-hero ky-dark relative bg-[#0b1b3a] text-white [overflow:clip]">
        <div aria-hidden className="ky-mesh" />
        <div aria-hidden className="ky-grid ky-grid-fade" />
        <div aria-hidden className="ky-noise" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-4 pt-14 pb-36 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-10 lg:pt-24 lg:pb-48">
          <div className="min-w-0">
            <p className="ky-rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3.5 py-1.5 text-[12.5px] font-medium text-white/85">
              <span className="ky-pulse-dot" aria-hidden /> Gayrimenkul Teknolojileri ve SaaS Platformu
            </p>
            <h1 id="karay-hero" className="mt-6 text-[2.5rem] leading-[1.05] font-[650] tracking-[-0.025em] text-balance sm:text-[3.4rem] md:text-[clamp(2.5rem,5.2vw,4.5rem)] lg:text-[clamp(2.75rem,4.6vw,4.1rem)]">
              Emlak ofisinizin dijital altyapısı, tek platformda.
            </h1>
            <p className="ky-rise mt-6 max-w-xl text-[17px] leading-relaxed text-white/80 sm:text-[18px]" style={{ '--ky-d': '180ms' } as CSSProperties}>
              Web siteniz, ilanlarınız, müşteri talepleriniz ve markanız aynı panelde. Kendi alan adınızda, kendi markanızla; kod yazmadan yönetin, önce önizleyin, sonra yayınlayın.
            </p>
            <div className="ky-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-4" style={{ '--ky-d': '300ms' } as CSSProperties}>
              <Button asChild size="lg" className="ky-cta bg-white text-[#0b1b3a] hover:bg-white">
                <a href="#demo">
                  Demo talep et <ArrowRight className="ky-arrow" aria-hidden />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/35 bg-transparent text-white hover:border-white/70 hover:bg-white/10">
                <a href="#platform">Platformu keşfet</a>
              </Button>
              <a href="#tanitim" className="ky-textlink">
                <span className="ky-play" aria-hidden>
                  <Play className="size-3.5 fill-current" />
                </span>
                Tanıtım videosunu izle
              </a>
            </div>
            <RotatingWord lead="Hepsi tek panelde:" words={PANEL_WORDS} className="mt-9" />
            <ul className="mt-8 grid gap-2.5 text-[14.5px] text-white/80 sm:grid-cols-2">
              {['Kendi alan adınız ve markanız', `${THEME_LIST.length} profesyonel tema`, 'İlan, CRM ve talep yönetimi', 'Taslak → önizleme → yayın'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="ky-checksvg ky-checksvg-sm">
                    <circle cx="12" cy="12" r="10.5" />
                    <path className="ky-check" pathLength={1} d="M7 12.5l3.4 3.4L17 9" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
            <MotionToggle label="Hareketi durdur" className="mt-3 -ml-1" />
          </div>
          <HeroStack />
        </div>
        <Wave fill="#f4f7fb" />
      </section>

      {/* 2. Dürüst rakamlar: yalnızca içerik dizilerinin uzunlukları */}
      <div className="relative z-10 flow-root bg-[#f4f7fb] pb-4">
        <FactsBand
          items={[
            { value: THEME_LIST.length, label: 'tema', note: 'Gerçek tema motoruyla çizilen önizleme' },
            { value: GALLERY_FAMILIES.length, label: 'tasarım ailesi', note: 'Hazır düzen, renk ve tipografi birleşimleri' },
            { value: STEPS.length, label: 'adımda yayın', note: 'Tanışmadan canlı siteye' },
            { value: ROLES.length, label: 'yetki rolü', note: ROLES.join(', ') },
          ]}
        />
      </div>

      {/* Tanıtım videosu: gerçek ürün, örnek verilerle (~1 dk) */}
      <section id="tanitim" aria-labelledby="karay-tanitim" className="ky-dots relative scroll-mt-20 bg-[#f4f7fb]">
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-24">
          <Reveal className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#265fe8] uppercase">Tanıtım videosu</p>
            <h2 id="karay-tanitim" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              Platformu 1 dakikada görün
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-[#33415c]">
              Platform konsolu, ofis paneli, ilan ekleme, telefonda ofis sitesi ve temalar. Sessiz izlenebilir: ekran yazıları ve Türkçe altyazı var.
            </p>
          </Reveal>
          <figure className="ky-cinema-wrap mt-10 min-w-0">
            <KarayTourVideo />
            <figcaption className="mt-4 text-center text-[12.5px] text-[#4a5871]">Gerçek ürün ekranları · örnek (demo) ofis verisiyle</figcaption>
          </figure>
        </div>
      </section>

      {/* 2–4. KARAY nedir? · Problemler · Çözüm */}
      <section id="hakkimizda" aria-labelledby="karay-nedir" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="max-w-3xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#265fe8] uppercase">{PLATFORM_BRAND.name} nedir?</p>
            <h2 id="karay-nedir" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              Emlak ofisleri için geliştirilen bir gayrimenkul teknolojileri platformu
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-[#33415c]">
              {PLATFORM_BRAND.name} bir emlak ofisi değildir; emlak ofislerine yazılım altyapısı sağlar. Her ofis platformda kendi markasıyla, kendi alan adında, kendi web sitesini ve iş süreçlerini yönetir. Ofislerin verileri birbirinden tamamen ayrıdır.
            </p>
          </Reveal>
          <Compare />
        </div>
      </section>

      {/* 5. Özellikler */}
      <section id="ozellikler" aria-labelledby="karay-ozellikler" className="ky-dots relative scroll-mt-20 bg-[#f4f7fb]">
        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-28 sm:px-6 lg:pt-28 lg:pb-36">
          <Reveal className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#265fe8] uppercase">Platform özellikleri</p>
            <h2 id="karay-ozellikler" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              Bir emlak ofisinin dijitalde ihtiyaç duyduğu her şey
            </h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-[#33415c]">{FEATURES.length} özellik, tek panelde.</p>
          </Reveal>
          <Bento />
        </div>
      </section>

      {/* 6–11, 16. Platform: Site Kontrol Merkezi ve yayın akışı (sticky anlatım) */}
      <Walkthrough />

      {/* Tasarım aileleri: her ailenin gerçek önizlemesinden ana sayfa görüntüsü */}
      <section id="tasarimlar" aria-labelledby="karay-tasarimlar" className="relative scroll-mt-20 overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:pt-20">
          <Reveal className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#265fe8] uppercase">Tasarım aileleri</p>
            <h2 id="karay-tasarimlar" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              Her ofise kendine özgü bir site
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[#33415c]">
              Aileler yalnızca renk ve yazı değiştirmez: hero düzeni, header, kart yapısı, footer, doku ve hareket dili baştan farklıdır. Sinematik bir vitrin, dergi düzeni, harita öncelikli ya da sade bir galeri; hepsi kendi ilanlarınız ve markanızla.
            </p>
          </Reveal>
        </div>
        <div className="mt-12 pb-24 lg:pb-32">
          <DesignGallery />
          <p className="mx-auto mt-2 max-w-7xl px-4 text-[12.5px] text-[#4a5871] sm:px-6">Gerçek önizleme ekranları · örnek içerikle</p>
        </div>
      </section>

      {/* 17. Temalar: koyu sahne */}
      <section id="temalar" aria-labelledby="karay-temalar" className="ky-dark relative scroll-mt-20 bg-[#0b1b3a] text-white [overflow-x:clip]">
        <Wave fill="#ffffff" position="top" />
        <div aria-hidden className="ky-mesh ky-mesh-soft" />
        <div aria-hidden className="ky-noise" />
        <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-28 sm:px-6 lg:pt-36 lg:pb-36">
          <Reveal className="max-w-2xl">
            <p className="ky-eyebrow-dark">Temalar</p>
            <h2 id="karay-temalar" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              {THEME_LIST.length} tema, her biri farklı bir karakter
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-white/80">
              Temalar yalnızca renk değildir: yazı tipi, köşeler, kartlar, header, ana sayfa düzeni, düğmeler ve görsel işleme değişir. Önizleme, emlak sitelerinin kullandığı gerçek tema motoruyla çizilir.
            </p>
          </Reveal>
          <div className="mt-12">
            <ThemeStage baseConfig={parseSiteConfig({})} />
          </div>
        </div>
        <Wave fill="#f4f7fb" />
      </section>

      {/* 15. Güvenlik */}
      <Security />

      {/* 18. Nasıl çalışır? */}
      <section id="nasil-calisir" aria-labelledby="karay-nasil" className="ky-dark relative scroll-mt-20 bg-[#0b1b3a] text-white [overflow-x:clip]">
        <Wave fill="#f4f7fb" position="top" />
        <div aria-hidden className="ky-grid ky-grid-fade" />
        <div aria-hidden className="ky-noise" />
        <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-28 sm:px-6 lg:pt-36 lg:pb-36">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-[#1cc8b6] uppercase">Nasıl çalışır?</p>
          <h2 id="karay-nasil" className="mt-3 max-w-2xl text-[1.9rem] leading-tight font-semibold tracking-tight sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
            Tanışmadan yayına dört adım
          </h2>
          <Timeline />
          <div className="mt-14 flex flex-wrap gap-3">
            <Button asChild size="lg" className="ky-cta bg-white text-[#0b1b3a] hover:bg-white">
              <a href="#demo">
                <Rocket /> Demo talep et
              </a>
            </Button>
          </div>
        </div>
        <Wave fill="#ffffff" />
      </section>

      {/* 20. İletişim */}
      <section id="iletisim" aria-labelledby="karay-iletisim" className="ky-contact relative scroll-mt-20 bg-white">
        <span id="demo" className="block scroll-mt-20" aria-hidden />
        <div aria-hidden className="ky-contact-mesh" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <Reveal className="min-w-0">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#265fe8] uppercase">İletişim</p>
            <h2 id="karay-iletisim" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
              Ofisiniz için konuşalım
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[#33415c]">
              Bilgi almak veya platformu canlı görmek için formu doldurun. Talebiniz yalnızca {PLATFORM_BRAND.name} ekibine iletilir; herhangi bir emlak ofisiyle paylaşılmaz.
            </p>
            {(profile.email || profile.phone || profile.address) && (
              <dl className="mt-8 space-y-3 text-[15px]">
                {profile.email && (
                  <div>
                    <dt className="text-[12.5px] font-semibold text-[#5b6b85]">E-posta</dt>
                    <dd>
                      <a href={`mailto:${profile.email}`} className="font-semibold break-all text-[#0b1b3a] hover:underline">
                        {profile.email}
                      </a>
                    </dd>
                  </div>
                )}
                {profile.phone && (
                  <div>
                    <dt className="text-[12.5px] font-semibold text-[#5b6b85]">Telefon</dt>
                    <dd>
                      <a href={`tel:${profile.phone.replace(/[^+0-9]/g, '')}`} className="font-semibold text-[#0b1b3a] hover:underline">
                        {profile.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {(profile.address || profile.city) && (
                  <div>
                    <dt className="text-[12.5px] font-semibold text-[#5b6b85]">Adres</dt>
                    <dd className="text-[#33415c]">{[profile.address, profile.city].filter(Boolean).join(', ')}</dd>
                  </div>
                )}
              </dl>
            )}
            {/* Yardımcı maskot: bu bölümün gerçek destek kanalının (iletişim formu) görsel yüzü; dekoratif */}
            <HelperMascot width={144} sizes="(min-width: 1024px) 144px, (min-width: 640px) 112px, 96px" className="mt-10 h-auto w-24 sm:w-28 lg:w-36" />
          </Reveal>
          <div className="ky-form-card min-w-0 p-6 sm:p-8">
            <KarayLeadForm />
          </div>
        </div>
      </section>

      {/* 21. SSS */}
      <section aria-labelledby="karay-sss" className="relative bg-[#f4f7fb]">
        <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 lg:pt-24 lg:pb-40">
          <h2 id="karay-sss" className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.1rem]">
            Sık sorulan sorular
          </h2>
          <div className="ky-faq mt-8 divide-y divide-[#e3e8f0] rounded-2xl border border-[#e3e8f0] bg-white shadow-[var(--ky-shadow-1)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4 sm:px-6">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-semibold text-[#0b1b3a] marker:hidden">
                  {f.q}
                  <span aria-hidden className="ky-plus">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#33415c]">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-[14.5px] text-[#4a5871]">
            Başka bir sorunuz mu var?{' '}
            <Link href="/karay#iletisim" className="font-semibold text-[#0b1b3a] underline underline-offset-2">
              Bize yazın
            </Link>
          </p>
        </div>
        <Wave fill="#0b1b3a" />
      </section>
    </>
  );
}
