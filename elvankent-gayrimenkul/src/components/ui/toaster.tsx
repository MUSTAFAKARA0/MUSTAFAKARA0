'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

/**
 * Uygulama bildirim kutusu (sonner üzerinde): masaüstünde üstte ortada, telefonda altta (güvenli alanın üstünde),
 * en fazla 3 bildirim, hata bildirimleri daha uzun kalır. Renkler panel tokenlarından gelir; hareket
 * yalnızca `prefers-reduced-motion: no-preference` içinde (globals.css .app-toast). Hata süresi: components/ui/toast.ts.
 */
export function AppToaster() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return (
    <Toaster
      position={mobile ? 'bottom-center' : 'top-center'}
      richColors
      closeButton
      visibleToasts={3}
      duration={4500}
      offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)', top: '1rem' }}
      mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)', left: '0.75rem', right: '0.75rem' }}
      toastOptions={{ classNames: { toast: 'app-toast font-sans rounded-xl shadow-[var(--shadow-3)]' }, duration: 4500 }}
    />
  );
}
