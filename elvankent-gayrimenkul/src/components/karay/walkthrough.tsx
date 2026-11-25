import Image from 'next/image';
import { DeviceFrame } from '@/components/karay/device-frame';
import { WALK_STEPS } from '@/components/karay/content';
import { Wave } from '@/components/karay/wave';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import type { CSSProperties } from 'react';
import ekranKontrolMerkezi from '@/app/karay/_images/ekran-kontrol-merkezi.png';
import ekranRenkler from '@/app/karay/_images/ekran-renkler.png';

/** Adım başına gerçek ekran kesiti (kaynak görüntünün kesri: x, y sol-üst köşe; z yakınlaştırma) */
const CROPS = [
  { name: 'taslak', src: ekranRenkler, x: 0.05, y: 0.41, z: 1.7 },
  { name: 'onizleme', src: ekranRenkler, x: 0.58, y: 0.44, z: 2.4 },
  { name: 'yayin', src: ekranKontrolMerkezi, x: 0.44, y: 0.12, z: 1.8 },
  { name: 'gecmis', src: ekranKontrolMerkezi, x: 0.52, y: 0.32, z: 2.2 },
];

/**
 * #platform: "Taslaktan yayına" kaydırmalı anlatım. Masaüstünde sağdaki cihaz çerçevesi yapışkandır (sticky) ve durum
 * rozetleri (Taslak, Önizleme, Canlı, Önceki sürüm) adımlarla birlikte değişir; yalnızca CSS (adlandırılmış görünüm
 * zaman çizelgeleri). Desteklemeyen tarayıcıda, mobilde ve "hareketi azalt" tercihinde sıradan bir liste + açıklayıcı
 * etiket satırıdır: içerik eksiksizdir.
 */
export function Walkthrough() {
  return (
    <section id="platform" aria-labelledby="karay-platform" className="ky-dark relative scroll-mt-20 bg-[#0b1b3a] text-white [overflow-x:clip]">
      <Wave fill="#f4f7fb" position="top" />
      <div aria-hidden className="ky-grid" />
      <div aria-hidden className="ky-noise" />
      <div className="relative mx-auto max-w-7xl px-4 pt-28 pb-28 sm:px-6 lg:pt-36 lg:pb-36">
        <div className="max-w-2xl">
          <p className="ky-eyebrow-dark">Site Kontrol Merkezi</p>
          <h2 id="karay-platform" className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight sm:text-[2.4rem] lg:text-[3rem] lg:leading-[1.08]">
            Web sitenizi tek panelden yönetin
          </h2>
          <p className="mt-5 text-[16.5px] leading-relaxed text-white/80">
            Marka, tema, renkler, yazı tipi, header, ana sayfa bölümleri, sayfalar, menü, footer, SEO, alan adı ve özellikler aynı ekranda. Canlı siteyi ve taslağı her an ayrı ayrı görürsünüz.
          </p>
        </div>
        <div className="ky-walk mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <ol className="ky-steps relative">
            {WALK_STEPS.map((s, i) => (
              <li key={s.title} className="ky-step" style={{ '--n': i + 1 } as CSSProperties}>
                <span className="ky-step-badge" aria-hidden>{i + 1}</span>
                <span className="block">
                  <span className="block text-[18px] font-semibold tracking-tight">{s.title}</span>
                  <span className="mt-1.5 block max-w-sm text-[15px] leading-relaxed text-white/80">{s.text}</span>
                  <span aria-hidden className="ky-step-chip">{s.chip}</span>
                </span>
              </li>
            ))}
          </ol>
          <figure className="ky-walk-fig min-w-0 max-lg:order-first">
            <div className="ky-walk-sticky">
              <div className="ky-walk-glow" aria-hidden />
              <div className="relative">
                <DeviceFrame title={`${PLATFORM_BRAND.name} · Site Kontrol Merkezi`}>
                  {/* Yedek (mobil, hareketsiz, desteklemeyen tarayıcı): tek tam ekran görüntüsü */}
                  <div className="ky-walk-full">
                    <Image
                      src={ekranRenkler}
                      alt="Site Kontrol Merkezi Renkler sekmesi: hazır paletler ve gerçek tema motoruyla canlı önizleme"
                      sizes="(min-width: 1024px) 640px, 100vw"
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </div>
                  {/* Masaüstü + kaydırmaya bağlı: her adımda aynı gerçek ekranlardan ayrı bir yakın kesit */}
                  <div className="ky-walk-crops" role="img" aria-label="Site Kontrol Merkezi gerçek ekran görüntüsünden adım adım yakın kesitler: taslağa kaydetme, önizleme, yayın düğmesi ve geçmiş sekmesi">
                    {CROPS.map((c, i) => (
                      <div key={c.name} className="ky-crop" style={{ '--x': c.x, '--y': c.y, '--z': c.z } as CSSProperties}>
                        <Image src={c.src} alt="" sizes="(min-width: 1024px) 1100px, 1px" loading="lazy" className="ky-crop-img" data-step={i + 1} />
                      </div>
                    ))}
                  </div>
                </DeviceFrame>
                <div aria-hidden className="ky-chips">
                  {WALK_STEPS.map((s) => (
                    <span key={s.chip} className="ky-chip" data-chip={s.chip}>
                      {s.chip}
                    </span>
                  ))}
                </div>
              </div>
              <figcaption className="mt-4 text-center text-[12.5px] text-white/75">Site Kontrol Merkezi · gerçek ekran görüntüsü, örnek ofis verisiyle</figcaption>
            </div>
          </figure>
        </div>
      </div>
      <Wave fill="#ffffff" />
    </section>
  );
}
