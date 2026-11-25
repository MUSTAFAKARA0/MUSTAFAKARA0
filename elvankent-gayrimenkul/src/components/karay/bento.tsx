import Image from 'next/image';
import { Lock } from 'lucide-react';
import { Reveal, SpotGrid } from '@/components/karay/reveal';
import { FEATURES, type FeatureKey } from '@/components/karay/content';
import { cn } from '@/lib/utils';
import ekranKontrolMerkezi from '@/app/karay/_images/ekran-kontrol-merkezi.png';

/** Kart düzeni (lg, 6 sütun): yüzey rengi + kaplama. Düzen "dense" akışla DOM sırasını bozmadan dolar. */
const LAYOUT: Record<FeatureKey, { span: string; tone: 'light' | 'dark' | 'tint' | 'sky' }> = {
  web: { span: 'sm:col-span-2 lg:col-span-3 lg:row-span-2', tone: 'dark' },
  ilan: { span: 'lg:col-span-3', tone: 'light' },
  crm: { span: 'lg:col-span-3', tone: 'light' },
  talep: { span: 'lg:col-span-2', tone: 'light' },
  marka: { span: 'lg:col-span-2', tone: 'tint' },
  yayin: { span: 'sm:col-span-2 lg:col-span-4', tone: 'sky' },
  seo: { span: 'lg:col-span-2', tone: 'light' },
  alan: { span: 'lg:col-span-2', tone: 'light' },
  mobil: { span: 'lg:col-span-2', tone: 'light' },
  olcum: { span: 'lg:col-span-2', tone: 'light' },
  guvenlik: { span: 'sm:col-span-2 lg:col-span-6', tone: 'dark' },
  surum: { span: 'lg:col-span-2', tone: 'light' },
};

const SWATCHES = ['#0b1b3a', '#2f6bff', '#1cc8b6', '#ffd37a', '#dbe7ff'];

/** Her kartın küçük görseli: tamamen dekoratif (aria-hidden), gerçek veri taklidi yok; adlar yalnızca "örnek" olarak etiketlidir */
function Visual({ k }: { k: FeatureKey }) {
  switch (k) {
    case 'web':
      return (
        <div aria-hidden className="ky-bento-shot">
          <Image src={ekranKontrolMerkezi} alt="" sizes="(min-width: 1024px) 560px, 100vw" loading="lazy" className="block h-auto w-full" />
        </div>
      );
    case 'ilan':
      return (
        <div aria-hidden className="ky-flow">
          <span>Taslak</span>
          <i />
          <span>Onay</span>
          <i />
          <span data-final>Yayın</span>
        </div>
      );
    case 'crm':
      return (
        <div aria-hidden className="ky-mini-card">
          <b />
          <span>
            <i />
            <i />
          </span>
          <em />
        </div>
      );
    case 'talep':
      return (
        <div aria-hidden className="ky-inbox">
          <span><b />Yeni</span>
          <span><b />Takipte</span>
        </div>
      );
    case 'marka':
      return (
        <div aria-hidden className="ky-brand-vis">
          <p>
            Aa<span>Marka renkleri · örnek</span>
          </p>
          <div>
            {SWATCHES.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
        </div>
      );
    case 'yayin':
      return (
        <div aria-hidden className="ky-nodes">
          <span>Taslak</span>
          <span>Önizleme</span>
          <span>Canlı</span>
        </div>
      );
    case 'seo':
      return (
        <div aria-hidden className="ky-serp">
          <em>ornek-ofis.com › ilanlar · örnek</em>
          <b />
          <i />
        </div>
      );
    case 'alan':
      return (
        <div aria-hidden className="ky-addr">
          <Lock className="size-3.5" />
          <span>ornek-ofis.com</span>
          <em>örnek</em>
        </div>
      );
    case 'mobil':
      return (
        <div aria-hidden className="ky-phone-vis">
          <i />
          <i />
          <i />
        </div>
      );
    case 'olcum':
      return (
        <svg aria-hidden viewBox="0 0 160 56" className="ky-spark" focusable="false">
          <path className="ky-spark-area" d="M2 46 L24 38 L46 42 L70 24 L94 30 L120 12 L158 8 V56 H2Z" />
          <path className="ky-spark-line" pathLength={1} d="M2 46 L24 38 L46 42 L70 24 L94 30 L120 12 L158 8" />
        </svg>
      );
    case 'guvenlik':
      return (
        <svg aria-hidden viewBox="0 0 120 64" className="ky-shield" focusable="false">
          <path d="M60 4 L92 14 V34 C92 48 78 58 60 62 C42 58 28 48 28 34 V14Z" />
          <path className="ky-tick" pathLength={1} d="M46 33 L56 43 L76 22" />
        </svg>
      );
    case 'surum':
      return (
        <div aria-hidden className="ky-versions">
          <span data-live>Canlı</span>
          <span>Önceki sürüm</span>
          <em>Geri al</em>
        </div>
      );
  }
}

/** #ozellikler: 12 özelliğin asimetrik "bento" düzeni (12 li; metinler değişmez) */
export function Bento() {
  return (
    <SpotGrid as="ul" className="ky-bento mt-12 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-5">
      {FEATURES.map(({ key, icon: Icon, title, text }, idx) => {
        const l = LAYOUT[key];
        return (
          <Reveal key={key} as="li" spot i={idx % 3} className={cn('ky-bento-card', `ky-tone-${l.tone}`, `ky-f-${key}`, l.span)}>
            <div className="ky-bento-body">
              <span className="ky-icon">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-md text-[14.5px] leading-relaxed">{text}</p>
              <div className="ky-bento-vis">
                <Visual k={key} />
              </div>
            </div>
          </Reveal>
        );
      })}
    </SpotGrid>
  );
}
