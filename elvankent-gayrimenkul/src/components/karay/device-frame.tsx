import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Tarayıcı çerçevesi: ürünün gerçek ekran görüntüleri için. Çubuk dekoratiftir; "Canlı" / "Taslak" ürün arayüzündeki gerçek durum kavramlarıdır. */
export function DeviceFrame({ title, status, className, children }: { title: string; status?: 'Canlı' | 'Taslak'; className?: string; children: ReactNode }) {
  return (
    <div className={cn('ky-frame', className)}>
      <div className="ky-frame-bar" aria-hidden>
        <i />
        <i />
        <i />
        <span className="ky-frame-title">{title}</span>
        {status && (
          <span className="ky-frame-chip" data-status={status}>
            <b />
            {status}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
