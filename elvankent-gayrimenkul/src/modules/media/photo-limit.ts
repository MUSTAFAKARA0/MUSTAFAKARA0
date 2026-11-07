import type { DB } from '@/lib/supabase/server';

/**
 * KI-45: ilan başına fotoğraf sınırının sonlandırmada (finalize) yeniden denetlenmesi.
 *
 * `createMediaUpload` `replaceId` ile çağrıldığında sınır denetimini atlar (değiştirme sayıyı artırmaz).
 * Değiştirme niyetini yüklemeye bağlayacak bir sütun yok (yeni göç yok), bu yüzden sunucu sonlandırmada
 * değiştirmenin GERÇEKTEN olup olmadığına bakar: olmuyorsa (replaceId yok / geçersiz / eski kayıt başka
 * bir istekle zaten silinmiş) sınır burada yeniden denetlenir ve aşılıyorsa yükleme atılır.
 *
 * Bilinen sınırlama: sayım ile ekleme/sonlandırma arasında kilit yok. Aynı ilana eşzamanlı sonlandırmalar
 * birbirini göremeyip sınırı birkaç fotoğraf aşabilir. Atomik denetim veritabanında (ilan satırında kilit ya
 * da tetikleyici) yapılmalıdır; bu bir göç gerektirir (KI-45 notu).
 *
 * Bu dosya saftır (sunucuya özgü bağımlılık yok) → birim testlerinde doğrudan içe aktarılır.
 */

export interface LimitMediaRef {
  id: string;
  organization_id: string;
  property_id: string | null;
}

/** Değiştirme yalnız aynı kurumun aynı ilanındaki BAŞKA bir kayıt için geçerlidir */
export function isValidReplaceTarget(media: LimitMediaRef, target: LimitMediaRef | null | undefined): target is LimitMediaRef {
  if (!target || !media.property_id) return false;
  return target.id !== media.id && target.organization_id === media.organization_id && target.property_id === media.property_id;
}

/**
 * Sonlandırılan kayıt dışında ilanda `ready` kaç fotoğraf var. Bekleyen (pending) kayıtlar sayılmaz:
 * oluşturma denetimi onları zaten sayar; burada saymak meşru eşzamanlı yüklemeleri haksız yere reddederdi.
 */
export async function countOtherReadyPhotos(
  db: Pick<DB, 'from'>,
  propertyId: string,
  excludeId: string,
): Promise<{ count: number; error: { code?: string; message: string } | null }> {
  const { count, error } = await db
    .from('media_assets')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('status', 'ready')
    .neq('id', excludeId);
  return { count: count ?? 0, error: error ?? null };
}

/** Bu kayıt da hazır olursa sınır aşılır mı */
export function photoLimitReached(otherReady: number, max: number): boolean {
  return otherReady >= max;
}
