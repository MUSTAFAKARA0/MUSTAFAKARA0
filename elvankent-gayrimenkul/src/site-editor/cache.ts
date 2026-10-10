import 'server-only';
import { updateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';

/** Yayın / geri alma sonrası kiracı sitesinin önbelleği yenilenir (yalnızca sunucu işleminden çağrılır) */
export function refreshPublicSite(orgId: string) {
  updateTag(cacheTags.tenants);
  updateTag(cacheTags.org(orgId));
}
