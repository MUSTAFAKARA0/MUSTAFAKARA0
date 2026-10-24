/**
 * Tek satırlık metin alanları (ad, unvan, slogan) için sunucu tarafı normalleştirme.
 *
 * Kontrol karakterleri (NUL dahil C0/C1, DEL) ve satır/paragraf ayırıcıları boşluğa çevrilir,
 * ardışık boşluklar teke indirilir ve uçlar kırpılır. Tarayıcıdaki tek satırlık alan satır sonu
 * göndermez, ama istek elle de oluşturulabilir; böyle bir değer sitede, JSON-LD'de ve operasyon
 * betiklerinin ürettiği SQL yorumlarında satır kırmamalıdır.
 *
 * Görünmez Unicode biçim karakterleri üç gruba ayrılır:
 *  - Görünür karşılığı olmayanlar (sıfır genişlikli boşluk, kelime birleştirici, görünmez
 *    matematik işleçleri, BOM) kopyala-yapıştırla gelir ve silinir.
 *  - Yön geçersiz kılma, gömme ve yalıtma karakterleri metni göründüğünden farklı sırada
 *    gösterebilir; sessizce silinmez, şemalar `hasBidiControl` ile açık hata verir.
 *  - Yazı sistemlerinin ihtiyaç duyduğu ZWJ/ZWNJ (emoji, Farsça, Hint yazıları) ve kapsam
 *    açmayan yön işaretleri (LRM, RLM, ALM) korunur.
 */
const CONTROL_OR_SEPARATOR = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const INVISIBLE = /[\u200B\u2060-\u2064\uFEFF]/g;
const BIDI_CONTROL = /[\u202A-\u202E\u2066-\u2069]/;

export const BIDI_CONTROL_MESSAGE = 'görünmez yön denetim karakteri içeriyor; metni yeniden yazın.';

export function singleLine(value: string): string {
  return value.replace(CONTROL_OR_SEPARATOR, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

export function hasBidiControl(value: string): boolean {
  return BIDI_CONTROL.test(value);
}
