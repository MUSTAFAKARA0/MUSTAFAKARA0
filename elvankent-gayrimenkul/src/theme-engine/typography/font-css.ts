import 'server-only';
import type { FontId } from '@/theme-engine/ids';
import { THEMES } from '@/theme-engine/themes';
import type { ThemeInput } from '@/theme-engine/types';
import { FONT_PACKAGES } from '@/theme-engine/typography/packages.generated';

/**
 * Seçilmiş tipografi paketi (FONT-ISOLATION).
 *
 * Kiracı sitesi yalnızca kendi başlık ve gövde yazı tiplerinin @font-face bildirimlerini,
 * CSS değişkenlerini ve ön yükleme dosyalarını alır; katalogdaki diğer yazı tipleri sayfada
 * hiç bulunmaz. Paketler scripts/fonts/build-site-fonts.mjs ile next/font'un kendi
 * fonksiyonlarından üretilir (aynı dosyalar, aynı yedek metrikler).
 *
 * Sunucuya özeldir ('server-only'): paket verisi istemci JavaScript'ine girmez. Tema önizlemesi
 * (istemci) aynı dosyaları public/fonts/site/<kimlik>/preview.css ile yükler.
 */
export function resolveFontIds(input: Pick<ThemeInput, 'theme' | 'typography'>): FontId[] {
  const theme = THEMES[input.theme];
  const heading = input.typography.heading ?? theme.fonts.heading;
  const body = input.typography.body ?? theme.fonts.body;
  return heading === body ? [heading] : [heading, body];
}

/** Seçili paketlerin @font-face bildirimleri + kökte yazı tipi değişkenleri */
export function fontPackageCss(ids: FontId[], selector = 'html:root'): string {
  const packages = ids.map((id) => FONT_PACKAGES[id]).filter(Boolean);
  const vars = packages.map((p) => `${p.cssVar}:"${p.family}", "${p.family} Fallback"`).join(';');
  return packages.map((p) => p.css).join('') + (vars ? `${selector}{${vars}}` : '');
}

/** İlk çizime yetişmesi gereken dosyalar (latin ve latin-ext alt kümeleri) */
export function fontPreloads(ids: FontId[]): string[] {
  return ids.flatMap((id) => FONT_PACKAGES[id]?.preload ?? []);
}
