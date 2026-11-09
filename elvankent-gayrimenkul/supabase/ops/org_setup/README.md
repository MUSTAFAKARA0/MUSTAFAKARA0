# İlk kurulum runbook'u — `supabase/pending/20261108000005_org_setup.sql` (PILOT, I)

Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır. CI `scripts/rehearse-runbooks.sh` ile prova eder; davranış
`tests/security/org-setup.test.mjs` (OS-01…10) ve `tests/e2e/pilot-onboarding.spec.ts` (PO-1…8).

**Ne yapar:** `organization_setup` (ofis başına kurulum durumu) + KARAYS konsolundan açılan yeni ofis için `setup_pending`
satırı (yalnız süper yönetici oturumu, `organization_setup_init`) + sahibin kurulum fonksiyonları (`org_setup_progress`,
`org_setup_complete` — tasarımı mevcut `site_apply_design` ile yazar) + `platform_reopen_org_setup` (yalnız süper yönetici,
denetim kaydı `site.setup_reopened`) + `site_configs_design_lock` (kurulumu tamamlanmış yeni ofiste ofis kullanıcıları yeni
tema / tasarım ailesi yazamaz; marka, logo, iletişim, sayfa metinleri, header/menü/footer, SEO, ilan ve CRM serbest).

| Konu | Durum |
|---|---|
| Bağımlılık | Yok (20261004000001 tasarım ailesi yetkileri ve `site_apply_design` canlıda) |
| Kod sırası | Serbest: yeni kod tablo yokken akışı göstermez, kilitlemez (eski davranış); eski kod tabloyu okumaz |
| Mevcut veri | Var olan her ofis `setup_completed` / `legacy` işaretlenir: akışa yönlenmez, tasarımı kilitlenmez; siteler değişmez |
| Geri alma | `05_rollback.sql` (kurulum durumu silinir; seçilmiş tasarımlar sitede kalır) |

**Sıra:** taze yedek → 01 → 02 → 03 → 04 (hepsi TAMAM) → konsoldan deneme ofisi aç (davet e-postası kendiliğinden gider) →
sahip etkinleşir → ilk girişte `/admin/kurulum` → tasarım seçip tamamlar → Site yönetimi › Tasarım kilitli görünür →
konsol › Organizasyon › İlk kurulum › "Tasarım seçimini yeniden aç" denetim kaydı yazar.
