# Medya sonlandırma RPC'si runbook'u (O-5) — `supabase/pending/20261027000001_media_finalize_rpc.sql` (WP-A2 · A)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
Bu betikleri geliştirme ortamı ya da CI çalıştırmaz (CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder).
Çıktılarda kurum adı/kimlik yoktur; yalnızca sayı ve nesne durumu.

**Ne ekler:** `media_finalize`, `media_mark_failed` (authenticated), `media_queue_claim`, `media_queue_done` (yalnız service_role),
`media_storage_report` (service_role / süper admin), `media_file_queue` tablosu (RLS açık, politika ve yetki yok, yabancı anahtar yok)
ve `media_assets` üzerinde deyim düzeyinde AFTER DELETE tetikleyicisi. Yalnız yeni nesne eklenir: **eski kodla zararsızdır**.

**Sıra:** `../quota_lock/` ve `../media_quota_lock/` ile bağımsız. Yayın sırası **A → yeni kod → kapı (`../media_privileges/01`) → B**.
B uygulanmadan A yeni koda yetmez; A tek başına hiçbir davranışı değiştirmez, yalnız RPC'leri kullanılabilir kılar.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) | Hiçbir satırda `DUR` yok; 5. satır (depolama erişimi) `TAMAM`; 6. satır `TAMAM (henüz yok)` ya da `zaten var` |
| 2 | `02_save_state.sql` | Okur; geri dönüş için mevcut durumu kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `A fonksiyon sayısı = 6` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | B varsa ya da kuyrukta satır varsa **DURUR**; sonra 01 yeniden |

**Depolama erişimi (kritik):** fonksiyonların sahibi `storage.objects` üzerinde SELECT hakkına sahip olmalı ve RLS'yi atlamalıdır
(`rolbypassrls`). Aksi halde her çağrı `media_not_uploaded` verir. 01 (5. satır) ve 03 (koruma) bunu denetler; 04 (8. satır) sonradan doğrular.
Supabase SQL Editor `postgres` rolüyle çalışır ve bu iki koşulu sağlar.

**Kuyruk ve boşaltma:** silinen satırların ve değiştirilen varyantların dosya yolları `media_file_queue`'ya yazılır. Cron
(`media-cleanup`) `media_queue_claim(limit)` ile satırları kiralar (`claimed_at`; 5 dakika kira, `FOR UPDATE SKIP LOCKED`), Storage API ile siler,
silinenler için `media_queue_done(ids)` çağırır. Kiralanmış satır, kira bitmeden başka çalışmaya verilmez. `/` ile başlayan demo tabanları
ve `legacy_path` satırları kuyruğa alınmaz. Toplu silme deyim düzeyinde tek `INSERT … SELECT` ile kuyruğa alınır (birkaç bin satır için tek deyim).

**Geri dönüş:** `05_rollback.sql` önce B yokluğunu denetler, silme tetikleyicisini düşürür, SONRA kuyruğu sayar (satır varsa işlem geri alınır, tetikleyici de geri gelir), kalan fonksiyonları ve boş tabloyu siler. **B uygulanmışsa durur** — önce
`../media_privileges/05_rollback.sql` (B her zaman A'dan önce geri alınır). **Kuyrukta satır varsa durur**: silinmemiş dosyalar kaybolmasın
diye önce cron ile boşaltın ya da satırları dışa aktarın. Yeni kod RPC'nin yokluğunu `PGRST202` + `media_finalize` adıyla algılar ve
bugünkü yedek yola düşer.

**Kuyruk güvenliği:** bir yol yalnız `organizations/<kurum>/` ile başlıyorsa ve `..` içermiyorsa kuyruğa alınır (silme tetikleyicisi ve `media_finalize`'ın önceki taban kuyruğu).
B öncesi bir üye kendi satırının yol sütunlarını başka kurumun önekine çevirip satırı silse de o kurumun dosyaları kuyruğa girmez. `media_queue_claim`
`(id, org_id, bucket, path)` döndürür. 01'in 12. satırı kurum dışı yollu satır sayısını verir (B'nin kapısı bunu `DUR` sayar).

**KALAN RİSK — C, kriter 7 için YAYIN KOŞULUDUR:**
- Üyeler sonlandırmadan **sonra da** kendi kurumlarının depolama nesnelerinin üzerine yazabilir (depolama UPDATE/upsert politikaları); kayıtlı boyut gerçek boyuttan sonradan sapabilir.
- `media_assets` satırı olmadan, Storage API ile `organizations/<kurum>/` altına doğrudan yüklenen dosyalar mümkün kalır ve kotaya sayılmaz.
- `media_storage_report(<kurum>)` bunları yalnızca **tespit eder** (`orphan_originals`, `orphan_variants`, branding dahil bayt toplamları); **önleme** C'yi
  (depolama yuvası politikası, imzalama davranışı yerelde kanıtlandıktan sonra) gerektirir. C olmadan kriter 7 kapanmış sayılmaz.

Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin pending dosyayla aynı olduğunu, okuyan betiklerin yazmadığını,
04 gövde özetinin (md5) pending `media_finalize` ile eşleştiğini ve 05'in geri dönüş ifadelerini içerdiğini denetler.
Davranış testleri: `tests/security/media-finalize.test.mjs`.
