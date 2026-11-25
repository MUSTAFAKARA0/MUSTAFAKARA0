'use client';

import { MessageSquareText, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { useBarScrollPadding, useContactBar } from '@/components/property/use-contact-bar';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/modules/analytics/track';

/**
 * Masaüstünde (lg+) iletişim kutusu görünümden çıktığında alta süzülen kompakt çubuk: fiyat, ilan no,
 * ara / WhatsApp / bilgi al. Mobilde MobileContactBar kullanılır. Satıldı/kiralandı/önizleme
 * durumlarında üst bileşen hiç çizmez.
 */
export function StickyContactBar({
  propertyId,
  tel,
  whatsapp,
  priceLabel,
  referenceNo,
  watchId,
}: {
  propertyId: string;
  tel: string | null;
  whatsapp: string | null;
  priceLabel: string;
  referenceNo: string;
  /** İzlenen iletişim kutusunun id'si */
  watchId: string;
}) {
  const visible = useContactBar(watchId, true);
  useBarScrollPadding(visible, '5.5rem');
  if (!visible) return null;
  return (
    <div className="su-stickybar" role="region" aria-label="Hızlı iletişim">
      <div className="min-w-0 flex-1">
        <p className="numeric truncate text-[17px] leading-tight font-bold text-foreground">{priceLabel}</p>
        <p className="numeric truncate text-[12.5px] text-muted-foreground">İlan no: {referenceNo}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tel && (
          <Button asChild variant="outline" size="lg">
            <a href={tel} onClick={() => trackEvent(propertyId, 'phone_click')}>
              <Phone /> Ara
            </a>
          </Button>
        )}
        <Button asChild variant="outline" size="lg">
          <a href="#bilgi-talep">
            <MessageSquareText /> Bilgi al
          </a>
        </Button>
        {whatsapp && (
          <Button asChild variant="whatsapp" size="lg">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'whatsapp_click')}>
              <WhatsAppIcon className="size-5" /> WhatsApp
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
