'use client';

import { useEffect, useState } from 'react';
import { MessageSquareText, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { LeadForm, markQrSource } from '@/components/forms/lead-form';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/modules/analytics/track';

interface ContactProps {
  propertyId: string;
  title: string;
  referenceNo: string;
  tel: string | null;
  whatsapp: string | null;
  phoneLabel: string | null;
  appointmentsEnabled: boolean;
  available: boolean;
}

/** Arama / WhatsApp butonları — tıklamalar istatistiğe işlenir */
export function ContactButtons({ propertyId, tel, whatsapp, phoneLabel }: Pick<ContactProps, 'propertyId' | 'tel' | 'whatsapp' | 'phoneLabel'>) {
  if (!tel && !whatsapp) return null;
  return (
    <div className="grid gap-2.5">
      {whatsapp && (
        <Button asChild variant="whatsapp" size="lg" className="w-full">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'whatsapp_click')}>
            <WhatsAppIcon className="size-5" /> WhatsApp&apos;tan sor
          </a>
        </Button>
      )}
      {tel && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={tel} onClick={() => trackEvent(propertyId, 'phone_click')}>
            <Phone /> <span className="numeric">{phoneLabel ? `Arayın: ${phoneLabel}` : 'Arayın'}</span>
          </a>
        </Button>
      )}
    </div>
  );
}

/** İlan sayfasındaki iletişim paneli: hızlı butonlar + "Bilgi al" / "Randevu talep et" formu */
export function ContactPanel(props: ContactProps) {
  const [tab, setTab] = useState<'info' | 'appointment'>('info');
  const property = { id: props.propertyId, title: props.title, referenceNo: props.referenceNo };
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <ContactButtons propertyId={props.propertyId} tel={props.tel} whatsapp={props.whatsapp} phoneLabel={props.phoneLabel} />
      {props.available && (
        <div id="bilgi-talep" className={cn('scroll-mt-28', (props.tel || props.whatsapp) && 'mt-6 border-t border-border pt-6')}>
          {props.appointmentsEnabled ? (
            <SegmentedControl<'info' | 'appointment'>
              label="Talep türü"
              value={tab}
              onValueChange={setTab}
              options={[
                { value: 'info', label: 'Bilgi al' },
                { value: 'appointment', label: 'Randevu talep et' },
              ]}
              className="mb-5 w-full"
            />
          ) : (
            <h2 className="mb-4 text-[15px] font-bold">Bilgi al</h2>
          )}
          {tab === 'info' || !props.appointmentsEnabled ? (
            <LeadForm key="info" kind="listing" property={property} compact />
          ) : (
            <LeadForm key="appointment" kind="appointment" property={property} compact />
          )}
        </div>
      )}
    </div>
  );
}

/** Mobilde ekranın altında sabit iletişim çubuğu */
export function MobileContactBar({ propertyId, tel, whatsapp, priceLabel }: Pick<ContactProps, 'propertyId' | 'tel' | 'whatsapp'> & { priceLabel: string }) {
  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/96 px-3 pt-2.5 shadow-[0_-8px_24px_-12px_rgb(20_26_24/0.25)] backdrop-blur lg:hidden">
      <p className="numeric mb-2 line-clamp-1 px-1 text-[13.5px] font-bold text-foreground">{priceLabel}</p>
      <div className={cn('grid gap-2', tel && whatsapp ? 'grid-cols-[1fr_1fr_1.5fr]' : tel || whatsapp ? 'grid-cols-[1fr_1.5fr]' : 'grid-cols-1')}>
        {tel && (
          <Button asChild variant="outline" size="lg" className="px-2">
            <a href={tel} onClick={() => trackEvent(propertyId, 'phone_click')}>
              <Phone /> Ara
            </a>
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="px-2">
          <a href="#bilgi-talep">
            <MessageSquareText /> Bilgi al
          </a>
        </Button>
        {whatsapp && (
          <Button asChild variant="whatsapp" size="lg" className="px-2">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(propertyId, 'whatsapp_click')}>
              <WhatsAppIcon className="size-5" /> WhatsApp
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Görüntülenmeyi bir kez kaydeder. ?kaynak=qr ile gelinirse (basılı broşür
 * QR kodu) "QR ziyareti" olarak işaretler ve bu oturumdaki talepler "QR kod"
 * kaynağıyla kaydedilir.
 */
export function ViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('kaynak') === 'qr') {
      markQrSource();
      trackEvent(propertyId, 'qr_visit');
    }
    trackEvent(propertyId, 'view');
  }, [propertyId]);
  return null;
}


