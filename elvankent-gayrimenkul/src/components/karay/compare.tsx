import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/karay/reveal';
import { PROBLEMS, SOLUTIONS } from '@/components/karay/content';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';

/** #hakkimizda: "Önce / KARAYS ile" bölünmüş kart. Sol yarı sorunlar, sağ yarı çözümler; ortadaki rozet geçişi gösterir. */
export function Compare() {
  return (
    <div className="ky-split relative mt-14 grid overflow-hidden rounded-[1.75rem] lg:grid-cols-2">
      <div className="ky-split-before p-7 sm:p-10 lg:p-12">
        <h3 className="text-[18px] font-semibold text-[#0b1b3a]">Emlak ofislerinin sık karşılaştığı sorunlar</h3>
        <ul className="mt-6 space-y-4">
          {PROBLEMS.map((p, i) => (
            <Reveal as="li" key={p} i={i} className="flex gap-3.5 text-[15px] leading-relaxed text-[#33415c]">
              <span className="ky-bullet" aria-hidden />
              {p}
            </Reveal>
          ))}
        </ul>
      </div>
      <span aria-hidden className="ky-split-badge">
        <ArrowRight className="size-5" />
      </span>
      <div className="ky-split-after p-7 text-white sm:p-10 lg:p-12">
        <h3 className="text-[18px] font-semibold">{PLATFORM_BRAND.name} ile</h3>
        <ul className="mt-6 space-y-4">
          {SOLUTIONS.map((s, i) => (
            <Reveal as="li" key={s} i={i} className="flex gap-3.5 text-[15px] leading-relaxed text-white/90" >
              <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="ky-checksvg">
                <circle cx="12" cy="12" r="10.5" />
                <path className="ky-check" pathLength={1} d="M7 12.5l3.4 3.4L17 9" />
              </svg>
              {s}
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}
