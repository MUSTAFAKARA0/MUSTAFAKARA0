/**
 * next/image'ın uzaktan görsel okuyabileceği adresler (images.remotePatterns).
 *
 * Yalnızca uygulamanın kendi Supabase adresleri (NEXT_PUBLIC_SUPABASE_URL ve varsa
 * NEXT_PUBLIC_SUPABASE_STORAGE_URL) ve yalnızca public Storage yolu izinlidir. Önceki joker
 * desen (`*.supabase.co`) başka bir Supabase projesinin public dosyalarının KARAY'ın görüntü
 * iyileştiricisi ve kotasıyla işlenmesine izin veriyordu (SEC-06).
 */
export interface StorageImagePattern {
  protocol: 'http' | 'https';
  hostname: string;
  port: string;
  pathname: string;
}

export const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/**';

export function storageImagePatterns(origins: ReadonlyArray<URL | null | undefined>): StorageImagePattern[] {
  const patterns: StorageImagePattern[] = [];
  const seen = new Set<string>();
  for (const origin of origins) {
    if (!origin || (origin.protocol !== 'https:' && origin.protocol !== 'http:')) continue;
    const key = `${origin.protocol}//${origin.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    patterns.push({
      protocol: origin.protocol === 'https:' ? 'https' : 'http',
      hostname: origin.hostname,
      port: origin.port,
      pathname: PUBLIC_STORAGE_PATH,
    });
  }
  return patterns;
}
