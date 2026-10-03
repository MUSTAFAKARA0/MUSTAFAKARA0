/**
 * İstek adresinden (Host) kiracı anahtarını çözer. proxy.ts içinde çalışır;
 * veritabanına gitmez, yalnızca yapılandırmaya bakar:
 *
 *  1. Varsayılan alan adları, localhost, IP adresleri ve *.vercel.app
 *     önizleme adresleri → varsayılan kiracı (DEFAULT_TENANT_SLUG).
 *  2. {slug}.{PLATFORM_ROOT_DOMAIN} → slug (SaaS alt alan adı).
 *  3. Diğer geçerli alan adları → alan adının kendisi (özel alan adı);
 *     organization_domains tablosunda sayfa katmanında çözülür.
 *
 * Kiracı anahtarı URL'ye gömülür (/t/{anahtar}/...) — böylece her kiracının
 * sayfaları ISR önbelleğinde ayrı saklanır.
 */
export interface TenantHostConfig {
  defaultSlug: string;
  platformRootDomain?: string;
  /** Varsayılan kiracıya ait alan adları (NEXT_PUBLIC_SITE_URL + www varyantı) */
  defaultHosts: string[];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HOSTNAME = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return '';
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function isValidTenantKey(key: string): boolean {
  return (SLUG.test(key) && key.length <= 40) || (HOSTNAME.test(key) && key.length <= 253);
}

export function tenantKeyForHost(rawHost: string | null | undefined, config: TenantHostConfig): string {
  const host = normalizeHost(rawHost);
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    IPV4.test(host) ||
    host.startsWith('[') ||
    host.endsWith('.vercel.app') ||
    config.defaultHosts.includes(host)
  ) {
    return config.defaultSlug;
  }

  const root = config.platformRootDomain;
  if (root && (host === root || host === `www.${root}`)) return config.defaultSlug;
  if (root && host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    if (sub === 'www') return config.defaultSlug;
    return SLUG.test(sub) && sub.length <= 40 ? sub : config.defaultSlug;
  }

  return HOSTNAME.test(host) ? host : config.defaultSlug;
}

/**
 * KARAY'ın herkese açık şirket/ürün sayfası (/karay) hangi adreslerde sunulur?
 *
 * KARAY sayfası bir kiracının (emlak ofisinin) alan adında AÇILMAZ: ofisin sitesinde
 * platform sahibinin tanıtımı görünmez. Sunulduğu adresler:
 *  - KARAY_HOSTS listesindeki alan adları (ör. karay.com.tr, www.karay.com.tr) —
 *    bu alan adlarında kök adres (/) da KARAY sayfasıdır;
 *  - KARAY_HOSTS tanımlı değilse yalnızca geliştirme/demo adresleri (localhost,
 *    IP, *.vercel.app) ve platform kök alan adı (PLATFORM_ROOT_DOMAIN).
 */
export interface KarayHostConfig {
  karayHosts: string[];
  platformRootDomain?: string;
}

export function karayHostKind(rawHost: string | null | undefined, config: KarayHostConfig): 'dedicated' | 'shared' | null {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  if (config.karayHosts.includes(host)) return 'dedicated';
  if (config.karayHosts.length > 0) return null;
  const root = config.platformRootDomain;
  if (host === 'localhost' || IPV4.test(host) || host.endsWith('.vercel.app') || (root && (host === root || host === `www.${root}`))) return 'shared';
  return null;
}

export function karayHostsFromEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((h) => normalizeHost(h))
    .filter((h) => HOSTNAME.test(h) || h === 'localhost');
}

/** NEXT_PUBLIC_SITE_URL'den varsayılan alan adlarını üretir (www dahil). */
export function defaultHostsFromSiteUrl(siteUrl: string | undefined): string[] {
  if (!siteUrl) return [];
  try {
    const host = normalizeHost(new URL(siteUrl).host);
    const bare = host.replace(/^www\./, '');
    return [bare, `www.${bare}`];
  } catch {
    return [];
  }
}
