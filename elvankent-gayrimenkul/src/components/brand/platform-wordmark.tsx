import Image from 'next/image';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import logo from '@/platform/branding/assets/karays-logo-yatay.webp';
import { cn } from '@/lib/utils';

/**
 * KARAYS yatay logosu (amblem + "karays" yazısı; 01_LOGOLAR/karays-logo-yatay.webp, 2093 × 681).
 * Dosya yeniden çizilmez, oranı ve renkleri değiştirilmez; next/image yalnızca ekrana uygun boyutta sunar.
 *   height: logonun yüksekliği (genişlik orandan hesaplanır; dar alanda oranı korunarak küçülür)
 *   tone: zemin. Yazı koyu lacivert ve pakette beyaz logo yok: koyu zeminde (dark) logo açık bir
 *         plakanın üzerinde gösterilir.
 * Kiracı (emlak ofisi) logosu burada ASLA kullanılmaz.
 */
export function PlatformWordmark({ tone = 'light', height = 36, className }: { tone?: 'dark' | 'light'; height?: number; className?: string }) {
  const width = Math.round((height * logo.width) / logo.height);
  const image = (
    <Image
      src={logo}
      alt={PLATFORM_BRAND.name}
      width={width}
      height={height}
      sizes={`${width}px`}
      loading="eager"
      data-platform-brand="logo"
      className={cn('block h-auto max-w-full shrink-0', tone === 'light' && className)}
      style={{ width }}
    />
  );
  if (tone === 'light') return image;
  return <span className={cn('inline-flex max-w-full shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5', className)}>{image}</span>;
}
