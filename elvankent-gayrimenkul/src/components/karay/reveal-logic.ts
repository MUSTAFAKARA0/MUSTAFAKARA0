/** Saf yardımcılar (node testleriyle doğrulanır; DOM bilmez) */

/** Öğe ilk çizimde ekranın tamamen altındaysa (ve hareket serbestse) giriş animasyonu için "bekliyor" işaretlenir */
export function shouldPend(rect: { top: number }, viewportHeight: number, reduced: boolean): boolean {
  if (reduced) return false;
  return rect.top > viewportHeight;
}

/** Güvenlik zamanlayıcısı: gözlemci tetiklememiş ama şu an ekranda olan öğe gösterilmelidir */
export function shouldForceReveal(rect: { top: number; bottom: number }, viewportHeight: number): boolean {
  return rect.top < viewportHeight && rect.bottom > 0;
}

/** -1..1 aralığına sıkıştırılmış, imleç konumundan türeyen normalleştirilmiş değer */
export function normalizePointer(offset: number, size: number): number {
  if (size <= 0) return 0;
  return Math.max(-1, Math.min(1, (offset / size) * 2 - 1));
}

/** Doğrusal ara değer (lerp) ve duruş eşiği: hedefe yeterince yaklaşınca döngü durur (boşta rAF yok) */
export function lerp(current: number, target: number, k: number): number {
  return current + (target - current) * k;
}
export const SETTLE_EPSILON = 0.002;
