# Kiracı üyelik koruması runbook'u — `supabase/pending/20261108000002_tenant_member_guard.sql` (P0-3, F)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip**, **yazılı onaydan sonra** çalıştırır.
CI `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder; davranış `tests/security/tenant-member-guard.test.mjs` (TG-01…07).

**Sorun (08.11 bağımsız denetim, uygulama ve veritabanı katmanı):** `users.manage` yetkili bir ofis yöneticisi, başka ofisin
sahibini ya da KARAYS platform yöneticisini onayı olmadan kendi ofisine üye ekleyebiliyor (ekip formu ya da doğrudan API) ve
üyelik satırının kişisini değiştirebiliyordu → o kişinin adı, telefonu, e-postası ve son girişi bu ofise görünür. Ayrıca
ilanın paylaşım görseli (`og_media_id`) başka ofisin medyasını gösterebiliyordu.

**Ne yapar:** iki `BEFORE` tetikleyici. Kullanıcı oturumuyla: hedef hesap başka ofise bağlıysa ya da platform yöneticisiyse
üyelik eklenemez (`member_unavailable`); üyelik satırının kişisi değiştirilemez (`member_user_immutable`); `og_media_id` yalnız
aynı ofisin medyası (`cross_tenant_reference`, service_role için de). Sistem/service_role yolları (KARAYS ofis açılışı) ve
platform yöneticisi etkilenmez. Hiçbir ofise bağlı olmayan hesap (yeni kişi, çıkarılıp yeniden eklenen kişi) eklenebilir.

## Canlıya geçiş planı (sahip onayı bekliyor — UYGULANMADI)

| Konu | Durum |
|---|---|
| Bağımlılık | Yok (yalnız canlıdaki temel migration'lar). E (KI-42) ile bağımsız; sıra fark etmez |
| Kod | `src/app/actions/admin-users.ts` aynı kuralı önceden denetler (anlaşılır mesaj). Kod ile migration birbirinden bağımsız yayınlanabilir |
| Mevcut veri | Değişmez. 01'in 7. satırı birden çok ofise bağlı hesapları, 8. satırı yabancı `og_media_id`'yi yalnız sayar; 0 değilse KARAYS ile gözden geçirilir |
| Kesinti | İki tabloda kısa tetikleyici kilidi; `lock_timeout` 3 sn; düşük trafikte |
| Geri alma | `05_rollback.sql` (yalnız tetikleyici + fonksiyon) |

**Sıra:** taze yedek (Actions › `elvankent-backup` › production dalı) → 01 (DUR yok, sakla) → 02 (sakla) → 03 → 04 (hepsi TAMAM).
**Kabul testleri:** (a) panelde yeni bir e-postayla ekip üyesi ekleyin → davet gider; (b) çıkarılan bir üyeyi yeniden ekleyin →
eklenir; (c) başka bir ofisin kullanıcısının e-postasıyla deneyin → "Bu e-posta adresi ekibinize eklenemiyor…"; (d) KARAYS konsolundan
yeni ofis açın → sahip daveti çalışır; (e) bir ilanın paylaşım görselini değiştirin → çalışır; (f) 04 yeniden: hepsi TAMAM.

| Adım | Dosya | Beklenen |
|---|---|---|
| 1 | `01_preflight.sql` | `DUR` yok; 5. satır `TAMAM (henüz yok)` |
| 2 | `02_save_state.sql` | Çıktı saklanır |
| 3 | `03_apply.sql` | `F tetikleyici sayısı = 2` |
| 4 | `04_postflight.sql` | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnız geri dönüşte; sonra 01: 5. satır 0 |
