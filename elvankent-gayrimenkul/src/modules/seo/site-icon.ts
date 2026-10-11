import { buildTheme } from '@/platform/branding/theme';
import type { OrgSettings } from '@/platform/tenant/tenant';

/**
 * Ofisin yüklenmiş site simgesi yoksa kullanılan otomatik simge: ofis adının baş
 * harfi + ofisin kendi marka rengi. Her kiracı kendi simgesini alır; başka bir
 * ofisin veya platformun simgesi kullanılmaz.
 */
export function siteIconParts(s: Pick<OrgSettings, 'display_name' | 'primary_color' | 'accent_color'>) {
  const theme = buildTheme(s.primary_color, s.accent_color);
  const letter = (s.display_name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '•').toLocaleUpperCase('tr');
  return { letter, background: theme.primary, foreground: theme.primaryFg, accent: theme.accent };
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function siteIconSvg(s: Pick<OrgSettings, 'display_name' | 'primary_color' | 'accent_color'>): string {
  const { letter, background, foreground, accent } = siteIconParts(s);
  const text = letter.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/><rect x="18" y="49" width="28" height="3" rx="1.5" fill="${accent}"/><text x="32" y="43" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34" font-weight="700" fill="${foreground}">${text}</text></svg>`;
}
