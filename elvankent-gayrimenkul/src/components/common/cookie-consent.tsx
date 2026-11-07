'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Çerez tercihleri (kiracı siteleri ve KARAYS sayfası ortak kullanır; bu yüzden
 * ortak katmandadır — kiracı sitesi bileşeni değildir)
 * Zorunlu: yönetici oturum çerezleri (ziyaretçide oluşmaz) ve tarayıcı
 * depolaması (favoriler/karşılaştırma, çerez tercihi). Analitik: Vercel Web
 * Analytics ve Speed Insights yalnızca onay verilirse yüklenir
 * (common/vercel-insights.tsx). Pazarlama çerezi kullanılmaz; ileride eklenecek
 * hizmetler de hasAnalyticsConsent() ile koşullanır.
 * ------------------------------------------------------------------------- */
const CONSENT_KEY = 'eg:consent';
const CONSENT_EVENT = 'eg:consent-change';
const OPEN_EVENT = 'eg:consent-open';

interface Consent {
  v: 1;
  analytics: boolean;
  at: string;
}

let cachedRaw: string | null | undefined;
let cachedConsent: Consent | null = null;

function readConsent(): Consent | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return { v: 1, analytics: false, at: '' };
  }
  if (raw === cachedRaw) return cachedConsent;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Consent) : null;
    // 12 ay sonra tercih yeniden sorulur
    cachedConsent =
      parsed && parsed.v === 1 && Date.now() - new Date(parsed.at).getTime() < 365 * 86_400_000 ? parsed : null;
  } catch {
    cachedConsent = null;
  }
  return cachedConsent;
}

function saveConsent(analytics: boolean) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: 1, analytics, at: new Date().toISOString() }));
  } catch {
    // depolama kapalıysa bu sayfa için geçerli
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

function subscribeConsent(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb);
  return () => window.removeEventListener(CONSENT_EVENT, cb);
}

/** İleride eklenecek analitik hizmetleri için tek kontrol noktası */
export function hasAnalyticsConsent(): boolean {
  return typeof window !== 'undefined' && readConsent()?.analytics === true;
}

const SERVER_PLACEHOLDER: Consent = { v: 1, analytics: false, at: 'server' };

export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Çerez tercihleri
    </button>
  );
}

/**
 * Çerez bildirimi + tercih penceresi.
 *   policyHref  "Çerez politikası" bağlantısı (kiracı sitesi: /cerez-politikasi; KARAYS: /karay/yasal/cerez-politikasi)
 */
export function CookieConsent({ raised, policyHref = '/cerez-politikasi' }: { raised?: boolean; policyHref?: string }) {
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => SERVER_PLACEHOLDER);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const openPreferences = () => {
    setAnalytics(readConsent()?.analytics ?? false);
    setDialogOpen(true);
  };

  // Alt bilgideki "Çerez tercihleri" bağlantısı pencereyi açar
  useEffect(() => {
    const onOpen = () => {
      setAnalytics(readConsent()?.analytics ?? false);
      setDialogOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <>
      {consent === null && !dialogOpen && (
        <div
          role="region"
          aria-label="Çerez bildirimi"
          className={cn(
            'fixed inset-x-3 z-30 mx-auto max-w-xl animate-fade-up rounded-2xl border border-border bg-surface p-4 shadow-lg sm:inset-x-auto sm:left-6 sm:w-[30rem]',
            raised ? 'bottom-24 lg:bottom-6' : 'bottom-3 sm:bottom-6',
          )}
        >
          <p className="text-[13.5px] leading-relaxed text-foreground/85">
            Sitemizde yalnızca zorunlu çerezler kullanılır. Anonim ziyaret ve performans ölçümü (Vercel Web Analytics ve Speed Insights) yalnızca izin
            verirseniz çalışır.{' '}
            <Link href={policyHref} className="font-semibold text-primary-ink underline underline-offset-2">
              Çerez politikası
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => saveConsent(true)}>
              Kabul et
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveConsent(false)}>
              Yalnızca zorunlu
            </Button>
            <Button size="sm" variant="ghost" onClick={openPreferences}>
              Tercihler
            </Button>
          </div>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Çerez tercihleri" description="Hangi çerez türlerine izin verdiğinizi seçebilirsiniz.">
          <div className="mt-5 space-y-5">
            <Switch
              checked
              disabled
              onCheckedChange={() => undefined}
              label="Zorunlu"
              description="Sitenin çalışması ve güvenliği için gereklidir (ör. çerez tercihinizin ve favorilerinizin tarayıcıda tutulması, yönetici oturumu). Kapatılamaz."
            />
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              label="Analitik"
              description="Vercel Web Analytics (anonim sayfa ziyareti istatistikleri) ve Vercel Speed Insights (sayfa hızı ölçümü). Çerez kullanmaz; ziyaretler kimliğinizle eşleştirilmeden toplu sayılır. Sağlayıcı Vercel Inc. (ABD). Yalnızca izin verirseniz yüklenir; izninizi buradan dilediğiniz zaman geri alabilirsiniz."
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => {
                saveConsent(analytics);
                setDialogOpen(false);
              }}
            >
              Tercihleri kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
