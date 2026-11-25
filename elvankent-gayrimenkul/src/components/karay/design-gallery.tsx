import Image, { type StaticImageData } from 'next/image';
import { MarqueePause } from '@/components/karay/marquee-pause';
// Ekran görüntüleri statik import edilir (bkz. app/karay/page.tsx: /karay/ yolu proxy'de korunur, görsel
// iyileştiricinin iç isteği orada 404 alır). Görüntüler tasarım ailelerinin GERÇEK önizlemesinden
// (örnek içerikle, "Önizleme · örnek içerik" rozetiyle) alınmıştır; müşteri sitesi değildir.
import klasikGuven from '@/app/karay/_images/aileler/klasik-guven.webp';
import sinematikVitrin from '@/app/karay/_images/aileler/sinematik-vitrin.webp';
import editoryalLuks from '@/app/karay/_images/aileler/editoryal-luks.webp';
import yalinGaleri from '@/app/karay/_images/aileler/yalin-galeri.webp';
import kurumsalPortfoy from '@/app/karay/_images/aileler/kurumsal-portfoy.webp';
import dogalYasam from '@/app/karay/_images/aileler/dogal-yasam.webp';
import luxury from '@/app/karay/_images/aileler/luxury.webp';
import architectural from '@/app/karay/_images/aileler/architectural.webp';
import mapFirst from '@/app/karay/_images/aileler/map-first.webp';

/**
 * Şeritteki aileler. KARAYS sayfası katman kuralı gereği Site Factory kataloğunu içe aktaramaz (eslint
 * katman sınırı); ad ve kısa tanımlar burada tutulur, katalogla eşleşmesi birim testle korunur
 * (tests/unit/karay-design-gallery.test.mjs: kimlik ve adlar katalogdakiyle aynı).
 */
export const GALLERY_FAMILIES: readonly { id: string; name: string; text: string; shot: StaticImageData }[] = [
  { id: 'klasik-guven', name: 'Klasik Güven', text: 'Fotoğraf üzerinde arama, sıcak serif başlıklar, gölgeli kartlar.', shot: klasikGuven },
  { id: 'sinematik-vitrin', name: 'Sinematik Vitrin', text: 'Kenardan kenara fotoğraf, film greni, büyük tipografi.', shot: sinematikVitrin },
  { id: 'editoryal-luks', name: 'Editoryal Lüks', text: 'Dergi düzeni, ortalı logo, altın çizgiler.', shot: editoryalLuks },
  { id: 'kurumsal-portfoy', name: 'Kurumsal Portföy', text: 'İlan öncelikli vitrin, yüzen header, degrade rakamlar.', shot: kurumsalPortfoy },
  { id: 'yalin-galeri', name: 'Yalın Galeri', text: 'Bol boşluk, köşesiz görseller, sakin hareket.', shot: yalinGaleri },
  { id: 'dogal-yasam', name: 'Doğal Yaşam', text: 'Organik köşeler, doğal tonlar, yumuşak hareket.', shot: dogalYasam },
  { id: 'luxury', name: 'Luxury', text: 'Tam ekran görsel, altın çerçeve, seçkin portföy.', shot: luxury },
  { id: 'architectural', name: 'Architectural', text: 'Plan çizimi ızgarası, numaralı bölümler, köşe işaretleri.', shot: architectural },
  { id: 'map-first', name: 'Map First', text: 'Harita öncelikli arama, rota çizgileri, bölge odaklı.', shot: mapFirst },
];

/**
 * KARAYS sayfası tasarım şeridi: her tasarım ailesinin ana sayfası. Hareket açıkken şerit kendiliğinden
 * akar (fareyle/klavyeyle üzerine gelince durur); "hareketi azalt" tercihinde yatay kaydırılan bir galeridir.
 * Kopya sıra yalnızca kesintisiz akış içindir: ekran okuyuculardan gizlidir ve odak almaz.
 */
export function DesignGallery() {
  const items = GALLERY_FAMILIES;
  const card = (f: (typeof items)[number], copy: boolean, index: number) => (
    <li key={`${copy ? 'k-' : ''}${f.id}`} className={[copy ? 'ky-copy' : '', index % 2 ? 'ky-low' : ''].filter(Boolean).join(' ') || undefined} aria-hidden={copy || undefined}>
      <figure>
        <div className="ky-shot">
          <Image src={f.shot} alt={copy ? '' : `${f.name} tasarım ailesiyle örnek emlak ofisi ana sayfası`} sizes="(min-width: 640px) 352px, 78vw" loading="lazy" />
        </div>
        <figcaption className="mt-3 px-1">
          <span className="block text-[15px] font-semibold text-[#0b1b3a]">{f.name}</span>
          <span className="mt-0.5 block text-[13.5px] leading-snug text-[#4a5871]">{f.text}</span>
        </figcaption>
      </figure>
    </li>
  );
  return (
    <div className="ky-marquee-wrap">
      <MarqueePause />
      <div className="ky-marquee" role="region" aria-label="Tasarım aileleri örnek ana sayfalar" tabIndex={0}>
        <ul className="ky-track">
          {items.map((f, i) => card(f, false, i))}
          {items.map((f, i) => card(f, true, i))}
        </ul>
      </div>
    </div>
  );
}
