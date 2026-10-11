/** Telefon numarasını uluslararası biçime çevirir (90XXXXXXXXXX). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `90${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('90')) return digits;
  return digits.length >= 10 ? digits : null;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `tel:+${n}` : null;
}

export function whatsappHref(raw: string | null | undefined, message?: string): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** "Merhaba, [İLAN BAŞLIĞI] ilanı hakkında bilgi almak istiyorum." + ilan no + adres */
export function propertyWhatsappMessage(title: string, referenceNo: string, url: string): string {
  return `Merhaba, "${title}" ilanı hakkında bilgi almak istiyorum.\nİlan no: ${referenceNo}\n${url}`;
}
