import { Lock } from 'lucide-react';
import { Reveal } from '@/components/karay/reveal';
import { ROLES, SECURITY } from '@/components/karay/content';

/** Güvenlik bölümü: koyu kartlar + RLS şeması (dekoratif; "Ofis A / Ofis B" gerçek müşteri değildir) ve rol rozetleri */
export function Security() {
  return (
    <section aria-labelledby="karay-guvenlik" className="relative bg-[#f4f7fb]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.25fr] lg:py-28">
        <div>
          <span className="ky-lock">
            <Lock className="size-6" aria-hidden />
          </span>
          <h2 id="karay-guvenlik" className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-tight text-[#0b1b3a] sm:text-[2.1rem]">
            Her ofisin verisi kendine ait
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#33415c]">Çok kiracılı (multi-tenant) mimaride yalıtım yalnızca ekranda değil, veritabanı düzeyinde uygulanır.</p>
          <div aria-hidden className="ky-rls">
            <div className="ky-rls-tenant">
              <b>Ofis A</b>
              <i />
              <i />
            </div>
            <div className="ky-rls-wall">
              <span>RLS</span>
            </div>
            <div className="ky-rls-tenant">
              <b>Ofis B</b>
              <i />
              <i />
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-[#4a5871]">Şema örnektir: Ofis A ve Ofis B gerçek müşteri değildir.</p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Rol bazlı yetki rolleri">
            {ROLES.map((r) => (
              <li key={r} className="ky-role">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map(([t, d], i) => (
            <Reveal as="li" key={t} i={i} className="ky-sec-card">
              <h3 className="text-[16px] font-semibold text-white">{t}</h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/80">{d}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
