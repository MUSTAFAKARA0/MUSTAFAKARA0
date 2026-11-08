# Orijinal boyut koruması runbook'u — `supabase/pending/20261108000001_media_size_guard.sql` (KI-42, E)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır.
CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder.

**Sorun:** yükleme bileti istemcinin bildirdiği boyutla bekleyen satır açar; kota bekleyen/başarısız satırı bu boyutla sayar.
1 bayt bildirip 50 MB yüklemek mümkündü (kurum başına ≈ 2,5 GB kota dışı alan; 02.11 medya denetimi, dış denetim 05.11 F02).

**Ne yapar:** `storage.objects` üzerinde ayrı bir `BEFORE INSERT OR UPDATE` tetikleyicisi (`media_storage_size_guard`). `media-originals`
kovasında, kurum klasöründe, sahibi dolu (kullanıcı oturumu ya da imzalı adres) bir nesne yazılırken **gerçek boyut**
(`metadata.size`, Storage'ın arka uçtan okuduğu değer) bekleyen satırın `byte_size`'ını aşarsa `media_size_mismatch` (42501).
- Storage nesne satırını dosya yazıldıktan sonra tek işlemde ekler; red bu işlemi geri alır, Storage kaydedilmemiş sürümün
  baytlarını siler. Kota dışı dosya kalmaz.
- Yükleme öncesi yetki denemesinde `metadata.size` yoktur; geçer. `contentLength` bilinçli kullanılmaz (tarayıcının çok parçalı
  gövdesi dosyadan büyüktür; dürüst yüklemeyi reddederdi).
- Etkilenmeyenler: bildirilenden küçük ya da eşit dosya, `media` kovası (varyantlar), sahibi boş yazımlar (`service_role`, geri
  yükleme `--apply`), C'nin bakım penceresi, bekleyen satırı olmayan yollar (onları C yönetir).
- Uygulama kodu değişikliği gerekmez: panel her zaman `File.size` bildirir. Reddedilen yükleme panelde yükleme hatası olarak
  görünür; "Tekrar dene" yeni kayıtla baştan yükler.

## Sıra ve ön koşullar

1. `../media_storage_slots/` (C) uygulanmış (E `apply C first` ile durur). Geri dönüşte **E, C'den önce** geri alınır
   (C'nin 05'i E varken `DUR: önce E geri alınır` ile durur).
2. 01'de `DUR` yok; 02 saklandı; taze tam yedek alındı; yazılı sahip onayı.
3. **Düşük trafikte çalıştırın:** CREATE/DROP TRIGGER `storage.objects` üzerinde kısa bir kilit alır; bu sürede yüklemeler
   bekler (okumalar etkilenmez). `lock_timeout` 3 sn: kilit alınamazsa hiçbir şey değişmez, sakin anda yeniden deneyin.
   01'in 10. satırı (uzun işlem) yalnız `pg_read_all_stats` yetkili rolde güvenilirdir; SQL Editor'ün `postgres` rolü yeterlidir.

Tetikleyici `WHEN (media-originals, sahibi dolu)` koşuluyla yalnız ilgili yazımlarda çalışır; diğer kovalarda ek maliyet yoktur.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur — kapı | `DUR` yok; 7. satır `TAMAM (henüz yok)` |
| 2 | `02_save_state.sql` | Okur | Çıktı saklanır |
| 3 | `03_apply.sql` | Tek işlemde uygular | `media_storage_size_guard tetikleyici sayısı = 1` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnız geri dönüşte | Sonra 01: 7. satır 0, 8. satır uygulama öncesiyle aynı |

## Kapsanan yollar ve bilinen sınır (güvenlik incelemesi 08.11)

- Standart imzalı yükleme (panelin FormData PUT'u), oturumla doğrudan yükleme ve **TUS** (eşik üstü): hepsi storage-api'nin
  `completeUpload`'ından geçer; nesne satırı arka uçtan okunan gerçek boyut ve yükleyenin kimliğiyle yazılır → E denetler
  (SZ-01…SZ-08). **Kopyalama** (`/object/copy`): storage-api hedefi kaynağın metadata'sıyla (boyut dahil) ve çağıranın kimliğiyle
  baytlar kopyalanmadan önce denetler → E reddeder (v1.82.1 kaynağından doğrulandı).
- **Bilinen sınır:** reddedilen yüklemenin arka uca yazılmış baytlarını storage-api kendi silme kuyruğuyla (`ObjectAdminDelete`)
  siler; bu, her başarısız yüklemede (yetki reddi dahil) zaten kullanılan mekanizmadır ve E ile yeni değildir. Kuyruk çalışmazsa
  baytlar satırsız kalır; satırsız nesneler kotada görünmez ve D süpürmesi (`storage.objects` üzerinden listeler) onları göremez.
  Supabase barındırmalı projede kuyruk açıktır. İzleme önerisi (ayrı iş): Storage kullanımı ile `storage.objects` toplamının
  aylık karşılaştırması. Kurum başına imza hız sınırı ayrı iş olarak değerlendirilir (bekleyen satır sınırı 50 zaten var).

## Canlıya geçiş planı (sahip onayı bekliyor — UYGULANMADI)

| Konu | Durum ve kanıt |
|---|---|
| Bağımlılık | Yalnız C (`20261027000003_media_storage_slots`). C canlıda: o5c #2 "SONUÇ: TAMAM" (02.11, K-57). Uygulama kodu değişikliği **gerekmez** (production `d6113e6` panel her zaman `File.size` bildirir; SZ-07/SZ-08 panelin iki yolunu taklit eder) |
| Sıra | Tek adım: bu runbook (E). Başka bekleyen migration yok; canlı 39 nesne grubu + E = 40. satır `canli_sema_tespiti.sql`'de |
| Mevcut müşteri verisine etkisi | **Yok.** Satır/dosya değiştirilmez, mevcut nesneler denetlenmez; yalnız uygulamadan **sonraki** orijinal yazımları etkiler. 01'in 9. satırı bildirilenden büyük orijinali olan bekleyen satırları yalnız sayar (bilgi) |
| Kesinti | CREATE TRIGGER `storage.objects` üzerinde birkaç ms'lik kilit; `lock_timeout` 3 sn; yüklemeler kısa süre bekleyebilir, okumalar/site etkilenmez. Düşük trafikte |
| Geri alma | `05_rollback.sql` (tek işlem; yalnız tetikleyici + fonksiyon silinir; veri yok). Sonra 01: 7. satır 0. Uygulama kodu geri alınmaz (gerekmez). Ayrıca Vercel geri dönüşü gerekmez |
| Kanıt (kod) | CI #210: SZ-01…SZ-08 gerçek Storage'a karşı yeşil (FormData ve TUS dahil); CI #211 üç iş (sonuç KALAN_ISLER KI-42'de); yerel prova 01→05→01→03→04 yeşil; database-reviewer ve security-reviewer: engelleyici/kritik yok |

**Uygulama sırası (sahip, yazılı onaydan sonra):**
1. Taze yedek: Actions › `elvankent-backup` › Run workflow › **production dalı** (KI-41 Aşama 1'den beri yedek ortamı yalnız bu dalda) ›
   yeşil bitene kadar bekleyin.
2. Supabase › SQL Editor: `01_preflight.sql` → `DUR` yok; çıktıyı saklayın. `02_save_state.sql` → saklayın.
3. `03_apply.sql` (dosyanın tamamı, tek Run) → son satır `media_storage_size_guard tetikleyici sayısı = 1`.
4. `04_postflight.sql` → 1–6. satırlar `TAMAM`.
5. Kabul testi (aşağıda). Sorun olursa `05_rollback.sql` ve sonra 01.

**Uygulama sonrası kabul testleri:**
- (a) Panelde bir ilana 6 MB altı bir fotoğraf yükleyin → "hazır" olur, sitede görünür (standart yol).
- (b) 6 MB üstü bir fotoğraf (telefon kamerası) yükleyin → hazır olur (TUS yolu).
- (c) Bir fotoğrafı döndürün ve silin → çalışır (KI-36/KI-45 yolları etkilenmez).
- (d) `04_postflight.sql` yeniden: hepsi `TAMAM`; `canli_sema_tespiti.sql` 40. satır `VAR`.
- (e) 24 saat sonra Supabase › Logs › Postgres'te `media_size_mismatch` araması: kayıt olmamalı. Varsa ve bir ofis "Yükleme izni
  doğrulanamadı" bildirdiyse dürüst bir yol reddediliyor demektir → 05 (hata tarayıcı ile Storage arasında oluşur; Sentry'ye düşmez).
Kötüye kullanım (sahte boyut) canlıda denenmez; CI testleri bunu kanıtlar.

## Canlı deneme (uygulamadan sonra, sahip)

Panelde bir ilana normal bir fotoğraf yükleyin: yükleme ve işleme her zamanki gibi tamamlanmalı (dürüst yol). Kötüye kullanım
yolu yalnız yerelde/CI'da sınanır (`tests/security/media-size-guard.test.mjs`); canlıda sahte boyutla yükleme denenmez.

Testler: `tests/security/media-size-guard.test.mjs` (SZ-01…SZ-06, gerçek Storage), LR-14.
