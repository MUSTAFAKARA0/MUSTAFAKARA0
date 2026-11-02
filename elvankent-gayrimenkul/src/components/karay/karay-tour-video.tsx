import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';

/**
 * KARAYS ürün tanıtım videosu. Kendiliğinden oynamaz (hareket azaltma tercihi olan ziyaretçi dahil kimse için);
 * ziyaretçi oynat'a basana kadar video dosyası indirilmez (preload="none", yalnızca poster yüklenir). Oran sabittir
 * (16:9, width/height + aspect-video): yüklenirken sayfa kaymaz. Ses: KARAYS için sentezlenmiş özgün, telifsiz arka plan müziği
 * (konuşma yok); oynat'a basınca duyulur (otomatik oynatma olmadığından sessiz başlatma gerekmez). Ekran yazıları videoda,
 * Türkçe altyazı ayrıca metin izi (VTT) olarak verilir. Dosyalar public/brand/karays/video/ altındadır (proxy önekleri dışında).
 */
export function KarayTourVideo() {
  const v = PLATFORM_BRAND.video;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3e8f0] bg-[#0b1b3a] shadow-[0_24px_60px_-30px_rgb(11_27_58/0.45)]">
      <video
        controls
        playsInline
        preload="none"
        poster={v.poster}
        width={v.width}
        height={v.height}
        aria-label={`${PLATFORM_BRAND.name} ürün tanıtımı: platform konsolu, ofis paneli, mobil site ve temalar`}
        className="block aspect-video h-auto w-full bg-[#0b1b3a]"
      >
        <source src={v.webm} type="video/webm" />
        <source src={v.mp4} type="video/mp4" />
        <track kind="captions" src={v.captions} srcLang="tr" label="Türkçe" />
        Tarayıcınız video oynatmayı desteklemiyor.{' '}
        <a href={v.mp4} className="underline">
          Videoyu indirin
        </a>
        .
      </video>
    </div>
  );
}
