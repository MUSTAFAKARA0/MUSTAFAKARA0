# Başıboş medya dosyaları runbook'u (O-5) — `supabase/pending/20261031000001_media_stray_sweep.sql` (WP-A2 · D, KI-38, KI-39)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder.

**Ne yapar:** imleç tablosu `media_stray_cursor` (kova başına 1 satır; RLS açık; `service_role` yalnız okur) ve
`media_stray_objects(p_limit, p_scan)` fonksiyonunu ekler (yalnız `service_role`). Fonksiyon dosya silmez, yalnız **listeler**:
- `media` kovasında, kurum klasöründe kanonik adlı varyant; satırı yok ya da satırın **güncel** tabanında değil; **1 saatten eski**
  (süren işleme ve döndürme korunur). C'nin sınırladığı sayılmayan ek tabanlar böylece temizlenir (K-23 güvenlik MEDIUM).
- `media-originals` kovasında, kurum klasöründe kanonik adlı orijinal; o kimlikte satır yok; **24 saatten eski**.
- Kanonik olmayan adlar, demo görselleri ve diğer kovalar (marka vb.) listelenmez: bilinmeyen dosya silinmez.

**Silmeyi** yeni uygulama kodunun günlük cron'u (`/api/cron/media-cleanup`, `src/modules/media/stray-sweep.ts`) yapar; yalnız
`organizations/<org_id>/` ile başlayan ve `..` içermeyen yolları siler. Kod D'yi bulamazsa (eski şema) bu adımı atlar.

## Sayfalama ve izleme (KI-39)

- Her çağrı her kovada imleçten (`last_name`) sonraki en çok `p_scan` nesneye (varsayılan 2000, en çok 10000) ad sırasıyla
  bakar ve imleci ilerletir; çağrı süresi kova boyutundan bağımsızdır (yerel ölçüm: 400 bin nesnelik kovada 10000'lik sayfa
  ~80 ms). Kovanın sonunda imleç başa döner: `passes + 1`, `last_pass_at` ve `pass_started_at` güncellenir.
- Cron bir çalışmada en çok 20 çağrı / 25 sn (`p_limit` 500, `p_scan` 5000) yapar; iki kovanın turu biterse erken durur.
  Kalan kısım ertesi gün imleçten devam eder.
- **İzleme** (Vercel logları, `SENTRY_DSN` / `ERROR_WEBHOOK_URL` tanımlıysa oraya da): liste çağrısı zaman aşımı
  `MediaStraySweepTimeout` (cron yanıtı `stray.error = stray_list_timeout`), diğer liste hataları `MediaStraySweepFailed`
  (`stray_list_failed`), bir kovanın turu 7 günden uzun sürüyorsa `MediaStraySweepStalled` (`stray.stalled`).
  Zaman aşımına uğrayan çağrı işlemle birlikte geri alınır: imleç ilerlemez, ilerleme kaybolmaz.
- 01'in 8. satırı: `storage.objects (bucket_id, name COLLATE "C")` indeksi. `BİLGİ` çıkarsa (eski Storage sürümü) sayfalama
  doğru çalışır ama her sayfa kovayı sıralar; çok büyük kovada `MediaStraySweepTimeout` beklenir.
- Durum (yalnız okur): `select bucket, last_name = '' as basta, passes, pass_started_at, last_pass_at from public.media_stray_cursor;`

## Sıra ve ön koşullar

1. `../media_finalize_rpc/` (A) uygulanmış (D kendisi `apply A first` ile durur). B ve C'den bağımsızdır; C ile birlikte anlamlıdır.
2. Yeni kod production'da (cron süpürmesi yeni kodla gelir; D önce uygulanırsa zararsız, yalnız fonksiyon durur).
3. 01'de `DUR` yok; 02 saklandı; tam yedek alındı; yazılı O-5 onayı (K-19 §8 birim 4g).

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur — kapı | `DUR` yok; 4. satır `TAMAM`; 8. satır `TAMAM` beklenir |
| 2 | `02_save_state.sql` | Okur | Çıktı saklanır |
| 3 | `03_apply.sql` | Tek işlemde uygular | `media_stray_objects var = true`, `media_stray_cursor satır sayısı = 2` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnız geri dönüşte | Sonra 01: 5. satır `false / false` (uygulama öncesiyle aynı) |

**İlk çalıştırmadan önce (önerilir):** SQL Editor'de (veritabanı sahibi `postgres` çağırabilir; istemcilere kapalı) silinecek
ilk sayfayı görün. Çağrı imleci ilerlettiği için **geri alınan işlem** içinde çalıştırın:
`begin; select bucket, count(*) from public.media_stray_objects(1000, 10000) group by bucket; rollback;`
İlk cron çalışması birikmiş başıboş dosyaları siler; gece yedeği açıksa silinen dosyalar yedeğin `storage/deleted/TARİH/`
klasöründe 90 gün kalır (BACKUP_RESTORE.md).

Testler: `tests/security/media-stray-sweep.test.mjs` (SW-01…SW-09; SW-07 sayfalama, SW-08 imleç yetkisi, SW-09 zaman aşımı),
`tests/unit/media-stray-sweep.test.mjs` (SS-01…SS-07: cron bütçesi ve izleme), LR-14.

## Kapatma anahtarı (geri yükleme)

Yalnız veritabanı geri yüklemesinde (dosyalar yerinde, satırlar eski) süpürme hâlâ gerekli dosyaları silebilir. Geri yüklemeden
**önce** Vercel ortam değişkeni `MEDIA_STRAY_SWEEP=off` (yeniden dağıtım); cron süpürmeyi atlar (`stray.skipped`). Tutarlılık
doğrulanınca kaldırılır. Ayrıntı: docs/BACKUP_RESTORE.md "Tam geri yükleme".
