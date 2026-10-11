import type { Enums } from '@/types/supabase';

export type TrackedEvent = Exclude<Enums<'property_event_type'>, 'contact_form' | 'appointment_request'>;

/**
 * İlan etkileşimini sunucuya bildirir (tarayıcı). Çerez kullanılmaz; sunucu
 * IP + tarayıcı bilgisinin GÜNLÜK değişen özetini kullanır. Sayfa değişse bile
 * iletilmesi için sendBeacon tercih edilir; hata kullanıcıya yansıtılmaz.
 */
export function trackEvent(propertyId: string, event: TrackedEvent): void {
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
