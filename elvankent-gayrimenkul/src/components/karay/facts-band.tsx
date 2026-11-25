import type { CSSProperties } from 'react';

export type Fact = { value: number; label: string; note: string };

/**
 * Dürüst "rakamlar" şeridi: değerler içerik dizilerinin uzunluğundan türetilir (page.tsx), burada elle yazılmaz.
 * Sayı sunucu çıktısında gerçek metindir; kaydırmayla sayma yalnızca CSS'te (@property) ve dekoratiftir.
 */
export function FactsBand({ items }: { items: readonly Fact[] }) {
  return (
    <div className="ky-facts relative z-10 mx-auto -mt-12 max-w-5xl px-4 sm:px-6 lg:-mt-16">
      <ul aria-label="KARAYS rakamlarla" className="ky-facts-card grid grid-cols-2 lg:grid-cols-4">
        {items.map((f) => (
          <li key={f.label} className="ky-fact">
            <p className="ky-fact-num">
              <span className="ky-fact-real">{f.value}</span>
              <span aria-hidden className="ky-fact-count" style={{ '--ky-n': f.value } as CSSProperties} />
            </p>
            <p className="mt-1 text-[15px] font-semibold text-[#0b1b3a]">{f.label}</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-[#4a5871]">{f.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
