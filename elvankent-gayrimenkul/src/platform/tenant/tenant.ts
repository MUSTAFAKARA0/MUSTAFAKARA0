import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import { createPublicClient } from '@/lib/supabase/server';
import { isValidTenantKey, tenantKeyForHost } from '@/platform/tenant/host';
import { tenantHostConfig } from '@/platform/tenant/config';
import type { Tables } from '@/types/supabase';
import { parseFeatureOverrides, type FeatureOverrides, type SiteStatus } from '@/platform/site/schema';

export type OrgSettings = Tables<'organization_settings'>;

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
  features: TenantFeatures;
  site: TenantSite;
}

const ORG_COLUMNS = 'id, slug, name, is_default, reference_prefix, status';

function defaultSettings(orgId: string, name: string): OrgSettings {
  return {
    organization_id: orgId,
    display_name: name,
    legal_name: null,
    tagline: null,
    description: null,
    service_area: null,
    logo_url: null,
    logo_mobile_url: null,
    maps_url: null,
    short_name: null,
    favicon_url: null,
    primary_color: '#0e4d45',
    accent_color: '#b5813a',
    phone: null,
    whatsapp: null,
    email: null,
    address_line: null,
    address_district: null,
    address_city: null,
    postal_code: null,
    office_latitude: null,
    office_longitude: null,
    opening_hours: [],
    working_hours_note: null,
    instagram_url: null,
    facebook_url: null,
    x_url: null,
    youtube_url: null,
    linkedin_url: null,
    tiktok_url: null,
    seo_title: null,
    seo_description: null,
    og_image_url: null,
    google_site_verification: null,
    hero_title: null,
    hero_subtitle: null,
    hero_image_url: null,
    default_location_precision: 'approximate',
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  };
}

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

async function loadTenant(key: string): Promise<Tenant | null> {
  if (!isSupabaseConfigured() || !isValidTenantKey(key)) return null;
  const supabase = createPublicClient([cacheTags.tenants], 300);

  const org = await findOrg(supabase, key);
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
  const baseUrl = primaryDomain
    ? `https://${primaryDomain}`
    : org.is_default || !serverEnv.platformRootDomain
      ? publicEnv.siteUrl
      : `https://${org.slug}.${serverEnv.platformRootDomain}`;
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

/** Sayfalar için: kiracı yoksa / askıdaysa 404. */
export async function requireTenant(rawKey: string): Promise<Tenant> {
  const tenant = await getTenant(decodeURIComponent(rawKey));
  if (!tenant) notFound();
  return tenant;
}

/** Bulunulan alan adının kiracı anahtarı (proxy'nin hesapladığı değer; istemci başlığı proxy'de silinir) */
export async function getTenantKeyFromRequest(): Promise<string> {
  const h = await headers();
  return h.get('x-tenant-key') ?? tenantKeyForHost(h.get('x-forwarded-host') ?? h.get('host'), tenantHostConfig());
}

/** Yeniden yazılmamış rotalar (yönetim paneli, not-found) için Host başlığından kiracı. */
export async function getTenantFromRequest(): Promise<Tenant | null> {
  return getTenant(await getTenantKeyFromRequest());
}

/** Kiracı sitesinde mutlak adres üretir. */
export function tenantUrl(tenant: Pick<Tenant, 'baseUrl'>, path = '/'): string {
  return `${tenant.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
