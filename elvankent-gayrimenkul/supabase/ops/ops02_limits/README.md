# OPS-02 abonelik limitleri runbook'u (O-5) — `supabase/pending/20261025000002_ops02_subscription_limits.sql`

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
**Bayrak (`enforce_subscription_limits`) KAPALI kalır:** hiçbir betik onu açmaz; açma ayrı karardır (D-04/D-05).

**Sıra:** önce `../quota_lock/` uygulanmış olmalı. 01 (7–8. satır) ve 03, `aa_quota_lock` eksikse `DUR` der.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) | `DUR` yok; 5. satır `yok` ya da KAPALI; 9–11. satır yalnızca sayı (BİLGİ) |
| 2 | `02_save_state.sql` | Okur; `org_plan()` tanımı, özeti ve yetkileri kaydedilir | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç: varsayılan `false` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM`; bayrak AÇIK satır sayısı `0` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01: 5–6. satırlar 02 çıktısıyla aynı; `org_plan` özeti aynı |

**Kilit zaman aşımı (55P03):** `ALTER TABLE platform_settings` kısa süreli güçlü kilit ister. Uzun işlem varsa 03, 3 sn sonra
`55P03` ile vazgeçer; **hiçbir şey değişmez**. 01'i yeniden çalıştırıp (12. ve 13. satır `TAMAM`) sakin bir anda 03'ü tekrar
deneyin. 03 tekrar çalıştırılabilir.

**Bayrak açılmadan önce:** 01'in 9–11. satırı (etkin aboneliği olmayan ve limiti aşan kurum sayısı) değerlendirilmelidir;
bayrak açılınca etkin aboneliği olmayan her kurumda yeni ilan/üye/yükleme reddedilir.

**Geri dönüş:** `05_rollback.sql`, `org_plan()` tanımını onu en son tanımlayan migration'dan
(`20260930000002_site_builder.sql`) birebir yeniden kurar, sonra sütunu siler (pending dosyasının GERİ DÖNÜŞ başlığı).
`quota_lock` da geri alınacaksa önce bu 05, sonra `../quota_lock/05_rollback.sql`. Birim testi LR-14 bu tutarlılığı denetler.
