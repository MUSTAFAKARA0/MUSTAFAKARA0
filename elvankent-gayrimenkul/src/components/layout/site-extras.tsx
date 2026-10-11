'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GitCompareArrows, X } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/form-controls';
import { useCompare, useHydrated } from '@/hooks/use-local-list';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
 * Çerez tercihleri
 * Zorunlu: yönetici oturum çerezleri (ziyaretçide oluşmaz) ve tarayıcı
 * depolaması (favoriler/karşılaştırma). Analitik: yalnızca onay verilirse.
 * Site şu anda analitik/pazarlama çerezi kullanmaz; ileride eklenecek
 * hizmetler hasAnalyticsConsent() ile koşullanır.
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

export function CookieConsent({ raised }: { raised?: boolean }) {
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
            Sitemizde yalnızca zorunlu çerezler kullanılır. Analitik çerezler yalnızca izin verirseniz etkinleşir.{' '}
            <Link href="/cerez-politikasi" className="font-semibold text-primary-ink underline underline-offset-2">
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
              description="Sitenin çalışması için gereklidir (ör. favorilerinizin tarayıcıda tutulması). Kapatılamaz."
            />
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              label="Analitik"
              description="Site kullanımını anlamamıza yardımcı olan üçüncü taraf ölçüm araçları. Şu anda kullanılmamaktadır; eklenirse yalnızca izninizle çalışır."
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

/** Karşılaştırma listesi doluyken ekranın altında sabit çubuk */
export function CompareBar() {
  const { items, clear } = useCompare();
  const hydrated = useHydrated();
  const pathname = usePathname();
  if (!hydrated || items.length === 0 || pathname.startsWith('/karsilastir')) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom lg:bottom-6 lg:left-auto lg:right-6 lg:w-auto lg:rounded-2xl lg:border lg:shadow-lg">
      <div className="flex items-center gap-3 px-4 pt-3 lg:px-4 lg:pb-3">
        <GitCompareArrows className="size-5 shrink-0 text-primary-ink" aria-hidden />
        <p className="flex-1 text-sm">
          <strong>{items.length}</strong> ilan karşılaştırmada <span className="text-muted-foreground">(en fazla 4)</span>
        </p>
        <Button asChild size="sm">
          <Link href="/karsilastir">Karşılaştır</Link>
        </Button>
        <button
          type="button"
          onClick={clear}
          aria-label="Karşılaştırma listesini temizle"
          className="rounded-lg p-2.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Sağ altta WhatsApp kısayolu (ilan detayında alt iletişim çubuğu olduğu için gizlenir) */
export function FloatingWhatsApp({ href }: { href: string | null }) {
  const pathname = usePathname();
  const { items } = useCompare();
  const hydrated = useHydrated();
  if (!href || pathname.startsWith('/ilan/') || pathname.startsWith('/karsilastir')) return null;
  const raised = hydrated && items.length > 0;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile yazın"
      className={cn(
        'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition hover:scale-105 hover:bg-whatsapp-hover sm:right-6',
        raised ? 'bottom-24 lg:bottom-28' : 'bottom-4 sm:bottom-6',
      )}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
