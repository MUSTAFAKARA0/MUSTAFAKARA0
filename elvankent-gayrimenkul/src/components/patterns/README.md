# Design Pattern Library (D7)

KARAY tasarım ailelerinin yapı taşları. Bir **aile** (Site Factory › `catalog/<aile>/`) hangi
desenleri kullanacağını manifestte seçer; **Site Engine** yalnızca seçilen desenleri çizer.

```
patterns/
├── contracts.ts        bileşen sözleşmeleri (yalnızca tipler) + PatternMeta
├── registry.ts         desen kaydı (yalnızca VERİ — bileşen içe aktarmaz)
├── surfaces.ts         D7.2 aile sözleşmesi: yüzey → desen türü, manifest alanı, planlanmış desenler (VERİ)
├── resolver.ts         D7.2 çözümleyici: manifest → yüzey → desen (yalnızca sunucu, veri sorgusu yok)
├── styles.ts           seçili desenlerin CSS'i (yalnızca seçen siteye yazılır)
├── hero/  header/  listing-card/  footer/  section/  navigation/
├── gallery/  search/  listing/  property-detail/  map/   (her biri surface.tsx: yüzey çizicisi)
├── gallery/islands.tsx galeri varyantlarının istemci yükleyicisi
└── interaction/        tarayıcı adaları + istemci yükleyicisi (islands.tsx)
```

## Kurallar

1. **Veri ≠ tasarım.** Desen veriyi yalnızca prop olarak alır (`contracts.ts`). İlan sorgusu,
   CRM, arama mantığı veya SEO desenin içinde olmaz. Aynı ilan verisi her desende aynıdır.
2. **Kiracıdan bağımsız.** Kiracı kimliği, alan adı veya müşteriye özel koşul yok.
3. **Görsel desen = sunucu bileşeni.** Seçilmeyen sunucu deseninin kodu tarayıcıya gitmez.
4. **İnteraktif desen = istemci yükleyicisinden tembel yükleme.** Harita, tam ekran galeri,
   filtre alt paneli gibi tarayıcı kodu taşıyan desenler yalnızca bir istemci yükleyicisinin
   (`interaction/islands.tsx` örneği) içinden `React.lazy` (veya `next/dynamic`) ile yüklenir. D7.0 ölçümü: sunucu
   bileşeninde statik import da, `next/dynamic` da seçilmeyen kodu tarayıcıya taşıyordu.
5. **Desen CSS'i desene aittir** ve yalnızca deseni seçen sitenin sayfasına yazılır.
6. **Mevcut bileşenler kilitlidir.** `components/{home,layout,property,gallery,search}` altındaki
   bileşenler "standart"/eski varyantlardır; değiştirilmez. Yeni varyant = bu klasörde yeni dosya.
7. **Gereksiz soyutlama yok.** Bir desen yalnızca bir ailede kullanılıyorsa da kendi dosyasıdır,
   ama "her şeyi yapan" genel bileşen yazılmaz.

## Adlandırma

- Dosya: `patterns/<tür>/<kimlik>.tsx`, kimlik **kebab-case** ve **yapıyı anlatır**, aile adını
  değil: `hero/immersive-frame.tsx`, `listing-card/luxury-frame.tsx`, `search/split-map.tsx`.
  Böylece bir desen birden fazla ailede kullanılabilir.
- Dışa aktarım: sunucu deseni `export function <Kimlik><Tür>(props: <Tür>PatternProps)`;
  interaktif ada `export default function <Kimlik>Island()`.
- Manifest kimliği = dosya kimliği; kapalı liste `theme-engine/ids.ts` içindedir.
- İnteraktif desenin işareti: `karay-pattern:<tür>/<kimlik>` (bundle regresyon testi).

## Yeni desen eklemek

1. `theme-engine/ids.ts` kapalı listesine kimliği ekle (mevcut değerler silinmez/değişmez).
2. `patterns/<tür>/<kimlik>.tsx` oluştur (sözleşme: `contracts.ts`).
3. `registry.ts`'e kaydını ekle (interaktifse `marker` ile).
4. CSS gerekiyorsa desen klasöründeki `styles.ts`'e ekle.
5. İnteraktifse yalnızca o türün istemci yükleyicisine tembel girdi ekle (yükleyici yoksa
   `<tür>/islands.tsx` oluştur ve `tests/unit/patterns.test.mjs › LOADERS`'a ekle).
5b. Yüzey deseniyse `<tür>/surface.tsx`'e dal ekle; kimliği `surfaces.ts › planned` listesinden çıkar.
6. `npm run test:unit` (kayıt ↔ manifest ↔ dosya sözleşmesi) ve bundle regresyon E2E testi.
