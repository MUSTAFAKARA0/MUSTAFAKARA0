# Türkiye konum verisi (il / ilçe / mahalle)

## Mevcut durum

- Model: `cities` → `districts` → `neighborhoods` (ad üst öğeye göre benzersiz; slug'lar URL'lerde kullanılır). Türkiye geneli veri için model değişikliği gerekmez.
- Stage 3 eklemeleri:
  - Resmî kod alanları (`cities.code` = plaka kodu, `districts.code`, `neighborhoods.code`; migration `20260928000003`).
  - Ölçek düzeltmesi: API istek başına en fazla 1000 satır döndürdüğünden referans veriler 1000'erlik sayfalarla okunur. Panel, mahalleleri seçilen ilçeye göre sunucudan ister; ~50 bin mahallenin tamamı tarayıcıya gönderilmez.
- Yüklü veri: Ankara'nın bir bölümü (1 il, 5 ilçe, 15 mahalle). **Başka veri uydurulmadı.**

## Veri kaynağı (siz seçip indirmelisiniz)

Güncel ve resmî bir kaynak kullanın, lisans/kullanım koşullarını kontrol edin:

1. **PTT Posta Kodu listesi** (postakodu.ptt.gov.tr): il, ilçe, semt/bucak/belde, mahalle, posta kodu; Excel olarak indirilebilir. Pratik ve yaygın kaynaktır.
2. **İçişleri Bakanlığı / TÜİK — UAVT (Ulusal Adres Veri Tabanı) çıktıları**: resmî kodlarıyla mahalle listesi (kurumsal başvuru gerekebilir).

Kaynağı belirsiz GitHub listeleri kullanmayın (eksik/eski olabilir; birleşen/ayrılan mahalleler).

## CSV biçimi

UTF-8, başlık satırı zorunlu, ayraç `;` veya `,`:

```
il;ilce;mahalle;il_kodu;ilce_kodu;mahalle_kodu;enlem;boylam
Ankara;Etimesgut;Elvankent;06;;;39.9472;32.6231
```

- Zorunlu: `il`, `ilce`, `mahalle`. Diğer sütunlar isteğe bağlı.
- BÜYÜK HARF adlar düzeltilir ("ANKARA" → "Ankara"), sondaki "Mah." / "Mahallesi" atılır.
- Türkiye dışı koordinatlı satırlar reddedilir.
- PTT Excel'i: dosyayı CSV (UTF-8) olarak kaydedin; sütun adlarını yukarıdaki gibi yeniden adlandırın (semt/bucak sütununu çıkarın).

## İçe aktarma

```bash
npm run import:locations -- --file=konumlar.csv            # KURU ÇALIŞTIRMA: il/ilçe/mahalle sayıları ve hatalı satırlar
npm run import:locations -- --file=konumlar.csv --apply    # veritabanına yazar
```

- Tekrar çalıştırılabilir: aynı adlar güncellenir, yinelenmez; mevcut ilanların bağlantıları bozulmaz (yerelde doğrulandı).
- Önce **demo projesinde** deneyin; sonra canlıda (öncesinde yedek).
- Sitedeki listeler en geç 1 saat içinde güncellenir (referans veri önbelleği).
- Mahalle merkez koordinatları kaynakta yoksa haritada ilçe/il merkezi kullanılır.
