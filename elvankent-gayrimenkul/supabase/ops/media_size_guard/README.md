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

## Canlı deneme (uygulamadan sonra, sahip)

Panelde bir ilana normal bir fotoğraf yükleyin: yükleme ve işleme her zamanki gibi tamamlanmalı (dürüst yol). Kötüye kullanım
yolu yalnız yerelde/CI'da sınanır (`tests/security/media-size-guard.test.mjs`); canlıda sahte boyutla yükleme denenmez.

Testler: `tests/security/media-size-guard.test.mjs` (SZ-01…SZ-06, gerçek Storage), LR-14.
