'use client';

import { useEffect } from 'react';
import { MessageSquareText, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { trackEvent } from '@/lib/track';
import { cn } from '@/lib/utils';

interface ContactLinks {
  propertyId: string;
  tel: string | null;
  whatsapp: string | null;
  phoneLabel?: string;
}

/** Arama ve WhatsApp butonları — tıklamalar istatistiğe işlenir */
export function ContactButtons({ propertyId, tel, whatsapp, phoneLabel, className }: ContactLinks & { className?: string }) {
  if (!tel && !whatsapp) return null;
  return (
    <div className={cn('grid gap-2.5', className)}>
      {whatsapp && (
        <Button asChild variant="whatsapp" size="lg" className="w-full">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'whatsapp_click')}>
            <WhatsAppIcon className="size-5!" /> WhatsApp&apos;tan Bilgi Al
          </a>
        </Button>
      )}
      {tel && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={tel} onClick={() => trackEvent(propertyId, 'phone_click')}>
            <Phone /> {phoneLabel ? `Ara: ${phoneLabel}` : 'Hemen Ara'}
          </a>
        </Button>
      )}
    </div>
  );
}

/** Mobilde ekranın altında sabit iletişim çubuğu */
export function MobileContactBar({ propertyId, tel, whatsapp, priceLabel }: ContactLinks & { priceLabel: string }) {
  if (!tel && !whatsapp) {
    // Telefon tanımlı değilse sayfadaki bilgi talep formuna yönlendir
    return (
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/96 px-3 pt-2.5 backdrop-blur lg:hidden">
        <p className="mb-2 truncate px-1 text-[13px] font-bold text-brand-800">{priceLabel}</p>
        <Button asChild size="lg" className="w-full">
          <a href="#bilgi-talep">
            <MessageSquareText /> Bilgi Talep Et
          </a>
        </Button>
      </div>
    );
  }
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/96 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_rgb(20_32_30/0.25)] backdrop-blur lg:hidden">
      <p className="mb-2 truncate px-1 text-[13px] font-bold text-brand-800">{priceLabel}</p>
      <div className={cn('grid gap-2', tel && whatsapp ? 'grid-cols-[1fr_1.6fr]' : 'grid-cols-1')}>
        {tel && (
          <Button asChild variant="outline" size="lg">
            <a href={tel} onClick={() => trackEvent(propertyId, 'phone_click')}>
              <Phone /> Ara
            </a>
          </Button>
        )}
        {whatsapp && (
          <Button asChild variant="whatsapp" size="lg">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'whatsapp_click')}>
              <WhatsAppIcon className="size-5!" /> WhatsApp&apos;tan Bilgi Al
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** Sayfa görüntülenmesini bir kez kaydeder */
export function ViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    trackEvent(propertyId, 'view');
  }, [propertyId]);
  return null;
}
