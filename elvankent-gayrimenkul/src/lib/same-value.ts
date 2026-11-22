/**
 * Form "kaydedilmemiş değişiklik" denetimi için anahtar sırasından bağımsız karşılaştırma.
 *
 * Neden: JSON.stringify anahtar sırasına duyarlıdır. Site yapılandırması veritabanında jsonb olarak tutulur ve sunucuda
 * şemayla yeniden çözülür; kullanıcı formda daha önce olmayan bir alanı (ör. ailenin varsayılanından gelen header.style)
 * seçince alan nesnenin SONUNA eklenir, kayıttan sonra sunucudan gelen değerde ise şemadaki yerindedir. İçerik aynı
 * olduğu hâlde form kalıcı olarak "kaydedilmemiş" görünüyor ve "Değişiklikleri yayınla" gereksiz onay soruyordu
 * (CI #224 sonrası PO-7). JSON ile aynı kurallar: undefined alanlar yok sayılır, dizilerde sıra önemlidir.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, (v as Record<string, unknown>)[k]]));
    }
    return v;
  });
}

/** İki form değeri içerik olarak aynı mı (nesne anahtar sırası önemsiz, dizi sırası önemli) */
export function sameValue(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}
