const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/**
 * Türkçe metni URL dostu slug'a çevirir (veritabanındaki public.slugify ile
 * aynı kurallar). Uzun metinler kelime sınırında kısaltılır.
 *   "Elvankent 3+1 Satılık Daire" → "elvankent-3-1-satilik-daire"
 */
export function slugify(input: string, maxLength = 120): string {
  const slug = input
    .replace(/[çÇğĞıIİöÖşŞüÜâÂîÎûÛ]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > maxLength * 0.6 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(value: string, maxLength = 120): boolean {
  return value.length > 0 && value.length <= maxLength && SLUG_PATTERN.test(value);
}
