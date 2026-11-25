/**
 * Önizleme yükünü (manifest + site bilgisi) URL güvenli base64'e çevirir.
 *
 * Bilerek bağımlılıksızdır: istemci bileşenleri (ör. ofis panelindeki aile önizleme penceresi) bunu içe
 * aktardığında katalog, manifest derleyicisi veya şema tarayıcı paketine girmez. Böylece ofisin izni
 * olmayan ailelerin adları ve kimlikleri istemciye hiç ulaşmaz (DP-03). Çözme ve doğrulama sunucuda
 * `site-info.ts` içindeki `decodePreviewPayload` ile yapılır.
 */
export function encodePreviewPayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
