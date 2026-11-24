# Kiracı izolasyonu kalanları runbook'u — `supabase/pending/20261124000001_tenant_hardening.sql` (KI-46, J)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip**, **onaydan sonra** çalıştırır (Supabase SQL Editor).
CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder (01→03→04→05→01→03→04).

**Neden:** 08.11 bağımsız denetimin (security-reviewer + database-reviewer) KI-46 için "açık kalan (düşük)" maddeleri. Hiçbiri bugün
istismar edilebilir bir açık değil (her biri başka bir katmanda zaten engelli); J ikinci kat korumayı veritabanına koyar.

| # | Ne yapar | Bugün neden açık değil | Kullanıcıya etkisi |
|---|---|---|---|
| 1 | `get_public_collection`: seçki öğeleri yalnız seçkinin kurumuna ait ilanlardan gelir | `collection_items` tetikleyicisi başka kurumun ilanını eklemeyi zaten reddediyor | Yok |
| 2 | `leads` / `appointments`: atanan kişi kurumun **aktif** üyesi olmalı (`assignee_not_member`) | Uygulama (`assertMember`) zaten denetliyor; tetikleyici doğrudan API yazımını da kapsar | Yok (eski atamalar silinmez) |
| 3 | anon'un `organization_settings` / `organization_domains` SELECT yetkisi kalkar | Tablolarda anon politikası yoktu (0 satır); site bu bilgileri `public_tenant_*` fonksiyonlarıyla alır | Yok |
| 4 | `neighborhoods` ekleme politikası kalkar | Uygulama mahalle eklemiyor; liste resmî konum verisi (`scripts/import-locations.mjs`) | Yok |

`organizations` için anon SELECT bilinçli olarak kalır: `/api/health` sağlık sorgusu onu kullanır (politika yok, 0 satır döner).

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur — kapı | `DUR` yok; 5. satır `TAMAM (henüz yok)` |
| 2 | `02_save_state.sql` | Okur | Çıktı saklanır |
| 3 | `03_apply.sql` | Tek işlemde uygular (3 sn kilit sınırı) | `atama tetikleyicileri = 2` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` (9. satır BİLGİ) |
| 5 | `05_rollback.sql` | Yalnız geri dönüşte | Sonra 01: 5. satır 0, 6–7. satırlar 02 ile aynı |

**Kabul testi (panelde, ~2 dk):** Talepler › bir talebi açın › "Atanan" alanında bir ekip üyesi seçip kaydedin → kaydedilir. Paylaşılan
bir seçki bağlantısını açın → ilanlar görünür. Sitenin ana sayfası ve bir ilan sayfası açılır.

Testler: `tests/security/rls.test.mjs` (TH-01…04).
