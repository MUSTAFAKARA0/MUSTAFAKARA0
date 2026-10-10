import 'server-only';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import { headers } from 'next/headers';
import { DEFAULT_TENANT_KEY, defaultHostsFromSiteUrl, hostSurface, karayHostConfigFromEnv, type HostSurface, type TenantHostConfig } from '@/platform/tenant/host';

export function tenantHostConfig(): TenantHostConfig {
  return {
    defaultSlug: serverEnv.defaultTenantSlug || DEFAULT_TENANT_KEY,
    platformRootDomain: serverEnv.platformRootDomain || undefined,
    defaultHosts: defaultHostsFromSiteUrl(publicEnv.siteUrl),
  };
}

/**
 * Bu isteğin alan adı yüzeyi (karay | shared | tenant). Proxy ile AYNI fonksiyon ve
 * yapılandırmayla, istemcinin değiştiremeyeceği Host başlığından hesaplanır (başlık
 * aktarımına güvenilmez; proxy'nin atlandığı bir yol olsa bile sonuç aynıdır).
 * Host yoksa kiracı sayılır (kapalı varsayılan).
 */
export async function requestHostSurface(): Promise<HostSurface> {
  return hostSurface((await headers()).get('host'), karayHostConfigFromEnv(process.env));
}
