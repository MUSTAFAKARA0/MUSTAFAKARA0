# Ekleme kilidi runbook'u (O-5) — `supabase/pending/20261025000001_quota_lock.sql`

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
Bu betikleri geliştirme ortamı ya da CI çalıştırmaz. Çıktılarda kurum adı/kimlik yoktur; yalnızca sayı ve nesne durumu.

**Sıra:** önce bu klasör, sonra `../ops02_limits/` (OPS-02 buna dayanır). Ardından `../media_quota_lock/` (K-19: bu klasör ondan önce).

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) | Hiçbir satırda `DUR` yok; 5–6. satırlar `0` (ya da `1`: zaten kurulu) |
| 2 | `02_save_state.sql` | Okur; geri dönüş için mevcut durumu kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `aa_quota_lock tetikleyici sayısı = 2` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 5–7. satırlar 02 çıktısıyla aynı |

Ön koşul: tam yedek alınmış ve doğrulanmış olmalı; 03 şema sürümü en az `20261018000001` değilse durur ve
`karay_schema_version()` değerini değiştirmez.

**Kilit zaman aşımı (55P03):** `DROP/CREATE TRIGGER` `properties` ve `organization_members` üzerinde güçlü tablo kilidi ister.
Uzun bir işlem varsa 03, 3 sn sonra `lock_not_available (55P03)` ile vazgeçer; **hiçbir şey değişmez**. 01'i yeniden çalıştırıp
(9. ve 10. satır `TAMAM`) sakin bir anda 03'ü tekrar deneyin. 03 tekrar çalıştırılabilir.

**Geri dönüş:** `05_rollback.sql` iki tetikleyiciyi ve `quota_lock()` fonksiyonunu siler (pending dosyasının GERİ DÖNÜŞ başlığı).
`ops02_limits` de uygulandıysa önce onun 05'i. Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin dosyayla aynı
olduğunu, okuyan betiklerin yazmadığını ve 05'in geri dönüş ifadelerini içerdiğini denetler.
