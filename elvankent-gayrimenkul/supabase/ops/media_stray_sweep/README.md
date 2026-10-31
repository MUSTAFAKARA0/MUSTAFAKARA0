# Başıboş medya dosyaları runbook'u (O-5) — `supabase/pending/20261031000001_media_stray_sweep.sql` (WP-A2 · D, KI-38)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder.

**Ne yapar:** `media_stray_objects(p_limit)` fonksiyonunu ekler (yalnız `service_role`). Fonksiyon yalnız **listeler**:
- `media` kovasında, kurum klasöründe kanonik adlı varyant; satırı yok ya da satırın **güncel** tabanında değil; **1 saatten eski**
  (süren işleme ve döndürme korunur). C'nin sınırladığı sayılmayan ek tabanlar böylece temizlenir (K-23 güvenlik MEDIUM).
- `media-originals` kovasında, kurum klasöründe kanonik adlı orijinal; o kimlikte satır yok; **24 saatten eski**.
- Kanonik olmayan adlar, demo görselleri ve diğer kovalar (marka vb.) listelenmez: bilinmeyen dosya silinmez.

**Silmeyi** yeni uygulama kodunun günlük cron'u (`/api/cron/media-cleanup`, `sweepStray`) yapar; yalnız
`organizations/<org_id>/` ile başlayan ve `..` içermeyen yolları siler. Kod D'yi bulamazsa (eski şema) bu adımı atlar.

## Sıra ve ön koşullar

1. `../media_finalize_rpc/` (A) uygulanmış (D kendisi `apply A first` ile durur). B ve C'den bağımsızdır; C ile birlikte anlamlıdır.
2. Yeni kod production'da (cron süpürmesi yeni kodla gelir; D önce uygulanırsa zararsız, yalnız fonksiyon durur).
3. 01'de `DUR` yok; 02 saklandı; tam yedek alındı; yazılı O-5 onayı (K-19 §8 birim 4g).

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur — kapı | `DUR` yok; 4. satır `TAMAM` |
| 2 | `02_save_state.sql` | Okur | Çıktı saklanır |
| 3 | `03_apply.sql` | Tek işlemde uygular | `media_stray_objects var = true` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnız geri dönüşte | Sonra 01: 5. satır `false` (uygulama öncesiyle aynı) |

**İlk çalıştırmadan önce (önerilir):** service_role ile `select count(*), bucket from public.media_stray_objects(1000) group by bucket;`
(SQL Editor'de çalışmaz: fonksiyon yalnız service_role'e açık; sayı istenirse geliştiriciden). İlk cron çalışması birikmiş başıboş dosyaları siler;
silinen dosyalar gece yedeğinin `storage/deleted/TARİH/` klasöründe 90 gün kalır (BACKUP_RESTORE.md).

Testler: `tests/security/media-stray-sweep.test.mjs` (SW-01…SW-05), LR-14.
