'use client';

import Image, { type ImageLoaderProps, type ImageProps } from 'next/image';
import { mediaUrl, type MediaSource } from '@/modules/media/variants';

type MediaImageProps = Omit<ImageProps, 'src' | 'loader' | 'placeholder' | 'blurDataURL' | 'alt'> & {
  media: MediaSource;
  alt: string;
};

/**
 * Sunucuda üretilmiş varyantlardan (320…2880 px) duyarlı görsel.
 * next/image `sizes` ile srcset üretir; özel yükleyici her genişlik için
 * uygun varyantı seçer → orijinal (4K) dosya ziyaretçiye gönderilmez,
 * Next.js/Vercel görsel optimizasyon ücreti oluşmaz.
 */
export function MediaImage({ media, alt, ...props }: MediaImageProps) {
  const hasVariants = Boolean(media.public_base && media.variant_widths?.length);
  const blur = media.blur_data_url ?? undefined;
  const loader = ({ width }: ImageLoaderProps) => mediaUrl(media, width);
  return (
    <Image
      {...props}
      alt={alt}
      src={mediaUrl(media, 1440)}
      loader={hasVariants ? loader : undefined}
      unoptimized={!hasVariants}
      placeholder={blur ? 'blur' : 'empty'}
      blurDataURL={blur}
    />
  );
}
