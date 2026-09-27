'use client';

import { useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const CONSENT_KEY = 'eg:consent';
const CONSENT_EVENT = 'eg:consent-change';

function analyticsConsent(): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? Boolean((JSON.parse(raw) as { analytics?: boolean }).analytics) : false;
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Vercel Speed Insights (Core Web Vitals: LCP, INP, CLS) ve Web Analytics.
 * Yalnızca Vercel'de çalışır (VERCEL=1). İkisi de çerez kullanmaz ve kişisel veri
 * toplamaz; Web Analytics yine de ziyaretçi "analitik" çerez tercihini onayladıysa
 * yüklenir. Speed Insights sayfa performansını ölçer (hukuk incelemesi için
 * docs/LEGAL_DATA_MAP.md).
 */
export function VercelInsights() {
  const consent = useSyncExternalStore(subscribe, analyticsConsent, () => false);
  return (
    <>
      <SpeedInsights />
      {consent && <Analytics />}
    </>
  );
}
