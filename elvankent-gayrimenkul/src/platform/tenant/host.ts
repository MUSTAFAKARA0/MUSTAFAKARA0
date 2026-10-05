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

/**
 * Varsayılan kiracı için ayrılmış anahtar: DEFAULT_TENANT_SLUG tanımlı değilse proxy bu
 * anahtarı üretir ve sunucu varsayılan kiracıyı veritabanındaki `organizations.is_default`
 * işaretinden bulur. Kod içinde hiçbir kiracının adı/slug'ı yazılmaz. Geçerli bir slug
 * veya alan adı olamaz (alt çizgi), dolayısıyla gerçek bir kiracıyla çakışmaz.
 */
export const DEFAULT_TENANT_KEY = '_';

export function isValidTenantKey(key: string): boolean {
  return key === DEFAULT_TENANT_KEY || (SLUG.test(key) && key.length <= 40) || (HOSTNAME.test(key) && key.length <= 253);
}

export function tenantKeyForHost(rawHost: string | null | undefined, config: TenantHostConfig): string {
  const host = normalizeHost(rawHost);
  if (!host || isDevOrPreviewHost(host) || config.defaultHosts.includes(host)) {
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
 * Alan adının yüzeyi — KARAY ile kiracıların (emlak ofislerinin) ayrıldığı TEK yer.
 *
 *  - karay:  KARAY_HOSTS listesindeki alan adları (KARAY'ın kendi alan adı)
 *  - shared: platform kök alan adı (PLATFORM_ROOT_DOMAIN ve www), geliştirme ve
 *            önizleme adresleri (localhost, *.localhost, IP, *.vercel.app)
 *  - tenant: diğer her şey — kiracıların özel alan adları ve {slug}.{kök} alt alan adları
 *
 * KARAY yüzeyleri (/platform konsolu, /karay sayfası) yalnızca karay/shared alan
 * adlarında açılır; kiracı alan adında yalnızca kiracı sitesi ve ofis paneli (/admin)
 * vardır. Alan adı boşsa kiracı sayılır (kapalı varsayılan).
 */
export type HostSurface = 'karay' | 'shared' | 'tenant';

export interface KarayHostConfig {
  karayHosts: string[];
  platformRootDomain?: string;
}

/** Geliştirme ve önizleme adresleri (yüzey ve kiracı çözümlemesi AYNI listeyi kullanır) */
export function isDevOrPreviewHost(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[') || host.endsWith('.vercel.app');
}

export function hostSurface(rawHost: string | null | undefined, config: KarayHostConfig): HostSurface {
  const host = normalizeHost(rawHost);
  if (!host) return 'tenant';
  if (config.karayHosts.includes(host)) return 'karay';
  const root = config.platformRootDomain;
  if (isDevOrPreviewHost(host) || (root && (host === root || host === `www.${root}`))) return 'shared';
  return 'tenant';
}

/** Ortam değişkenlerinden yüzey yapılandırması (proxy ve sunucu aynı değeri kullanır) */
export function karayHostConfigFromEnv(env: Record<string, string | undefined>): KarayHostConfig {
  return { karayHosts: karayHostsFromEnv(env.KARAY_HOSTS), platformRootDomain: (env.PLATFORM_ROOT_DOMAIN || '').toLowerCase() || undefined };
}

/** KARAY platform konsolu (/platform) bu yüzeyde açılabilir mi? */
export function platformConsoleAllowed(surface: HostSurface): boolean {
  return surface !== 'tenant';
}

/**
 * KARAY'ın herkese açık şirket/ürün sayfası (/karay) hangi adreslerde sunulur?
 *  - 'dedicated': KARAY_HOSTS alan adı — kök adres (/) da KARAY sayfasıdır;
 *  - 'shared': KARAY_HOSTS tanımlı değilken platform/geliştirme/önizleme adresleri (/karay yolunda);
 *  - null: kiracı alan adı (açılmaz), ya da KARAY_HOSTS tanımlıyken diğer adresler.
 */
export function karayHostKind(rawHost: string | null | undefined, config: KarayHostConfig): 'dedicated' | 'shared' | null {
  return karayKindForSurface(hostSurface(rawHost, config), config);
}

function karayKindForSurface(surface: HostSurface, config: KarayHostConfig): 'dedicated' | 'shared' | null {
  if (surface === 'karay') return 'dedicated';
  if (surface === 'shared' && config.karayHosts.length === 0) return 'shared';
  return null;
}

/**
 * Proxy'nin bir istek için vereceği karar. Yüzey ayrımı (KARAY ↔ kiracı) burada,
 * oturum çerezlerine dokunulmadan ÖNCE verilir.
 */
export type RequestRoute =
  | { kind: 'not-found' }
  /** Oturum gerektiren paneller: KARAY konsolu veya ofis paneli */
  | { kind: 'panel'; area: 'platform' | 'admin' }
  | { kind: 'api' }
  /** /karay yolu olduğu gibi sunulur */
  | { kind: 'karay' }
  /** KARAY'a ayrılmış alan adında yol /karay altına yeniden yazılır */
  | { kind: 'karay-rewrite' }
  /** Kiracı sitesi: /t/{anahtar}{yol} */
  | { kind: 'tenant-site' };

/** Yol öneki: /platform hem /platform hem /platform/... eşleşir; /platformlar eşleşmez */
export function isUnderPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveRequestSurface(pathname: string, rawHost: string | null | undefined, config: KarayHostConfig): { route: RequestRoute; surface: HostSurface } {
  const surface = hostSurface(rawHost, config);
  return { route: routeFor(pathname, surface, config), surface };
}

function routeFor(pathname: string, surface: HostSurface, config: KarayHostConfig): RequestRoute {
  // İç kiracı rotaları yalnızca yeniden yazma ile kullanılabilir
  if (isUnderPath(pathname, '/t')) return { kind: 'not-found' };

  if (isUnderPath(pathname, '/platform')) return platformConsoleAllowed(surface) ? { kind: 'panel', area: 'platform' } : { kind: 'not-found' };
  if (isUnderPath(pathname, '/api/platform')) return platformConsoleAllowed(surface) ? { kind: 'api' } : { kind: 'not-found' };
  // Ofis tasarım önizlemesi (Ofis paneli › Site tasarımı): ofis paneliyle aynı kural (/admin gibi).
  // Yetki ve kiracı sayfada oturumdan doğrulanır; KARAY oturumu ofis bağlamı alamaz.
  if (isUnderPath(pathname, '/site-onizleme/ofis')) return { kind: 'panel', area: 'admin' };
  // KARAY site önizlemesi (Yeni Site Oluştur sihirbazı): konsolla aynı kural — kiracı alan adında yok
  if (isUnderPath(pathname, '/site-onizleme')) return platformConsoleAllowed(surface) ? { kind: 'panel', area: 'platform' } : { kind: 'not-found' };
  if (isUnderPath(pathname, '/admin')) return { kind: 'panel', area: 'admin' };
  if (isUnderPath(pathname, '/api')) return { kind: 'api' };

  const karay = karayKindForSurface(surface, config);
  if (isUnderPath(pathname, '/karay')) return karay ? { kind: 'karay' } : { kind: 'not-found' };
  if (karay === 'dedicated') return { kind: 'karay-rewrite' };
  return { kind: 'tenant-site' };
}

export function karayHostsFromEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((h) => normalizeHost(h))
    .filter((h) => HOSTNAME.test(h) || h === 'localhost');
}

/**
 * Kiracının iki kökü (FAZ 0):
 *  - siteBaseUrl: kanonik site adresi (SEO, sitemap, paylaşım) — birincil aktif alan adı, yoksa
 *    {slug}.{kök alan adı}, varsayılan kiracıda NEXT_PUBLIC_SITE_URL.
 *  - panelBaseUrl: ofis paneli bağlantıları (davet / aktivasyon). Kiracının kendi adresi yoksa
 *    NEXT_PUBLIC_SITE_URL (= varsayılan kiracının, yani BAŞKA bir müşterinin alan adı) KULLANILMAZ;
 *    KARAY'ın kendi alan adına (KARAY_HOSTS) düşülür. Hiçbiri yoksa (tek kiracılı kurulum) eski davranış.
 */
export function tenantBaseUrls(input: {
  primaryDomain?: string | null;
  slug: string;
  isDefault: boolean;
  siteUrl: string;
  platformRootDomain?: string;
  karayHosts: string[];
}): { siteBaseUrl: string; panelBaseUrl: string } {
  const siteUrl = input.siteUrl.replace(/\/+$/, '');
  if (input.primaryDomain) {
    const own = `https://${input.primaryDomain}`;
    return { siteBaseUrl: own, panelBaseUrl: own };
  }
  if (input.isDefault) return { siteBaseUrl: siteUrl, panelBaseUrl: siteUrl };
  const root = (input.platformRootDomain ?? '').toLowerCase();
  if (root) {
    const sub = `https://${input.slug}.${root}`;
    return { siteBaseUrl: sub, panelBaseUrl: sub };
  }
  const karay = input.karayHosts.find((h) => h !== 'localhost');
  return { siteBaseUrl: siteUrl, panelBaseUrl: karay ? `https://${karay}` : siteUrl };
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
