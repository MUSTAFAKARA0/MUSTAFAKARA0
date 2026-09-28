import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toLocaleUpperCase('tr-TR');
}

/** Logo yüklenmemiş kiracılar için monogram işareti (şirket adının baş harfleri) */
export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-[1.05rem] font-semibold tracking-tight text-primary-fg',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

interface LogoProps {
  name: string;
  logoUrl?: string | null;
  /** Telefonda gösterilecek ayrı logo (yüklenmişse) */
  mobileLogoUrl?: string | null;
  tone?: 'dark' | 'light';
  className?: string;
  href?: string;
}

/**
 * Marka logosu. Şirket ayarlarından logo yüklenmişse o görsel, aksi halde
 * tipografik logo gösterilir. Şirket adı koda gömülü değildir (white-label).
 */
export function Logo({ name, logoUrl, mobileLogoUrl, tone = 'dark', className, href = '/' }: LogoProps) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const content = logoUrl ? (
    // Yüklenen logonun en-boy oranı bilinmediğinden sabit bir kutu ayrılır ve logo kutuya orantılı
    // sığdırılır (object-contain). Kutu önceden ayrılmazsa logo geç yüklenince sayfa kayıyordu (CLS).
    // next/image: ekran yoğunluğuna uygun boyutta ve WebP/AVIF olarak otomatik optimize edilir.
    <>
      <Image
        src={logoUrl}
        alt={name}
        width={190}
        height={40}
        sizes="190px"
        className={cn('h-9 w-[168px] object-contain object-left sm:h-10 sm:w-[190px]', mobileLogoUrl && 'hidden sm:block')}
      />
      {mobileLogoUrl && (
        <Image src={mobileLogoUrl} alt={name} width={140} height={36} sizes="140px" className="h-9 w-[140px] object-contain object-left sm:hidden" />
      )}
    </>
  ) : (
    <span className="flex items-center gap-2.5">
      <Monogram name={name} />
      <span className="flex flex-col leading-none">
        <span className={cn('font-display text-[1.28rem] font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-foreground')}>
          {first}
        </span>
        {rest.length > 0 && (
          <span className={cn('mt-[5px] text-[9.5px] font-bold tracking-[0.3em] uppercase', tone === 'light' ? 'text-white/70' : 'text-muted-foreground')}>
            {rest.join(' ').toLocaleUpperCase('tr-TR')}
          </span>
        )}
      </span>
    </span>
  );

  return (
    <Link href={href} className={cn('inline-flex items-center rounded-lg', className)}>
      {content}
      <span className="sr-only"> – Ana sayfa</span>
    </Link>
  );
}
