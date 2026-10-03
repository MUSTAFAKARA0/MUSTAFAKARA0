import 'server-only';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import { headers } from 'next/headers';
import { DEFAULT_TENANT_KEY, defaultHostsFromSiteUrl, type HostSurface, type TenantHostConfig } from '@/platform/tenant/host';
import { SURFACE_HEADER } from '@/platform/tenant/surface-header';

export function tenantHostConfig(): TenantHostConfig {
  return {
    defaultSlug: serverEnv.defaultTenantSlug || DEFAULT_TENANT_KEY,
    platformRootDomain: serverEnv.platformRootDomain || undefined,
    defaultHosts: defaultHostsFromSiteUrl(publicEnv.siteUrl),
  };
}

/**
 * Bu isteğin alan adı yüzeyi (karay | shared | tenant). Değer proxy'de Host'tan
 * hesaplanıp güvenilir başlıkla iletilir; başlık yoksa veya geçersizse kiracı sayılır
 * (kapalı varsayılan: KARAY yüzeyi açılmaz).
 */
export async function requestHostSurface(): Promise<HostSurface> {
  const value = (await headers()).get(SURFACE_HEADER);
  return value === 'karay' || value === 'shared' ? value : 'tenant';
}
