import Image from 'next/image';
import { FileClock } from 'lucide-react';
import { KaroMascot } from '@/components/brand/karo-mascot';
import { DeviceFrame } from '@/components/karay/device-frame';
import { HeroStage } from '@/components/karay/hero-stage';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import type { CSSProperties } from 'react';
import ekranKontrolMerkezi from '@/app/karay/_images/ekran-kontrol-merkezi.png';
import ekranRenkler from '@/app/karay/_images/ekran-renkler.png';

const layer = (depth: number, delay: number) => ({ '--depth': depth, '--d': `${delay}ms` }) as CSSProperties;

/**
 * Hero cihaz yığını: ürünün GERÇEK ekranları katmanlı, derinlikli bir sahnede. Durağan 3B poz CSS'tedir
 * (JavaScript'siz de eksiksiz); HeroStage yalnızca fareli cihazda imleç paralaksı ekler. KARO yığının önünde durur
 * (döndürülmeyen kardeş öğe: sol kenarı sayfa kenar boşluğunu aşmaz, KARAY-21).
 */
export function HeroStack() {
  return (
    <figure className="relative min-w-0">
      <HeroStage>
        <div className="ky-stack">
          <div aria-hidden className="ky-layer ky-l0" style={layer(8, 100)} />
          <div className="ky-layer ky-l1" style={layer(14, 200)}>
            <DeviceFrame title={`${PLATFORM_BRAND.name} · Site Kontrol Merkezi`} status="Canlı">
              <Image
                src={ekranKontrolMerkezi}
                alt={`${PLATFORM_BRAND.name} Site Kontrol Merkezi: bir emlak ofisi sitesinin tasarım aileleri, canlı ve taslak durumu`}
                sizes="(min-width: 1024px) 560px, 100vw"
                loading="eager"
                fetchPriority="low"
                className="block h-auto w-full"
              />
            </DeviceFrame>
          </div>
          <div className="ky-layer ky-l2" style={layer(28, 350)}>
            <DeviceFrame title="Renkler" status="Taslak">
              <Image src={ekranRenkler} alt="" sizes="(min-width: 1024px) 340px, 1px" loading="lazy" className="block h-auto w-full" />
            </DeviceFrame>
          </div>
          <div className="ky-layer ky-l3" style={layer(40, 450)}>
            <div className="ky-phone">
              <div className="ky-phone-screen">
                {/* Gerçek Renkler ekranının "Önizleme" paneli: örnek emlak sitesi (başlık, arama kartı, ilan kartları) */}
                <Image
                  src={ekranRenkler}
                  alt="Örnek bir emlak sitesinin önizlemesi: başlık, arama kartı ve ilan kartları"
                  sizes="480px"
                  loading="lazy"
                  className="ky-phone-img"
                />
              </div>
            </div>
          </div>
          <div aria-hidden className="ky-layer ky-l4" style={layer(48, 700)}>
            <div className="ky-status">
              <span>Taslak</span>
              <span>Önizleme</span>
              <span>Canlı</span>
            </div>
            <div className="ky-history">
              <FileClock className="size-3.5" aria-hidden /> Sürüm geçmişi
            </div>
          </div>
        </div>
        {/* KARO ziyaretçiyi karşılar: yığının sol alt köşesinde (dekoratif). Sola taşması sayfa kenar boşluğunu
            (16 / 24 px) ve geniş ekranda sütun aralığını (48 px) aşmaz: hero kırpar, KARO kırpılmamalı (KARAY-21) */}
        <KaroMascot
          width={168}
          sizes="(min-width: 1024px) 168px, (min-width: 640px) 128px, 92px"
          loading="eager"
          className="absolute -bottom-7 -left-3 z-10 h-auto w-[92px] sm:-left-5 sm:w-[128px] lg:-bottom-24 lg:-left-12 lg:w-[168px]"
        />
      </HeroStage>
      <figcaption className="mt-9 text-right text-[12.5px] text-white/75 lg:text-center">Gerçek ekran görüntüleri · örnek ofis verisiyle</figcaption>
    </figure>
  );
}
