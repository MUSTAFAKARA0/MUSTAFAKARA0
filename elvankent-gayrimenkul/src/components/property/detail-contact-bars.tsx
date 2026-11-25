import { MobileContactBar } from '@/components/property/contact-panel';
import { StickyContactBar } from '@/components/property/sticky-contact-bar';

/** Tüm ilan detayı düzenlerinde ortak: masaüstü yapışkan çubuk + mobil tek satırlık çubuk */
export function DetailContactBars({
  propertyId,
  tel,
  whatsapp,
  priceLabel,
  referenceNo,
}: {
  propertyId: string;
  tel: string | null;
  whatsapp: string | null;
  priceLabel: string;
  referenceNo: string;
}) {
  return (
    <>
      <StickyContactBar propertyId={propertyId} tel={tel} whatsapp={whatsapp} priceLabel={priceLabel} referenceNo={referenceNo} watchId="iletisim-kutusu" />
      <MobileContactBar propertyId={propertyId} tel={tel} whatsapp={whatsapp} priceLabel={priceLabel} />
    </>
  );
}
