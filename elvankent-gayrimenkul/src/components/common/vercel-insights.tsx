'use client';

import { useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { hasAnalyticsConsent } from '@/components/common/cookie-consent';

const CONSENT_EVENT = 'eg:consent-change';

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
 * Yalnızca Vercel'de çalışır (VERCEL=1). İkisi de çerez kullanmaz; yine de ikisi de
 * yalnızca ziyaretçi "Analitik" tercihini onayladıysa yüklenir (onaysız hiçbir ölçüm
 * betiği çalışmaz; çerez bildirimi ve çerez politikası bu davranışı anlatır — bkz.
 * common/cookie-consent.tsx, modules/content/default-pages.ts, docs/LEGAL_DATA_MAP.md).
 */
/**
 * Bileşen kaldırılsa da yüklenmiş betik sayfada kalır (SPA gezinmelerini dinlemeye devam eder);
 * onay geri çekilince her olay burada düşürülür. Tek onay okuyucu: hasAnalyticsConsent (12 ay süresi dahil).
 */
function gate<T>(event: T): T | null {
  return hasAnalyticsConsent() ? event : null;
}

export function VercelInsights() {
  const consent = useSyncExternalStore(subscribe, hasAnalyticsConsent, () => false);
  if (!consent) return null;
  return (
    <>
      <SpeedInsights beforeSend={gate} />
      <Analytics beforeSend={gate} />
    </>
  );
}
