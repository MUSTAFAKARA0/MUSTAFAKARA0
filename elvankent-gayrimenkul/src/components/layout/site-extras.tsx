'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { cn } from '@/lib/utils';

const NOTICE_KEY = 'eg:cookie-notice';
const NOTICE_EVENT = 'eg:cookie-notice-change';

function readNotice(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return true;
  }
}

function subscribeNotice(cb: () => void) {
  window.addEventListener(NOTICE_EVENT, cb);
  return () => window.removeEventListener(NOTICE_EVENT, cb);
}

/**
 * Bilgilendirme amaçlı çerez bildirimi. Site yalnızca zorunlu çerezler ve
 * tarayıcı depolaması kullandığından açık rıza gerektiren izleme yapılmaz.
 */
export function CookieNotice() {
  const dismissed = useSyncExternalStore(subscribeNotice, readNotice, () => true);
  const pathname = usePathname();
  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // depolama kapalıysa bildirim bu sayfa için kapanır
    }
    window.dispatchEvent(new Event(NOTICE_EVENT));
  };

  return (
    <div
      role="region"
      aria-label="Çerez bildirimi"
      className={cn(
        'fixed inset-x-3 z-30 mx-auto flex max-w-xl animate-slide-up items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lift sm:inset-x-auto sm:left-6',
        pathname.startsWith('/ilan/') ? 'bottom-28 lg:bottom-6' : 'bottom-3 sm:bottom-6',
      )}
    >
      <p className="text-[13px] leading-snug text-sand-700">
        Yalnızca zorunlu çerezler ve favorileriniz için tarayıcı depolaması kullanıyoruz.{' '}
        <Link href="/cerez-politikasi" className="font-semibold text-brand-700 underline underline-offset-2">
          Çerez Politikası
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
      >
        Anladım
      </button>
    </div>
  );
}

/** Tüm sayfalarda sağ altta WhatsApp kısayolu (ilan detayında alt çubuk olduğu için gizlenir) */
export function FloatingWhatsApp({ href }: { href: string | null }) {
  const pathname = usePathname();
  const noticeDismissed = useSyncExternalStore(subscribeNotice, readNotice, () => true);
  if (!href || pathname.startsWith('/ilan/')) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile yazın"
      className={cn(
        'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lift transition hover:scale-105 hover:bg-whatsapp-hover sm:right-6 sm:bottom-6',
        noticeDismissed ? 'bottom-4' : 'bottom-28',
      )}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
