import { publicEnv } from '@/lib/env';
import { karayHostsFromEnv } from '@/platform/tenant/host';

/**
 * KARAY sayfasının kanonik adresi (istekten bağımsız → sayfa statik önbelleklenebilir).
 * KARAY_HOSTS tanımlıysa ilk alan adında kökte (https://karay.com.tr/…); aksi halde
 * platform adresinin /karay yolunda.
 */
export async function karaySiteUrl(): Promise<{ origin: string; path: (p: string) => string }> {
  const dedicated = karayHostsFromEnv(process.env.KARAY_HOSTS)[0];
  if (dedicated) return { origin: `https://${dedicated}`, path: (p) => p };
  let origin = 'http://localhost:3000';
  try {
    origin = new URL(publicEnv.siteUrl).origin;
  } catch {
    // varsayılan
  }
  return { origin, path: (p) => `/karay${p === '/' ? '' : p}` };
}
