import { STEPS } from '@/components/karay/content';

/** #nasil-calisir: dört adımlı zaman çizelgesi (lg: yatay, mobil: dikey). Çizgi ve düğümler yalnızca CSS ile kaydırmaya bağlı çizilir; desteklenmezse tamdır. */
export function Timeline() {
  return (
    <ol className="ky-tl mt-14 grid gap-6 lg:grid-cols-4 lg:gap-8">
      {STEPS.map((s, i) => {
        const last = i === STEPS.length - 1;
        return (
          <li key={s.title} className="ky-tl-item">
            <span className="ky-tl-node" aria-hidden>
              {i + 1}
            </span>
            {last && (
              <span aria-hidden className="ky-tl-live">
                Canlı
              </span>
            )}
            <div className="ky-tl-card">
              <span className="text-[13px] font-semibold text-[#1cc8b6]">Adım {i + 1}</span>
              <h3 className="mt-2 text-[17px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">{s.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
