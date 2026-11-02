# Şirket adı kısıtı runbook'u (O-5) — `supabase/pending/20261026000002_company_name_check.sql`

`platform_settings.company_name` için düz metin kısıtı (`platform_settings_company_name_plain`, **NOT VALID**) ekler.
Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır. Bu betikleri geliştirme ortamı ya da CI çalıştırmaz.
Çıktılarda şirket adı/kimlik yoktur; yalnızca sayı ve nesne durumu.

**Sıra:** `../quota_lock/`, `../ops02_limits/` ve `../media_quota_lock/` ile ilgisi yoktur; önce ya da sonra uygulanabilir.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) | Hiçbir satırda `DUR` yok; **5. satır `0`**; 6. satır `0 / false` (ya da `1`: zaten var) |
| 2 | `02_save_state.sql` | Okur; geri dönüş için mevcut kısıtları kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`); kısıt NOT VALID | Sonuç satırı: `kısıt sayısı = 1` |
| 3b | `03b_validate.sql` | **İsteğe bağlı**, ayrı işlem: `VALIDATE CONSTRAINT` mevcut satırları tarar | 04'te 4. satır `doğrulandı` |
| 4 | `04_postflight.sql` | Okur | 1, 3, 5. satırlar `TAMAM`; 4. satır 03 sonrası `doğrulanmadı (NOT VALID)` (BİLGİ), 03b sonrası `doğrulandı` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 6. satır `0 / false` |

**Neden 01'in 5. satırı 0 olmalı:** NOT VALID kısıt mevcut satırları taramaz, ama bir satır **herhangi bir sütunuyla** güncellendiğinde
yeni satır sürümünü denetler. `company_name` değeri zaten geçersiz olan bir satırda başka bir ayarın (ör. OPS-02 bayrağı) kaydı da
reddedilir. Bu yüzden 5. satır `DUR` ise önce değer uygulamadaki Ayarlar ekranından kaydedilerek temizlenir; 03'ün koruma bloğu da
aynı sayımı yapar ve 0 değilse durur.

**Neden 03b ayrı:** VALIDATE tabloyu tarar. Ayrı işlemde, sakin bir anda çalıştırılır; 03 ise tabloyu taramaz ve kısa sürer.
03b zorunlu değildir: doğrulanmadan da yeni ve güncellenen satırlar denetlenir. Hata verirse hiçbir şey değişmez.

**Kilit zaman aşımı (55P03):** `ALTER TABLE` kısa süreli güçlü kilit ister. Uzun bir işlem varsa 3 sn sonra `lock_not_available (55P03)`
ile vazgeçer; **hiçbir şey değişmez**. 01'i yeniden çalıştırıp (8. ve 9. satır `TAMAM`) sakin bir anda tekrar deneyin.

**Geri dönüş:** `05_rollback.sql` kısıtı siler (pending dosyasının GERİ DÖNÜŞ başlığı). Birim testi LR-14
(`tests/unit/launch-readiness.test.mjs`) gövdenin dosyayla aynı olduğunu, düzenli ifadenin 01/03/04'te pending ile birebir olduğunu,
okuyan betiklerin yazmadığını, 03b'nin yalnızca VALIDATE içerdiğini ve 05'in geri dönüş ifadesini içerdiğini denetler.

**Not (K-22 güvenlik incelemesi):** 05, "hiç uygulanmamış" duruma döner; 03'ten önce aynı adlı eski bir nesne
varsa onu geri getirmez. 02 çıktısı yalnızca elle geri yükleme içindir. 01 bu nesnelerin önceden olmadığını gösteriyorsa (beklenen durum) fark yoktur.
