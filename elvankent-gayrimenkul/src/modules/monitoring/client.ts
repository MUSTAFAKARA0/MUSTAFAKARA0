/**
 * Tarayıcı hatalarını /api/monitoring/client-error'a gönderir (sayfa kapanırken de
 * ulaşması için sendBeacon). Kişisel veri gönderilmez: yalnızca hata mesajı,
 * yığın izi ve sorgu parametresiz sayfa yolu. Sayfa başına en fazla 10 rapor.
 */
let sent = 0;

export function reportClientError(error: unknown, source: 'window' | 'promise' | 'boundary'): void {
  if (typeof window === 'undefined' || sent >= 10) return;
  sent += 1;
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Bilinmeyen hata');
    const digest = typeof error === 'object' && error !== null && 'digest' in error ? String((error as { digest: unknown }).digest) : undefined;
    const body = JSON.stringify({
      message: err.message.slice(0, 1000),
      name: err.name.slice(0, 100),
      stack: err.stack?.slice(0, 4000),
      digest,
      path: window.location.pathname.slice(0, 500),
      source,
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/monitoring/client-error', blob)) {
      void fetch('/api/monitoring/client-error', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch {
    // raporlama hatası sessizce yok sayılır
  }
}
