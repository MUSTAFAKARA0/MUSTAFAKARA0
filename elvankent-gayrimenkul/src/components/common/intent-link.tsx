'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

/**
 * Panel bağlantısı: sayfa açılır açılmaz ön yükleme YAPMAZ, kullanıcı niyet gösterince
 * (fare üzerine gelme, klavye odağı, dokunma) ön yükler.
 *
 * Neden: yönetim sayfaları kişiye özeldir (dinamik); varsayılan ön yükleme, menüdeki her
 * bağlantı için sunucuda düzeni (oturum + ofis sorguları) ayrı ayrı çalıştırıyordu.
 * Ölçüm: tek panel sayfası açılışı 136–206 Supabase isteği üretiyordu (12 bağlantı × 2).
 */
export default function IntentLink({ prefetch, href, onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  const warm = () => {
    if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) router.prefetch(href);
  };
  return (
    <NextLink
      href={href}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      {...props}
    />
  );
}
