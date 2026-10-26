# Medya kota kilidi runbook'u (O-5) — `supabase/pending/20261026000001_media_quota_lock.sql`

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
Bu betikleri geliştirme ortamı ya da CI çalıştırmaz. Çıktılarda kurum adı/kimlik yoktur; yalnızca sayı ve nesne durumu.

**Sıra:** `../quota_lock/` uygulandıktan **sonra** (K-19: önce ekleme kilidi, sonra medya kilidi; 01 ve 03 `aa_quota_lock` yoksa durur).
`../company_name/` ile ilgisi yoktur, önce ya da sonra uygulanabilir. `../ops02_limits/` ile de bağımsızdır.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) | Hiçbir satırda `DUR` yok; 7. satır `0` (ya da `1`: zaten kurulu); 8. satırı okuyun (aşağıda) |
| 2 | `02_save_state.sql` | Okur; geri dönüş için mevcut durumu kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `media_assets_quota tetikleyici sayısı = 1` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 7. ve 9. satırlar 02 çıktısıyla aynı |

Ön koşul: tam yedek alınmış ve doğrulanmış olmalı; 03 şema sürümü en az `20261018000001` değilse durur ve
`karay_schema_version()` değerini değiştirmez. 03'ün sonundaki aynı-işlem kontrolü: tetikleyici tam bir kez, adı
`media_assets_org`'dan sonra sıralanır, fonksiyon `security definer` + boş `search_path`, `anon/authenticated/service_role/PUBLIC`
için `EXECUTE` yok; aksi halde işlem geri alınır.

**Müşteri etkisi:** 01'in 8. satırı depolama kotasını **zaten aşmış** kurum sayısını verir (yalnızca sayı). Uygulamadan sonra bu
kurumların bir sonraki medya yüklemesi `plan_limit_storage` ile reddedilir (mevcut dosyalar silinmez, yalnızca yeni ekleme engellenir;
kota dolmaya yakın kurumların büyük yüklemeleri de, %35 varyant payı nedeniyle, reddedilebilir). Sayı 0'dan büyükse uygulamadan önce
ilgili kurumlara bildirim ya da plan yükseltme kararı alın. Sınırsız planlar (kota NULL) etkilenmez.

**Kilit zaman aşımı (55P03):** `DROP/CREATE TRIGGER` `media_assets` üzerinde güçlü tablo kilidi ister. Uzun bir işlem varsa 03,
3 sn sonra `lock_not_available (55P03)` ile vazgeçer; **hiçbir şey değişmez**. 01'i yeniden çalıştırıp (10. ve 11. satır `TAMAM`)
sakin bir anda 03'ü tekrar deneyin. 03 tekrar çalıştırılabilir.

**Geri dönüş:** `05_rollback.sql` tetikleyiciyi ve `media_quota_check()` fonksiyonunu siler (pending dosyasının GERİ DÖNÜŞ başlığı);
`quota_lock`'a dokunmaz. Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin dosyayla aynı olduğunu, okuyan
betiklerin yazmadığını, 04 gövde özetinin (md5) pending fonksiyonla eşleştiğini ve 05'in geri dönüş ifadelerini içerdiğini denetler.

**Not (K-22 güvenlik incelemesi):** 05, "hiç uygulanmamış" duruma döner; 03'ten önce aynı adlı eski bir nesne
varsa onu geri getirmez. 02 çıktısı yalnızca elle geri yükleme içindir. 01 bu nesnelerin önceden olmadığını gösteriyorsa (beklenen durum) fark yoktur.
