import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { CACHE_TAGS, type CacheTag } from '@/lib/data/cache';

/**
 * Yönetim panelindeki değişikliklerden sonra herkese açık sayfaların
 * önbelleğini anında geçersiz kılar (ziyaretçi bir sonraki istekte günceli görür).
 */
export function revalidatePublic(...tags: CacheTag[]) {
  for (const tag of tags.length ? tags : [CACHE_TAGS.properties]) revalidateTag(tag, { expire: 0 });
  revalidatePath('/admin', 'layout');
}
