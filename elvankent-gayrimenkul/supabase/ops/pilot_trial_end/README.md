# Pilot deneme bitişi runbook'u — `supabase/pending/20261108000004_pilot_trial_end.sql` (PILOT, H)

Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır. CI `scripts/rehearse-runbooks.sh` ile prova eder; davranış
`tests/security/pilot-trial-end.test.mjs` (PT-01…05).

**Ne yapar:** `platform_set_trial_end(org, tarih)` — yalnız KARAYS süper yöneticisi; ofisin güncel **deneme** aboneliğinin bitiş
tarihini 1–365 gün sonrasına ayarlar. Plan, durum, limitler, abonelik geçmişi değişmez; denetim kaydı yazılır. Konsol › Organizasyon ›
Plan ve abonelik › "Deneme / pilot bitişi". Ödeme yoktur (P0-7 ertelendi). Pilot bitince otomatik kısıtlama yoktur (OPS-02 kapalı).

| Konu | Durum |
|---|---|
| Bağımlılık | Yok |
| Kod sırası | Serbest: yeni konsol kodu fonksiyon yoksa anlaşılır hata verir |
| Mevcut veri | Değişmez |
| Geri alma | `05_rollback.sql` (girilmiş tarihler kalır) |

**Sıra:** taze yedek → 01 → 02 → 03 → 04 (hepsi TAMAM) → konsolda deneme ofisinde bitişi değiştir → panelde şerit yeni tarihi gösterir.
