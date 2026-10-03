import Link from 'next/link';
import { PlatformWordmark } from '@/components/platform/platform-wordmark';
import { KARAY_NAV } from '@/modules/karay/nav';
import { KARAY_LEGAL } from '@/modules/karay/legal';
import type { KarayProfile } from '@/modules/karay/profile';

/**
 * KARAY alt bilgisi. Kiracı sitelerinin alt bilgisinden tamamen ayrıdır. Sosyal medya
 * ve iletişim bilgileri yalnızca Platform › KARAY ayarları'nda girildiyse gösterilir.
 */
export function KarayFooter({ profile }: { profile: KarayProfile }) {
  const contact = [
    profile.email && { label: profile.email, href: `mailto:${profile.email}` },
    profile.phone && { label: profile.phone, href: `tel:${profile.phone.replace(/[^+0-9]/g, '')}` },
  ].filter(Boolean) as { label: string; href: string }[];
  return (
    <footer className="bg-[#0b1b3a] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:py-16">
        <div className="max-w-sm">
          <PlatformWordmark tone="dark" tagline height={40} />
          <p className="mt-5 text-[14.5px] leading-relaxed text-white/70">
            Emlak ofisleri için web sitesi, ilan, müşteri ve marka yönetimini tek platformda toplayan gayrimenkul teknolojileri ve SaaS altyapısı.
          </p>
          {contact.length > 0 && (
            <ul className="mt-5 space-y-1.5 text-[14px] text-white/80">
              {contact.map((c) => (
                <li key={c.href}>
                  <a href={c.href} className="break-all hover:text-white">
                    {c.label}
                  </a>
                </li>
              ))}
              {(profile.address || profile.city) && <li className="text-white/60">{[profile.address, profile.city].filter(Boolean).join(', ')}</li>}
            </ul>
          )}
        </div>
        <nav aria-label="KARAY alt menü">
          <h2 className="text-[12px] font-bold tracking-[0.14em] text-white/50 uppercase">Platform</h2>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {KARAY_NAV.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-white/80 hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/admin/giris" className="text-white/80 hover:text-white">
                Müşteri girişi
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="text-[12px] font-bold tracking-[0.14em] text-white/50 uppercase">Yasal</h2>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            {KARAY_LEGAL.map((l) => (
              <li key={l.slug}>
                <Link href={`/karay/yasal/${l.slug}`} className="text-white/80 hover:text-white">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
          {profile.socials.length > 0 && (
            <>
              <h2 className="mt-8 text-[12px] font-bold tracking-[0.14em] text-white/50 uppercase">Sosyal medya</h2>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[14.5px]">
                {profile.socials.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[13px] text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {profile.companyName} · Gayrimenkul Teknolojileri
          </p>
          <p>Emlak ofisleri için beyaz etiketli (white-label) SaaS platformu</p>
        </div>
      </div>
    </footer>
  );
}
