import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  businessName: string;
  logoUrl?: string | null;
  tone?: 'dark' | 'light';
  className?: string;
  href?: string;
}

/** Monogram işareti — favicon ile aynı tasarım (src/app/icon.svg) */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-10 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--brand-700)" />
      <path d="M14 30 L32 16 L50 30" fill="none" stroke="var(--accent-400)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M23 29 V48 H41 M23 38.5 H37 M23 29 H41"
        fill="none"
        stroke="#F7F5F0"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Marka logosu. Yönetim panelinden logo yüklenmişse o görsel, aksi halde
 * tipografik geçici logo gösterilir. Logo koda gömülü değildir.
 */
export function Logo({ businessName, logoUrl, tone = 'dark', className, href = '/' }: LogoProps) {
  const [first, ...rest] = businessName.trim().split(/\s+/);
  const content = logoUrl ? (
    // Yüklenen logo boyutu bilinmediğinden next/image yerine sabit yükseklikli img
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={businessName} className="h-10 w-auto max-w-[200px] object-contain" />
  ) : (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className={cn('font-display text-[1.3rem] font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-brand-800')}>
          {first}
        </span>
        {rest.length > 0 && (
          <span
            className={cn(
              'mt-1 text-[10px] font-bold tracking-[0.28em] uppercase',
              tone === 'light' ? 'text-accent-300' : 'text-accent-700',
            )}
          >
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
