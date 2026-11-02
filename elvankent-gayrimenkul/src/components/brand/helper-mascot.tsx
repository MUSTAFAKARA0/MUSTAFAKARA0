import Image from 'next/image';
import helper from '@/platform/branding/assets/karays-helper/karays-yardimci-maskot.png';
import { cn } from '@/lib/utils';

/**
 * KARAYS yardımcı maskotu (03_YARDIMCI_MASKOT; amblem biçimli, özel adı yok, statik PNG). KARO'nun
 * yerini almaz. Yalnızca gerçek bir destek veya rehber alanının görsel yüzüdür (iletişim formu, boş durum
 * açıklaması): sohbet balonu, çevrimiçi durumu veya yanıt göstermez. Dekoratiftir (alt=""); anlamı
 * yanındaki metin taşır. Ekran genişliğiyle boyu değişen yerleşimde `sizes` CSS genişliklerini bildirir.
 */
export function HelperMascot({ width, sizes = `${width}px`, className }: { width: number; sizes?: string; className?: string }) {
  const height = Math.round((width * helper.height) / helper.width);
  return (
    <Image
      src={helper}
      alt=""
      width={width}
      height={height}
      sizes={sizes}
      data-platform-brand="helper"
      className={cn('pointer-events-none select-none', className)}
    />
  );
}
