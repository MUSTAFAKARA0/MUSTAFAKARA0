/**
 * KI-45: bir medya klasöründe kalmış ESKİ varyant tabanlarının (…/{medya}/{rev}/) seçimi.
 *
 * Depolama koruması (C, `media_variant_slot_org`) satır başına güncel taban ve hedef dışında en çok BİR taban daha
 * kabul eder. Önceki sürümün silinmesi ya da başarısız işlemenin temizliği en iyi çabayla yapılır; ikisi de kaçarsa
 * iki eski taban birikir ve fotoğraf, günlük süpürme (D) çalışana kadar (en çok 1 gün) döndürülemez/yeniden
 * işlenemez. İşlemeden önce bu klasördeki eski tabanlar temizlenir.
 *
 * Güvenlik payı: yalnız güncel taban DIŞINDAKİ ve en yeni dosyası `minAgeMs`'ten eski olan tabanlar seçilir. Aynı
 * fotoğrafta eşzamanlı yürüyen bir işlemenin (çift tıklama) henüz sonlandırılmamış yeni tabanı birkaç saniyelik
 * olduğu için silinmez.
 *
 * Bu dosya saftır (sunucuya özgü bağımlılık yok) → birim testlerinde doğrudan içe aktarılır.
 */

/** Taban adı biçimi: newPublicBase'in ürettiği 8 karakterlik sürüm (+ isteğe bağlı döndürme eki) */
const BASE_NAME = /^[A-Za-z0-9_]{8}(?:-r(?:90|180|270))?$/;
/** Varyant dosya adı biçimi */
const VARIANT_NAME = /^w[0-9]{1,4}\.webp$/;

export const STRAY_BASE_MIN_AGE_MS = 15 * 60 * 1000;

export interface StorageEntry {
  name: string;
  /** Klasör girdilerinde null */
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Klasör girdilerinden aday taban adları: güncel taban dışındaki, biçime uyan alt klasörler */
export function candidateBases(entries: StorageEntry[], currentBase: string | null): string[] {
  const current = currentBase ? currentBase.slice(currentBase.lastIndexOf('/') + 1) : null;
  return entries
    .filter((e) => e.id === null && BASE_NAME.test(e.name) && e.name !== current)
    .map((e) => e.name)
    .sort();
}

/**
 * Bir tabanın dosyaları silinebilir mi: tüm dosyalar varyant biçiminde, en az bir dosya var ve en yenisi `minAgeMs`'ten
 * eski. Zaman bilgisi okunamayan dosya "yeni" sayılır (silinmez).
 */
export function isStaleBase(files: StorageEntry[], now: number, minAgeMs = STRAY_BASE_MIN_AGE_MS): boolean {
  const variants = files.filter((f) => f.id !== null);
  if (variants.length === 0) return false;
  if (variants.some((f) => !VARIANT_NAME.test(f.name))) return false;
  return variants.every((f) => {
    const t = Date.parse(f.updated_at ?? f.created_at ?? '');
    return Number.isFinite(t) && now - t >= minAgeMs;
  });
}

/** Supabase Storage kovasının bu modülün kullandığı kısmı (uygulama ve testler aynı döngüyü çalıştırır) */
export interface PrunableBucket {
  list(path: string, options?: { limit?: number }): Promise<{ data: StorageEntry[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ data: unknown; error: unknown }>;
}

/**
 * Klasördeki eski tabanları siler; silinen taban adlarını döndürür. Güvenlik koşulları:
 *   - `currentBase` doluysa bu klasörün içinde olmalı (`{folder}/{taban}`); değilse hiçbir şey silinmez (beklenmeyen biçim)
 *   - hazır (`ready`) satırın güncel tabanı yoksa hiçbir şey silinmez (hangi tabanın canlı olduğu bilinmiyor)
 *   - yalnız candidateBases + isStaleBase'ten geçen tabanlar
 */
export async function pruneStaleBasesIn(
  bucket: PrunableBucket,
  folder: string,
  currentBase: string | null,
  opts: { ready: boolean; now: number; onError?: (base: string) => void },
): Promise<string[]> {
  if (currentBase !== null && !(currentBase.startsWith(`${folder}/`) && BASE_NAME.test(currentBase.slice(folder.length + 1)))) return [];
  if (opts.ready && currentBase === null) return [];
  const { data: entries, error } = await bucket.list(folder, { limit: 100 });
  if (error || !entries) return [];
  const removed: string[] = [];
  for (const base of candidateBases(entries, currentBase)) {
    const { data: files, error: filesError } = await bucket.list(`${folder}/${base}`, { limit: 100 });
    if (filesError || !files || !isStaleBase(files, opts.now)) continue;
    const { error: removeError } = await bucket.remove(files.filter((f) => f.id !== null).map((f) => `${folder}/${base}/${f.name}`));
    if (removeError) opts.onError?.(base);
    else removed.push(base);
  }
  return removed;
}
