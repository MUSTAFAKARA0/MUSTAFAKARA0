/**
 * Tek satırlık metin alanları (ad, unvan, slogan) için sunucu tarafı normalleştirme.
 *
 * Kontrol karakterleri (NUL dahil C0/C1, DEL) ve satır/paragraf ayırıcıları boşluğa çevrilir,
 * ardışık boşluklar teke indirilir ve uçlar kırpılır. Tarayıcıdaki tek satırlık alan satır sonu
 * göndermez, ama istek elle de oluşturulabilir; böyle bir değer sitede, JSON-LD'de ve operasyon
 * betiklerinin ürettiği SQL yorumlarında satır kırmamalıdır.
 */
const CONTROL_OR_SEPARATOR = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;

export function singleLine(value: string): string {
  return value.replace(CONTROL_OR_SEPARATOR, ' ').replace(/\s+/g, ' ').trim();
}
