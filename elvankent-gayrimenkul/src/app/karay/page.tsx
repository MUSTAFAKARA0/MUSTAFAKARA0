import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  FileClock,
  Globe,
  Inbox,
  LayoutTemplate,
  Lock,
  Palette,
  Rocket,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { JsonLd } from '@/components/common/json-ld';
import { KarayLeadForm } from '@/components/karay/karay-lead-form';
import { ThemeShowcase } from '@/components/karay/theme-showcase';
import { Button } from '@/components/ui/button';
import { karaySiteUrl } from '@/modules/karay/site';
import { getKarayProfile } from '@/modules/karay/profile';
import { parseSiteConfig } from '@/platform/site/schema';
import { THEME_LIST } from '@/theme-engine/themes';

/*
 * KARAY şirket/ürün sayfası. İçerik yalnızca platformda GERÇEKTEN var olan özellikleri
 * anlatır; müşteri sayısı, istatistik, referans veya yorum gibi doğrulanmamış hiçbir bilgi
 * yoktur. Ekran görüntüleri platformun kendisinden (örnek bir ofisle) alınmıştır; tema
 * önizlemeleri gerçek tema motoruyla çizilir.
 */

const FEATURES = [
  { icon: LayoutTemplate, title: 'Profesyonel emlak web sitesi', text: 'Hazır sayfalar: ilanlar, bölgeler, hizmetler, değerleme talebi, blog, iletişim. Kod yazmadan yayına alınır.' },
  { icon: Building2, title: 'İlan yönetimi', text: 'Adım adım ilan girişi, çoklu fotoğraf, taslak ve onay akışı, satıldı/kiralandı durumu, PDF broşür ve QR kod.' },
  { icon: Users, title: 'CRM ve müşteri yönetimi', text: 'Müşteri kartları, randevular, ilan koleksiyonları ve müşteriye özel paylaşım bağlantıları.' },
  { icon: Inbox, title: 'Talep yönetimi', text: 'Web sitesinden gelen iletişim, ilan ve değerleme talepleri tek listede; e-posta bildirimi ve durum takibi.' },
  { icon: Palette, title: 'Marka ve tema', text: `${THEME_LIST.length} farklı tema, hazır renk paletleri, yazı tipi, logo ve header/footer ayarları. Her ofis kendi markasıyla.` },
  { icon: Eye, title: 'Taslak → önizleme → yayın', text: 'Değişiklikler önce taslağa kaydedilir, canlı siteyi bozmadan önizlenir, tek tıkla yayınlanır; eski sürüme dönülebilir.' },
  { icon: Search, title: 'SEO', text: 'Sayfa başlıkları, açıklamalar, paylaşım görselleri, site haritası, kanonik adresler ve yapılandırılmış veri (RealEstateAgent).' },
  { icon: Globe, title: 'Kendi alan adınız', text: 'Site kendi alan adınızda yayınlanır; DNS adımları panelde gösterilir.' },
  { icon: Smartphone, title: 'Mobil uyumlu', text: 'Site ve yönetim paneli telefonda uygulama gibi çalışır: menü, filtreler, formlar ve fotoğraflar mobile göre tasarlandı.' },
  { icon: BarChart3, title: 'Ölçüm', text: 'İlan görüntülenme, favori, WhatsApp ve telefon tıklamaları ile talep kaynakları panelde; yalnızca gerçek veriler.' },
  { icon: ShieldCheck, title: 'Güvenlik ve yalıtım', text: 'Her ofisin verisi veritabanı düzeyinde (RLS) ayrıdır; rol bazlı yetki, iki adımlı doğrulama ve işlem kayıtları.' },
  { icon: FileClock, title: 'Sürüm geçmişi', text: 'Her yayın bir sürümdür; kim, ne zaman, hangi notla yayınladı görülür ve önceki sürüme dönülür.' },
];

const PROBLEMS = [
  'Web sitesi bir ajansa bağlı; küçük bir değişiklik için bile beklemek gerekiyor.',
  'İlanlar, müşteriler ve gelen talepler farklı yerlerde dağınık duruyor.',
  'Site hazır bir şablona benziyor; ofisin kendi markasını yansıtmıyor.',
  'Telefonda yavaş ya da kullanışsız bir site ziyaretçiyi kaybettiriyor.',
  'Arama motorlarında görünürlük için teknik ayarlar yapılmamış.',
];

const SOLUTIONS = [
  'Web siteniz, ilanlarınız ve müşterileriniz tek panelde.',
  'Markanızı, temanızı ve menünüzü kendiniz yönetin; önce önizleyin, sonra yayınlayın.',
  'Siteden gelen her talep otomatik olarak panelinize düşer.',
  'Mobil öncelikli, hızlı ve SEO uyumlu altyapı hazır gelir.',
  'Kendi alan adınız, kendi logonuz: sitede platformun değil, sizin markanız görünür.',
];

const STEPS = [
  { title: 'Tanışma', text: 'Formu doldurun; ofisinizi, ilan sayınızı ve ihtiyaçlarınızı konuşalım.' },
  { title: 'Kurulum', text: 'Ofisiniz platformda açılır; logo, renkler, tema ve iletişim bilgileriniz taslak olarak hazırlanır.' },
  { title: 'Önizleme ve alan adı', text: 'Sitenizi yayından önce önizlersiniz; alan adınız bağlanır.' },
  { title: 'Yayın ve yönetim', text: 'Site yayına alınır; ilanlarınızı, taleplerinizi ve müşterilerinizi kendi panelinizden yönetirsiniz.' },
];

const FAQ = [
  { q: 'KARAY bir emlak ofisi mi?', a: 'Hayır. KARAY, emlak ofislerine yazılım altyapısı sağlayan bir gayrimenkul teknolojileri şirketidir. İlan sahibi değildir, emlak hizmeti vermez.' },
  { q: 'Sitemde KARAY adı görünür mü?', a: 'Hayır. Siteniz kendi logonuz, adınız, renkleriniz ve alan adınızla yayınlanır (beyaz etiket).' },
  { q: 'Mevcut alan adımı kullanabilir miyim?', a: 'Evet. Alan adınız platforma bağlanır; gerekli DNS kayıtları panelde adım adım gösterilir.' },
  { q: 'Verilerim diğer ofislerle karışır mı?', a: 'Hayır. Her ofisin ilanları, müşterileri ve talepleri veritabanı düzeyinde ayrıdır; bir ofis başka bir ofisin verisini göremez.' },
  { q: 'Sitenin görünümünü kendim değiştirebilir miyim?', a: `Evet. ${THEME_LIST.length} tema, renk paletleri, yazı tipleri, menü, ana sayfa bölümleri ve footer ayarlanabilir. Değişiklikler önce taslakta önizlenir, sonra yayınlanır.` },
  { q: 'Fiyatlandırma nasıl?', a: 'Ofisinizin ihtiyaçlarına göre bilgi veriyoruz. "Bilgi al" formunu doldurmanız yeterli.' },
];

export default async function KarayPage() {
  const profile = await getKarayProfile();
  const base = await karaySiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.companyName,
    description: 'Gayrimenkul teknolojileri ve SaaS platformu',
    url: `${base.origin}${base.path('/')}`,
    logo: `${base.origin}/platform/uygulama-ikonu-512.png`,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.socials.length ? { sameAs: profile.socials.map((s) => s.href) } : {}),
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      {/* 1. Hero */}
      <section aria-labelledby="karay-hero" className="relative overflow-hidden bg-[#0b1b3a] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24 lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12.5px] font-medium text-white/80">
              <span className="size-1.5 rounded-full bg-[#1cc8b6]" aria-hidden /> Gayrimenkul Teknolojileri ve SaaS Platformu
            </p>
            <h1 id="karay-hero" className="mt-6 text-[2.35rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-[3.1rem] lg:text-[3.5rem]">
              Emlak ofisinizin dijital altyapısı, tek platformda.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-[18px]">
              Web siteniz, ilanlarınız, müşteri talepleriniz ve markanız aynı panelde. Kendi alan adınızda, kendi markanızla; kod yazmadan yönetin, önce önizleyin, sonra yayınlayın.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-[#0b1b3a] hover:bg-white/90">
                <a href="#demo">Demo talep et</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/10">
                <a href="#platform">Platformu keşfet</a>
              </Button>
            </div>
            <ul className="mt-10 grid gap-2 text-[14.5px] text-white/75 sm:grid-cols-2">
              {['Kendi alan adınız ve markanız', `${THEME_LIST.length} profesyonel tema`, 'İlan, CRM ve talep yönetimi', 'Taslak → önizleme → yayın'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-[#1cc8b6]" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <figure className="relative min-w-0">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)]">
              <div className="flex items-center gap-1.5 border-b border-[#e3e8f0] bg-[#f4f7fb] px-4 py-2.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#dfe5ee]" />
                <span className="size-2.5 rounded-full bg-[#dfe5ee]" />
                <span className="size-2.5 rounded-full bg-[#dfe5ee]" />
                <span className="ml-3 truncate text-[11.5px] text-[#5b6b85]">KARAY · Site Kontrol Merkezi</span>
              </div>
              <Image
                src="/karay/ekran-kontrol-merkezi.png"
                alt="KARAY Site Kontrol Merkezi: bir emlak ofisi sitesinin tema galerisi, canlı ve taslak durumu"
                width={1440}
                height={900}
                sizes="(min-width: 1024px) 600px, 100vw"
                priority
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-center text-[12.5px] text-white/55">Gerçek ekran görüntüsü · örnek ofis verisiyle</figcaption>
          </figure>
        </div>
      </section>

      {/* 2–4. KARAY nedir? · Problemler · Çözüm */}
      <section id="hakkimizda" aria-labelledby="karay-nedir" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#2f6bff] uppercase">KARAY nedir?</p>
            <h2 id="karay-nedir" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem]">
              Emlak ofisleri için geliştirilen bir gayrimenkul teknolojileri platformu
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-[#33415c]">
              KARAY bir emlak ofisi değildir; emlak ofislerine yazılım altyapısı sağlar. Her ofis platformda kendi markasıyla, kendi alan adında, kendi web sitesini ve iş süreçlerini yönetir. Ofislerin verileri birbirinden tamamen ayrıdır.
            </p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e3e8f0] bg-[#f8fafc] p-7 sm:p-9">
              <h3 className="text-[18px] font-semibold text-[#0b1b3a]">Emlak ofislerinin sık karşılaştığı sorunlar</h3>
              <ul className="mt-5 space-y-3.5">
                {PROBLEMS.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-[#33415c]">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9aa8c0]" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-[#0b1b3a] p-7 text-white sm:p-9">
              <h3 className="text-[18px] font-semibold">KARAY ile</h3>
              <ul className="mt-5 space-y-3.5">
                {SOLUTIONS.map((s) => (
                  <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1cc8b6]" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Özellikler */}
      <section id="ozellikler" aria-labelledby="karay-ozellikler" className="scroll-mt-20 bg-[#f4f7fb]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#2f6bff] uppercase">Platform özellikleri</p>
            <h2 id="karay-ozellikler" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem]">
              Bir emlak ofisinin dijitalde ihtiyaç duyduğu her şey
            </h2>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#e3e8f0] bg-[#e3e8f0] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="bg-white p-6 sm:p-7">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#eef3ff] text-[#2f6bff]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[16.5px] font-semibold text-[#0b1b3a]">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#4a5871]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6–11, 16. Platform: Site Kontrol Merkezi ve yayın akışı */}
      <section id="platform" aria-labelledby="karay-platform" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-28">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#2f6bff] uppercase">Site Kontrol Merkezi</p>
            <h2 id="karay-platform" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem]">
              Web sitenizi tek panelden yönetin
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[#33415c]">
              Marka, tema, renkler, yazı tipi, header, ana sayfa bölümleri, sayfalar, menü, footer, SEO, alan adı ve özellikler aynı ekranda. Canlı siteyi ve taslağı her an ayrı ayrı görürsünüz.
            </p>
            <ol className="mt-8 space-y-4">
              {[
                ['Taslağa kaydedin', 'Değişiklikler önce taslağa yazılır; ziyaretçileriniz hiçbir şey görmez.'],
                ['Önizleyin', 'Taslağı kendi alan adınızda, yalnızca sizin tarayıcınızda görün.'],
                ['Yayınlayın', 'Tek tıkla canlıya alın; her yayın yeni bir sürümdür.'],
                ['Gerekirse geri alın', 'Geçmiş sekmesinden önceki sürüme dönün.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0b1b3a] text-[13px] font-semibold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-[15.5px] font-semibold text-[#0b1b3a]">{t}</span>
                    <span className="block text-[14.5px] text-[#4a5871]">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <figure className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-[#e3e8f0] shadow-[0_24px_60px_-30px_rgb(11_27_58/0.35)]">
              <Image
                src="/karay/ekran-renkler.png"
                alt="Site Kontrol Merkezi Renkler sekmesi: hazır paletler ve gerçek tema motoruyla canlı önizleme"
                width={1440}
                height={900}
                sizes="(min-width: 1024px) 640px, 100vw"
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 text-center text-[12.5px] text-[#5b6b85]">Renkler sekmesi ve canlı önizleme · gerçek ekran görüntüsü</figcaption>
          </figure>
        </div>
      </section>

      {/* 17. Temalar */}
      <section id="temalar" aria-labelledby="karay-temalar" className="scroll-mt-20 border-y border-[#e3e8f0] bg-[#f4f7fb]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#2f6bff] uppercase">Temalar</p>
            <h2 id="karay-temalar" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem]">
              {THEME_LIST.length} tema, her biri farklı bir karakter
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[#33415c]">
              Temalar yalnızca renk değildir: yazı tipi, köşeler, kartlar, header, ana sayfa düzeni, düğmeler ve görsel işleme değişir. Önizleme, emlak sitelerinin kullandığı gerçek tema motoruyla çizilir.
            </p>
          </div>
          <div className="mt-12">
            <ThemeShowcase baseConfig={parseSiteConfig({})} />
          </div>
        </div>
      </section>

      {/* 15. Güvenlik */}
      <section aria-labelledby="karay-guvenlik" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-24">
          <div>
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#0b1b3a] text-white">
              <Lock className="size-6" aria-hidden />
            </span>
            <h2 id="karay-guvenlik" className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.1rem]">
              Her ofisin verisi kendine ait
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#33415c]">Çok kiracılı (multi-tenant) mimaride yalıtım yalnızca ekranda değil, veritabanı düzeyinde uygulanır.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              ['Veritabanı düzeyinde yalıtım', 'Satır düzeyi güvenlik (RLS): bir ofis başka bir ofisin ilanını, müşterisini veya talebini okuyamaz.'],
              ['Rol bazlı yetki', 'Sahip, yönetici, danışman, editör ve izleyici rolleri; her işlem sunucuda yetkiyle kontrol edilir.'],
              ['İki adımlı doğrulama', 'Yöneticiler için doğrulama uygulamasıyla (TOTP) ikinci adım; ofis bunu zorunlu kılabilir.'],
              ['İşlem kayıtları', 'Önemli işlemler (yayın, marka, kullanıcı, ayar değişikliği) kim ve ne zaman bilgisiyle kaydedilir.'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl border border-[#e3e8f0] p-6">
                <h3 className="text-[15.5px] font-semibold text-[#0b1b3a]">{t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#4a5871]">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 18. Nasıl çalışır? */}
      <section id="nasil-calisir" aria-labelledby="karay-nasil" className="scroll-mt-20 bg-[#0b1b3a] text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-[#1cc8b6] uppercase">Nasıl çalışır?</p>
          <h2 id="karay-nasil" className="mt-3 max-w-2xl text-[1.9rem] leading-tight font-semibold tracking-tight sm:text-[2.4rem]">
            Tanışmadan yayına dört adım
          </h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <span className="text-[13px] font-semibold text-[#1cc8b6]">Adım {i + 1}</span>
                <h3 className="mt-2 text-[17px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-[#0b1b3a] hover:bg-white/90">
              <a href="#demo">
                <Rocket /> Demo talep et
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* 20. İletişim */}
      <section id="iletisim" aria-labelledby="karay-iletisim" className="scroll-mt-20 bg-white">
        <span id="demo" className="block scroll-mt-20" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#2f6bff] uppercase">İletişim</p>
            <h2 id="karay-iletisim" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.4rem]">
              Ofisiniz için konuşalım
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-[#33415c]">
              Bilgi almak veya platformu canlı görmek için formu doldurun. Talebiniz yalnızca KARAY ekibine iletilir; herhangi bir emlak ofisiyle paylaşılmaz.
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
          </div>
          <div className="rounded-2xl border border-[#e3e8f0] bg-[#f8fafc] p-6 sm:p-8">
            <KarayLeadForm />
          </div>
        </div>
      </section>

      {/* 21. SSS */}
      <section aria-labelledby="karay-sss" className="border-t border-[#e3e8f0] bg-[#f4f7fb]">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 id="karay-sss" className="text-[1.75rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.1rem]">
            Sık sorulan sorular
          </h2>
          <div className="mt-8 divide-y divide-[#e3e8f0] rounded-2xl border border-[#e3e8f0] bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-semibold text-[#0b1b3a] marker:hidden">
                  {f.q}
                  <span aria-hidden className="text-[#5b6b85] transition group-open:rotate-45">
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
      </section>
    </>
  );
}
