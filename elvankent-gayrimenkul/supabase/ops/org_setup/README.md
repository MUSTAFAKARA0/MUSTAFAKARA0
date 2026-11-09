# İlk kurulum runbook'u — `supabase/pending/20261108000005_org_setup.sql` (PILOT, I)

Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır. CI `scripts/rehearse-runbooks.sh` ile prova eder; davranış
`tests/security/org-setup.test.mjs` (OS-01…10) ve `tests/e2e/pilot-onboarding.spec.ts` (PO-1…9).

**Ne yapar:** `organization_setup` (ofis başına kurulum durumu) + KARAYS konsolundan açılan yeni ofis için `setup_pending`
satırı (yalnız süper yönetici oturumu, `organization_setup_init`) + sahibin kurulum fonksiyonları (`org_setup_progress`,
`org_setup_complete` — aile zorunlu, tasarımı mevcut `site_apply_design` ile yazar) + `platform_reopen_org_setup` (yalnız
süper yönetici, denetim kaydı `site.setup_reopened`; önceki tamamlanma bilgisi satırdan temizlenir, kayıtta kalır) +
`site_configs_design_lock`.

## Kilit kapsamı (uygulama ve veritabanı AYNI)

| Kilitli (kurulum tamamlandıktan sonra, ofis kullanıcıları için) | Serbest |
|---|---|
| Tasarım ailesi (`style.origin.family`) | Renkler (`colors`), yazı tipi (`typography`) |
| Temel tema paketi (`theme`) | Aynı aileyle bileşen stilleri (`style`'ın diğer anahtarları) |
| | Marka, logo, iletişim, şirket bilgileri, sayfa metinleri, menü, header, footer, ana sayfa bölümleri, SEO |
| | İlanlar, CRM, kullanıcılar, alan adı |

Yayınlama ve taslağı geri alma, mevcut taslak ↔ yayın değerleri arasında olduğu için serbesttir. **Geri alma:** kurulumdan
önceki (farklı tasarımlı) bir sürüme `site_rollback` reddedilir (`design_locked`); panel bunu "Bu sürüm farklı bir tasarım
kullanıyor; tasarım kilitli olduğu için bu sürüme dönülemez. İçerik değişikliklerini elle geri alabilir ya da KARAYS'tan
tasarım kilidini açmasını isteyebilirsiniz." diye gösterir. Kilit yalnız `origin = onboarding` ve `setup_completed` satırında
geçerlidir; KARAYS süper yöneticisi ve service_role etkilenmez.

## Hangi ofis akışa girer

| Ofis | Durum |
|---|---|
| 03'ten önce var olan her ofis (Elvankent dahil) | `setup_completed` + `legacy`: akışa yönlenmez, tasarımı kilitlenmez |
| Konsol › Organizasyonlar › Yeni | `setup_pending`; katalogda açık ailelerin tamamı izinli (Site › Tema'dan daraltılır) |
| Konsol › Yeni Site Oluştur (sihirbaz) | `setup_pending`; sihirbaz YALNIZ seçtiği aileyi izinli verir → kurulumda o aile önceden seçili ve tek seçenektir, sahip başka aileye geçemez (KARAYS Tema'dan aile ekleyebilir) |
| service_role ile açılan (test / betik) | satır yok: eski davranış |
| Legacy ofis KARAYS tarafından yeniden açılırsa | `onboarding` olur; sahip seçimi tamamlayınca KİLİTLENİR (konsol onay metninde yazar) |

İzinli aile yoksa sahip kurulumu tamamlayamaz (`family_required`; kilitlenmez); KARAYS aile açınca devam eder.

| Konu | Durum |
|---|---|
| Bağımlılık | Yok (20261004000001 tasarım ailesi yetkileri ve `site_apply_design` canlıda) |
| Kod sırası | Serbest: yeni kod tablo yokken akışı göstermez, kilitlemez (eski davranış); eski kod tabloyu okumaz |
| Mevcut veri | Yalnız `organization_setup` satırları eklenir; siteler, izinler, organizasyonlar değişmez |
| Kilitler | Tetikleyiciler işlemin SONUNDA kurulur (organizations, site_configs: kısa SHARE ROW EXCLUSIVE); var olan tetikleyici yalnız `pg_trigger`'da varsa kaldırılır. Tablo oluşturma `auth.users` ve `organizations` yabancı anahtarları için kısa SHARE ROW EXCLUSIVE kilit alır. `lock_timeout = 3s` |
| Geri alma | `05_rollback.sql` (kurulum durumu silinir; seçilmiş tasarımlar sitede kalır) |
| 05 sonrası yeniden 03 | O sırada var olan TÜM ofisler (yeni açılmış onboarding ofisleri dahil) `legacy` + tamamlandı işaretlenir; gerekirse KARAYS konsoldan "yeniden aç" der |

**Sıra:** taze yedek → 01 → 02 → 03 → 04 (TAMAM / BİLGİ; HATA yok) → konsoldan deneme ofisi aç (davet e-postası kendiliğinden
gider; "e-posta sağlayıcısı tarafından kabul edildi") → sahip etkinleşir → ilk girişte `/admin/kurulum` → tasarım seçip
tamamlar → Site yönetimi › Tasarım kilitli görünür → konsol › Organizasyon › İlk kurulum › "Tasarım seçimini yeniden aç"
denetim kaydı yazar.
