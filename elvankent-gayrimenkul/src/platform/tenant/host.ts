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
