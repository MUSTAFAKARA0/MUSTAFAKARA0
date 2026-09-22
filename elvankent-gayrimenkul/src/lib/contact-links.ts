/**
 * Mobil uyumlu iletişim bağlantıları (tel: ve wa.me).
 */

/** +90 ile başlayan uluslararası formatta sadece rakamlar: 905321234567 */
function normalizeTrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = normalizeTrPhone(raw);
  return n ? `tel:+${n}` : null;
}

export function whatsappHref(raw: string | null | undefined, message?: string): string | null {
  const n = normalizeTrPhone(raw);
  if (!n) return null;
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

export function propertyWhatsappMessage(input: { title: string; listingNo: number; url: string }): string {
  return `Merhaba, "${input.title}" ilanınız (İlan No: ${input.listingNo}) hakkında bilgi almak istiyorum.\n${input.url}`;
}
