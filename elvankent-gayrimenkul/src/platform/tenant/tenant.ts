import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import { createPublicClient, createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_TENANT_KEY, hostSurface, isDevOrPreviewHost, isValidTenantKey, karayHostConfigFromEnv, karayHostsFromEnv, normalizeHost, tenantBaseUrls, tenantKeyForHost } from '@/platform/tenant/host';
import { tenantHostConfig } from '@/platform/tenant/config';
import { parseFeatureOverrides, type FeatureOverrides, type SiteStatus } from '@/platform/tenant/site-state';

export type { OrgSettings } from '@/platform/tenant/default-settings';
import { defaultSettings, type OrgSettings } from '@/platform/tenant/default-settings';
export { defaultSettings };

export interface TenantFeatures {
  crm: boolean;
  analytics: boolean;
  pdf: boolean;
  customDomain: boolean;
}

/** Yayındaki site yapılandırması (KARAY Web Sitesi Yönetimi); taslak burada ASLA yoktur */
export interface TenantSite {
  published: unknown;
  version: number;
  status: SiteStatus;
  maintenanceMessage: string | null;
  overrides: FeatureOverrides;
}

export interface Tenant {
  /** URL'deki kiracı anahtarı (slug veya özel alan adı) */
  key: string;
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  referencePrefix: string;
  settings: OrgSettings;
  /** Kanonik site kökü (sonunda / olmadan): SEO, sitemap, paylaşım bağlantıları */
  baseUrl: string;
  /**
   * Ofis paneli bağlantılarının kökü (davet / aktivasyon e-postaları). Kiracının kendi adresi
   * yoksa KARAY'ın alan adıdır — başka bir müşterinin (varsayılan kiracının) alan adı değil.
   */
  panelBaseUrl: string;
  features: TenantFeatures;
  site: TenantSite;
}

const ORG_COLUMNS = 'id, slug, name, is_default, reference_prefix, status';


/**
 * Veritabanında public_tenant* fonksiyonları yoksa (20260929000001 migration'ı henüz
 * uygulanmamış) PostgREST "fonksiyon bulunamadı" döner → eski doğrudan okumaya dönülür.
 */
function missingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

type PublicOrg = { id: string; slug: string; name: string; is_default: boolean; reference_prefix: string; status: string };

/**
 * Kiracı TEK TEK ve yalnızca adresiyle (slug) veya doğrulanmış alan adıyla bulunur;
 * herkese açık anahtarla ofis listesi çekilemez (platformun müşteri listesi gizli).
 */
async function findOrg(supabase: ReturnType<typeof createPublicClient>, key: string): Promise<PublicOrg | null> {
  const byHost = key.includes('.');
  const rpc = await supabase.rpc('public_tenant', byHost ? { p_hostname: key } : { p_slug: key }, { get: true });
  if (!rpc.error) return rpc.data?.[0] ?? null;
  if (!missingFunction(rpc.error)) throw new Error(`Site bilgisi yüklenemedi: ${rpc.error.message}`);

  // Geriye uyumluluk: migration öncesi veritabanı
  let orgId: string | null = null;
  if (byHost) {
    const { data } = await supabase.from('organization_domains').select('organization_id').eq('hostname', key).maybeSingle();
    orgId = data?.organization_id ?? null;
    if (!orgId) return null;
  }
  const orgQuery = supabase.from('organizations').select(ORG_COLUMNS);
  const { data: org, error } = await (orgId ? orgQuery.eq('id', orgId) : orgQuery.eq('slug', key)).maybeSingle();
  if (error) throw new Error(`Site bilgisi yüklenemedi: ${error.message}`);
  return org;
}

/**
 * Varsayılan kiracının slug'ı: DEFAULT_TENANT_SLUG tanımlı değilse veritabanında
 * varsayılan olarak işaretli kiracı (organizations.is_default, en fazla bir tane).
 * Herkese açık anahtarla kiracı listesi okunamadığı için sunucu anahtarıyla, yalnızca
 * slug sütunu okunur; sonuç kiracı önbellek etiketiyle 5 dk saklanır.
 */
async function defaultTenantSlug(): Promise<string | null> {
  const service = createServiceClient({ tags: [cacheTags.tenants], revalidateSeconds: 300 });
  if (!service) return null; // SUPABASE_SERVICE_ROLE_KEY yoksa varsayılan kiracı için DEFAULT_TENANT_SLUG gerekir
  const { data, error } = await service.from('organizations').select('slug').eq('is_default', true).eq('status', 'active').maybeSingle();
  // Geçici veritabanı hatası 404'e dönüşmez (findOrg ile aynı davranış)
  if (error) throw new Error(`Varsayılan site bilgisi yüklenemedi: ${error.message}`);
  return data?.slug ?? null;
}

async function loadTenant(key: string): Promise<Tenant | null> {
  if (!isSupabaseConfigured() || !isValidTenantKey(key)) return null;
  const supabase = createPublicClient([cacheTags.tenants], 300);

  const lookupKey = key === DEFAULT_TENANT_KEY ? await defaultTenantSlug() : key;
  if (!lookupKey) return null;
  const org = await findOrg(supabase, lookupKey);
  if (!org || org.status !== 'active') return null;

  const orgClient = createPublicClient([cacheTags.tenants, cacheTags.org(org.id)], 300);
  const [settingsRpc, domainsRpc, planRes, siteRes] = await Promise.all([
    orgClient.rpc('public_tenant_settings', { p_org: org.id }, { get: true }),
    orgClient.rpc('public_tenant_domains', { p_org: org.id }, { get: true }),
    orgClient.rpc('org_plan', { p_org: org.id }, { get: true }),
    orgClient.rpc('public_site_config', { p_org: org.id }, { get: true }),
  ]);
  // Site yapılandırması yoksa (migration öncesi veya satır yok) varsayılan görünüm
  const siteRow = siteRes.error ? null : (siteRes.data?.[0] ?? null);
  const legacy = missingFunction(settingsRpc.error) || missingFunction(domainsRpc.error);
  const [settingsRes, domainsRes] = legacy
    ? await Promise.all([
        orgClient.from('organization_settings').select('*').eq('organization_id', org.id).maybeSingle(),
        orgClient.from('organization_domains').select('hostname, is_primary').eq('organization_id', org.id),
      ])
    : [{ data: settingsRpc.data?.[0] ?? null }, { data: domainsRpc.data }];

  const settings = settingsRes.data ?? defaultSettings(org.id, org.name);
  const primaryDomain = domainsRes.data?.find((d) => d.is_primary)?.hostname;
  const { siteBaseUrl: baseUrl, panelBaseUrl } = tenantBaseUrls({
    primaryDomain,
    slug: org.slug,
    isDefault: org.is_default,
    siteUrl: publicEnv.siteUrl,
    platformRootDomain: serverEnv.platformRootDomain,
    karayHosts: karayHostsFromEnv(process.env.KARAY_HOSTS),
  });
  const plan = planRes.data?.[0];

  return {
    key,
    id: org.id,
    slug: org.slug,
    name: org.name,
    isDefault: org.is_default,
    referencePrefix: org.reference_prefix,
    settings,
    baseUrl,
    panelBaseUrl,
    features: {
      crm: plan?.crm_enabled ?? false,
      analytics: plan?.analytics_enabled ?? false,
      pdf: plan?.pdf_enabled ?? false,
      customDomain: plan?.custom_domain_enabled ?? false,
    },
    site: {
      published: siteRow?.published ?? {},
      version: siteRow?.published_version ?? 0,
      status: (['active', 'maintenance', 'draft'] as const).find((x) => x === siteRow?.site_status) ?? 'active',
      maintenanceMessage: siteRow?.maintenance_message ?? null,
      overrides: parseFeatureOverrides(siteRow?.feature_overrides),
    },
  };
}

/** Kiracıyı anahtara göre getirir (istek başına tekilleştirilir, 5 dk önbellek). */
export const getTenant = cache(loadTenant);

/** Kiracı yoksa / askıdaysa 404. Kiracı sitesi sayfaları site-config'in requireSiteTenant'ını kullanır (önizleme markası dahil). */
export async function requireTenant(rawKey: string): Promise<Tenant> {
  const tenant = await getTenant(decodeURIComponent(rawKey));
  if (!tenant) notFound();
  return tenant;
}

/** Bulunulan alan adının kiracı anahtarı (proxy'nin hesapladığı değer; istemci başlığı proxy'de silinir) */
export async function getTenantKeyFromRequest(): Promise<string> {
  const h = await headers();
  const key = h.get('x-tenant-key') ?? tenantKeyForHost(h.get('x-forwarded-host') ?? h.get('host'), tenantHostConfig());
  // Varsayılan kiracı anahtarı gerçek slug'a çözülür (oturum bağlamı ofisi adresine göre seçer)
  return key === DEFAULT_TENANT_KEY ? ((await defaultTenantSlug()) ?? key) : key;
}

/** Yeniden yazılmamış rotalar (yönetim paneli, not-found) için Host başlığından kiracı. */
export async function getTenantFromRequest(): Promise<Tenant | null> {
  return getTenant(await getTenantKeyFromRequest());
}

/**
 * E-posta bağlantıları (şifre sıfırlama) için GÜVENİLİR kök adres. İstemcinin değiştirebileceği
 * X-Forwarded-Host'a bakılmaz; Host başlığı da ancak şu durumlarda kullanılır:
 *  - ortamda tanımlı adresler (KARAY_HOSTS, NEXT_PUBLIC_SITE_URL, PLATFORM_ROOT_DOMAIN ve www),
 *  - geliştirme / önizleme adresleri (localhost, IP, *.vercel.app),
 *  - veritabanında AKTİF alan adı veya platform alt alan adı olarak çözülen gerçek bir kiracı.
 * Aksi halde NEXT_PUBLIC_SITE_URL döner. Böylece sahte Host ile "şifre sıfırlama zehirlemesi"
 * (bağlantının saldırganın alan adına üretilmesi) yapılamaz.
 */
export async function trustedRequestOrigin(): Promise<string> {
  const fallback = publicEnv.siteUrl.replace(/\/+$/, '');
  const raw = ((await headers()).get('host') ?? '').trim().toLowerCase();
  const host = normalizeHost(raw);
  if (!host || !/^[a-z0-9.:[\]-]+$/.test(raw)) return fallback;
  if (isDevOrPreviewHost(host)) {
    const local = host === 'localhost' || host.endsWith('.localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
    return `${local ? 'http' : 'https'}://${raw}`;
  }
  if (hostSurface(host, karayHostConfigFromEnv(process.env)) !== 'tenant' || tenantHostConfig().defaultHosts.includes(host)) return `https://${host}`;
  const tenant = await getTenant(tenantKeyForHost(host, tenantHostConfig())).catch(() => null);
  return tenant ? `https://${host}` : fallback;
}

/** Kiracı sitesinde mutlak adres üretir. */
export function tenantUrl(tenant: Pick<Tenant, 'baseUrl'>, path = '/'): string {
  return `${tenant.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
