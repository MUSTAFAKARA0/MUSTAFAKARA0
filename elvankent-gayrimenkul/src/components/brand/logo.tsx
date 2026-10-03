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

/**
 * Yüklenen marka görselinin piksel boyutu (yükleme sırasında dosya adına yazılır:
 * logo-<rastgele>-<genişlik>x<yükseklik>.png). Eski yüklemelerde boyut yoktur.
 */
export function brandingImageSize(url: string | null | undefined): { width: number; height: number } | null {
  const m = url?.match(/-(\d{1,5})x(\d{1,5})\.(?:png|jpe?g|webp)(?:[?#]|$)/i);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export type BrandDisplay = 'auto' | 'logo' | 'logo-name' | 'name';

interface LogoProps {
  name: string;
  logoUrl?: string | null;
  /** Telefonda gösterilecek ayrı logo (yüklenmişse) */
  mobileLogoUrl?: string | null;
  tone?: 'dark' | 'light';
  className?: string;
  href?: string;
  /** Header › Marka alanı (varsayılan: logo varsa logo, yoksa monogram + ad) */
  display?: BrandDisplay;
  /** Adın altında slogan (yalnızca geniş ekranda) */
  tagline?: string | null;
  /** Logo yüksekliği: header (varsayılan) veya footer */
  size?: 'header' | 'footer';
}

/**
 * Tek bir marka görseli. Boyutu biliniyorsa kutu gerçek en-boy oranıyla (CSS aspect-ratio)
 * önceden ayrılır: logo kırpılmaz, bozulmaz, geç yüklenince sayfa kaymaz (CLS). Boyutu
 * bilinmeyen eski yüklemelerde sabit kutu + object-contain kullanılır. next/image ekran
 * yoğunluğuna uygun boyutu WebP/AVIF olarak sunar.
 */
function BrandImage({ src, alt, variant, className }: { src: string; alt: string; variant: 'desktop' | 'mobile' | 'footer'; className?: string }) {
  const size = brandingImageSize(src);
  const box =
    variant === 'mobile'
      ? 'h-[34px] max-w-[132px]'
      : variant === 'footer'
        ? 'h-11 max-w-[200px]'
        : 'h-[34px] max-w-[150px] sm:h-10 sm:max-w-[210px]';
  if (!size) {
    return (
      <Image
        src={src}
        alt={alt}
        width={190}
        height={40}
        sizes="190px"
        className={cn(variant === 'mobile' ? 'h-9 w-[132px]' : 'h-9 w-[150px] sm:h-10 sm:w-[190px]', 'object-contain object-left', className)}
      />
    );
  }
  // Görüntülenen en büyük boyut (2x yoğunluk için next/image srcset üretir)
  const maxH = variant === 'footer' ? 44 : 40;
  const maxW = variant === 'mobile' ? 132 : 210;
  const scale = Math.min(maxH / size.height, maxW / size.width);
  const w = Math.max(1, Math.round(size.width * scale));
  const h = Math.max(1, Math.round(size.height * scale));
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      sizes={`${w}px`}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      className={cn('w-auto object-contain object-left', box, className)}
    />
  );
}

/**
 * Marka alanı (header / footer / bakım sayfası). Kiracının logosu ve adı ayarlardan gelir;
 * şirket adı koda gömülü değildir (white-label). Logo yoksa monogram + tipografik ad.
 */
export function Logo({ name, logoUrl, mobileLogoUrl, tone = 'dark', className, href = '/', display = 'auto', tagline, size = 'header' }: LogoProps) {
  const showLogo = Boolean(logoUrl) && display !== 'name';
  const showName = !showLogo || display === 'logo-name';
  const light = tone === 'light';
  const [first, ...rest] = name.trim().split(/\s+/);

  const nameBlock = showLogo ? (
    // Logo + ad: ad tek satır, sığmazsa kısaltılır (dar ekranda taşmaz)
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={cn('truncate font-display text-[1.02rem] font-semibold tracking-tight sm:text-[1.12rem]', light ? 'text-inverse-foreground' : 'text-foreground')}>{name}</span>
      {tagline && ' '}
      {tagline && <span className={cn('hidden truncate text-[12px] lg:block', light ? 'text-inverse-foreground/70' : 'text-muted-foreground')}>{tagline}</span>}
    </span>
  ) : tagline ? (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={cn('truncate font-display text-[1.15rem] font-semibold tracking-tight sm:text-[1.22rem]', light ? 'text-inverse-foreground' : 'text-foreground')}>{name}</span>{' '}
      <span className={cn('hidden truncate text-[12px] lg:block', light ? 'text-inverse-foreground/70' : 'text-muted-foreground')}>{tagline}</span>
    </span>
  ) : (
    <span className="flex min-w-0 flex-col leading-none">
      <span className={cn('truncate font-display text-[1.28rem] font-semibold tracking-tight', light ? 'text-inverse-foreground' : 'text-foreground')}>{first}</span>
      {/* Kelime arası boşluk (ekran okuyucu ve metin olarak "Elvankent Gayrimenkul"; esnek kutuda görünmez) */}
      {rest.length > 0 && ' '}
      {rest.length > 0 && (
        <span className={cn('mt-[5px] truncate text-[9.5px] font-bold tracking-[0.3em] uppercase', light ? 'text-inverse-foreground/70' : 'text-muted-foreground')}>
          {rest.join(' ')}
        </span>
      )}
    </span>
  );

  return (
    <Link href={href} className={cn('inline-flex min-w-0 items-center gap-2.5 rounded-lg', className)}>
      {showLogo ? (
        <>
          <BrandImage src={logoUrl!} alt={showName ? '' : name} variant={size === 'footer' ? 'footer' : 'desktop'} className={cn(mobileLogoUrl && size === 'header' && 'hidden sm:block')} />
          {mobileLogoUrl && size === 'header' && <BrandImage src={mobileLogoUrl} alt={showName ? '' : name} variant="mobile" className="sm:hidden" />}
        </>
      ) : (
        <Monogram name={name} className={size === 'footer' ? 'size-11' : undefined} />
      )}
      {showName && nameBlock}
      <span className="sr-only"> – Ana sayfa</span>
    </Link>
  );
}
