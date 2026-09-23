import type { PropertyEventType } from '@/types/database';

type ClientEvent = Exclude<PropertyEventType, 'contact_form'>;

/**
 * İlan etkileşimini sunucuya bildirir (tarayıcı). Sayfa değişse bile
 * iletilmesi için sendBeacon kullanılır; hata kullanıcıya yansıtılmaz.
 */
export function trackEvent(propertyId: string, event: ClientEvent): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({ propertyId, event });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/track', blob)) return;
  } catch {
    // sendBeacon desteklenmiyorsa fetch ile devam
  }
  fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
    () => undefined,
  );
}
