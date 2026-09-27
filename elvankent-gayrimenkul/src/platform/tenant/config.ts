import 'server-only';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import { defaultHostsFromSiteUrl, type TenantHostConfig } from '@/platform/tenant/host';

export function tenantHostConfig(): TenantHostConfig {
  return {
    defaultSlug: serverEnv.defaultTenantSlug,
    platformRootDomain: serverEnv.platformRootDomain || undefined,
    defaultHosts: defaultHostsFromSiteUrl(publicEnv.siteUrl),
  };
}
