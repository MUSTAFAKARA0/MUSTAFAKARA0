# Yetki belgesi numarası runbook'u — `supabase/pending/20261108000003_license_no.sql` (P0-8, G)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır.
CI `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder.

**Ne yapar:** `organization_settings`'e isteğe bağlı `license_no` sütunu (biçim: büyük harf/rakam/tire, 3–20). Ofis paneli › Marka ve
görünüm › **Yasal bilgiler** kartından kaydedilir (taslak/yayın akışına girmez, hemen sitede görünür); ofis sitesinin alt bilgisinde
"Yetki belgesi no: …" olarak her sayfada (ilan sayfaları dahil) gösterilir. Boşken site değişmez.
Hangi kanalda gösterilmesinin zorunlu olduğu ve EİDS kapsamı **avukat görüşüne** bağlıdır (D-20); bu migration yalnız alanı sağlar.

| Konu | Durum |
|---|---|
| Bağımlılık | Yok |
| Kod sırası | Serbest: eski kod sütunu okumaz/yazmaz; yeni kod sütun yoksa kartı göstermez |
| Mevcut veri | Değişmez (tüm satırlarda NULL) |
| Kesinti | ADD COLUMN kısa kilit; NULL varsayılan tabloyu yeniden yazmaz; `lock_timeout` 3 sn |
| Geri alma | `05_rollback.sql` — girilmiş numaralar silinir; önce 02 saklanır |

**Sıra:** taze yedek (production dalı) → 01 → 02 → 03 → 04 (hepsi TAMAM) → yeni kod yayınlandıysa kabul testi:
panelde numara girin → kendi sitenizin alt bilgisinde görünür; boşaltın → kaybolur.
