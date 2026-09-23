const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', i: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/**
 * Türkçe metni URL dostu slug'a çevirir.
 *   "Satılık 3+1 Daire – Elvankent" → "satilik-3-plus-1-daire-elvankent"
 */
export function slugify(input: string, maxLength = 100): string {
  const replaced = input
    .replace(/[çÇğĞıIİöÖşŞüÜâÂîÎûÛ]/g, (ch) => TR_MAP[ch] ?? ch)
    .replace(/(\d)\s*\+\s*(\d)/g, '$1-plus-$2')
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' ve ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  const slug = replaced
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > maxLength * 0.6 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

/** İlan slug'ının sonundaki ilan numarasını ayrıştırır: "...-100023" → 100023 */
export function listingNoFromSlug(slug: string): number | undefined {
  const match = /-(\d{6,12})$/.exec(slug) ?? /^(\d{6,12})$/.exec(slug);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) ? n : undefined;
}
