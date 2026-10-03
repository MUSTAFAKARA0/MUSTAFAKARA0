/**
 * Proxy'nin isteğe eklediği alan adı yüzeyi başlığı (karay | shared | tenant).
 * İstemcinin gönderdiği değer proxy'de HER ZAMAN ezilir; sunucu bu başlığa güvenir
 * (x-forwarded-host gibi istemcinin değiştirebileceği başlıklara değil).
 */
export const SURFACE_HEADER = 'x-request-surface';
