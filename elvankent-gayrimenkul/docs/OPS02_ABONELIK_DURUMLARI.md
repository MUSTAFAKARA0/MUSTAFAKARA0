# OPS-02 · Abonelik ve organizasyon durumları (teknik tasarım)

> **Durum (24.10.2026, K-19):** Uygulama hazır, canlıda değil. İki bekleyen migration (`supabase/pending/`) yerel Supabase'de ve CI'da sınanıyor; bayrak varsayılan kapalı. Canlıya alınması O-5 onayına, bayrağın açılması D-04/D-05 kararına bağlı (§3).
>
> Önceki durum: Tasarım. Kod değişmedi. Kalıcı çözüm D-05 (iptal, veri saklama) ve D-04 kararlarını bekliyor; o zamana kadar [operations/README.md](operations/README.md)'deki geçici kural geçerlidir: abonelik iptal edilmez, organizasyon askıya alınır.

## 1. Bugünkü davranış (kodla doğrulandı)

İki ayrı durum alanı vardır:
- `subscriptions.status` (`subscription_status`): `trialing`, `active`, `past_due`, `cancelled`, `expired`.
- `organizations.status` (`org_status`): `active`, `suspended`, `cancelled`.

`org_plan(org)` yalnızca `trialing`/`active`/`past_due` aboneliği döndürür (`20260930000002_site_builder.sql:140-168`). Limitler bu satırdan okunur:

| Kontrol | Yer | Plan satırı yoksa |
| --- | --- | --- |
| İlan limiti | properties tetikleyicisi (`20260926000003_v2_properties.sql:337`) | `v_max` boş, **sınırsız** |
| Kullanıcı limiti | üyelik tetikleyicisi (`20260927000001_v2_platform_fixes.sql:48`) | **sınırsız** |
| Depolama | `media_upload_allowed` (`20260926000007_v2_security.sql:1010`) | **sınırsız** |
| CRM, analitik, PDF, özel alan adı | `org_plan` sütunları, `coalesce(…, false)` | kapalı |

Organizasyon `active` değilse üyelik kontrolleri (`20260926000002_v2_tenancy.sql:253`) paneli kapatır, site yayından düşer. Veri silinmez.

Limitler yalnızca **yeni kayıtta** denetlenir. Plan düşürüldüğünde limitin üstündeki mevcut ilan ve üyeler kalır, yenisi eklenemez.

**Boşluk:** `cancelled` ya da `expired` abonelikte organizasyon `active` kaldığı sürece limitler kalkar ("fail-open").

## 2. Önerilen durum makinesi

Öneri: abonelik durumu **yetkiyi değil kotayı** belirler. Siteyi ve paneli organizasyon durumu kapatır.

| Durum | Panel okuma | Yeni ilan / üye / yükleme | Mevcut ilan düzenleme | Site yayını | Dışa aktarma | Panelde gösterilecek |
| --- | --- | --- | --- | --- | --- | --- |
| `trialing` | Evet | Plan limitine kadar | Evet | Evet | Evet | "Deneme · N gün kaldı" |
| `active` | Evet | Plan limitine kadar | Evet | Evet | Evet | — |
| `past_due` | Evet | Plan limitine kadar (öneri: ek süre) | Evet | Evet | Evet | "Ödeme bekleniyor" uyarısı |
| `cancelled` (dönem sonunda) | Evet | **Hayır** (öneri) | Evet (öneri) | D-05'e göre | **Evet** | "Abonelik sona erdi; verilerinizi indirin" |
| `expired` | Evet | **Hayır** (öneri) | Evet (öneri) | D-05'e göre | **Evet** | Aynı |
| org `suspended` | Hayır (panel kapalı) | Hayır | Hayır | Kapalı | KARAY ekibi aracılığıyla | — |
| Yeniden etkinleştirme | Org `active` ve abonelik `active`/`trialing` olduğunda tüm haklar geri gelir; veri değişmez | | | | | |
| Yükseltme | Yeni limit hemen geçerli | | | | | |
| Düşürme | Mevcut kayıt korunur; limit altına inene kadar yeni kayıt yok (bugünkü davranış) | | | | | |

**Ad eşlemesi (yeni enum değeri gerekmez):** `cancellation_pending` = `active` + `subscriptions.cancelled_at` dolu (dönem sonunda biter) · `canceled` = `cancelled` · `suspended` = `organizations.status = 'suspended'` (abonelikten bağımsız) · `reactivated` = `cancelled`/`expired` → `active` geçişi (`platform_set_org_plan`).

**RLS etkisi:** Okuma politikaları değişmez. Kiracı izolasyonu `has_org_permission` ve üyelik kontrolleriyle zaten sağlanıyor. Değişiklik yalnızca üç limit kontrolünde, "plan satırı yok" durumunu sınırsız yerine **sıfır** sayar. Feature fonksiyonları zaten kapalı döner.

## 3. Uygulama (K-19)

| Dosya | Ne yapar | Karar bekler mi |
| --- | --- | --- |
| `supabase/pending/20261025000001_quota_lock.sql` | İlan ve üyelik eklemeleri, limit sayımından önce organizasyon başına işlem kilidi alır | Hayır. Yalnızca O-5 (canlı migration) onayı |
| `supabase/pending/20261025000002_ops02_subscription_limits.sql` | `platform_settings.enforce_subscription_limits` (varsayılan `false`). Bayrak açık ve etkin abonelik yoksa `org_plan()` sıfır limitli satır döner | Dosya hayır; **bayrağın açılması D-04/D-05** |

**Doğrulanan hata (SL-05):** Limit sayımı satır eklenmeden önce yapılıyor. Kilit olmadan, ilan limiti 3 olan planda 8 eşzamanlı istekle 4–7 ilan oluştu (yerel Supabase, üç deneme). Bu hata bugünkü production kodunda da var. Kilitle sonuç her denemede 3.

**Testler** (`tests/security/subscription-limits.test.mjs`; `npm run test:rls` güvenlik testlerini sırayla çalıştırır):
- SL-01: Bayrak kapalıyken davranış eskisiyle aynı.
- SL-02: Bayrak açıkken iptal edilmiş, süresi dolmuş ya da aboneliği olmayan ofiste yeni ilan, üye ve yükleme reddediliyor; mevcut ilan okunup düzenlenebiliyor.
- SL-03: Etkin abonelik etkilenmiyor; yeniden etkinleştirince haklar dönüyor.
- SL-04: Bayrağı ofis sahibi ve anonim ziyaretçi okuyamıyor, değiştiremiyor.
- SL-05: Eşzamanlı ekleme limiti aşamıyor.

Yerelde (K-19) 105 mevcut güvenlik testiyle birlikte 114/114 geçti. Mutasyon: kilit kaldırılınca SL-05, eski `org_plan` ile SL-02/03'ün 3 testi kaldı.

**Kapsam dışı ve kalan:**
- Depolama kotası: `media_upload_allowed()` medya kaydı (`media_assets`) eklenmeden önce ayrı bir RPC olarak çağrılır; eşzamanlı ya da doğrudan (RLS üzerinden, RPC'siz) eklenen kayıtlar kotayı aşabiliyordu. Düzeltme bekleyen `supabase/pending/20261026000001_media_quota_lock.sql` (SL-06). Kalan: `byte_size` istemcinin bildirdiği boyuttur ve kayıtsız yüklenen dosyalar sayılmaz.
- Panelde durum şeridi ve "verilerinizi indirin" bağlantısı yok (dışa aktarma var). Metin D-05'e bağlı.
- `past_due` ek süresi (D-04) ve iptal sonrası site yayını (D-05b) kod değil süreç kararı. Bugün `past_due` tam yetkili; `cancelled`/`expired` site yayınını kapatmaz (organizasyon durumu kapatır).

**Canlıya çıkış sırası (onaydan sonra):**
1. Ön kontrol: etkin aboneliği olmayan aktif organizasyonların listesi (bayrak açılırsa kapanacaklar).
2. 20261025000001 (kilit). O-5 ile, KARAYS migration'ından bağımsız uygulanabilir.
3. 20261025000002 (bayrak, kapalı).
4. D-04/D-05 kararı ve ön kontrol temizse bayrak süper admin tarafından açılır.

Her iki dosya `migrations/` klasörüne taşınırken `karay_schema_version()` güncellenir, `postflight_v2.sql`'e eklenir (LR-02) ve yayın kiti gibi ön/son kontrol betikleri yazılır.

## 4. Karar tablosu

| Karar | Seçenekler | Öneri | Gerekçe |
| --- | --- | --- | --- |
| D-05a İptal ne zaman geçerli | Hemen · dönem sonunda | Dönem sonunda | Ödenmiş süre korunur; sektör alışkanlığı |
| D-05b İptal sonrası site | Açık kalır (salt okunur) · kapanır | Kısa ek süre (ör. 14 gün), sonra askı | Müşteri verisini ve alan adını taşıyabilir |
| D-05c Veri saklama | X gün askı ve silme · süresiz | 90 gün, sonra silme (sözleşmeye yazılır) | KVKK: amaç sona erince silme |
| D-05d Dışa aktarma | Yalnız tablo · görseller dahil | Tablo (bugün var); görseller talep üzerine elle | Ek geliştirme gerektirmez |
| D-04 `past_due` ek süresi | Yok · N gün | 7 gün ek süre, sonra `expired` | Ödeme gecikmesi müşteriyi hemen kesmez |
| Bayrağın açılışı | Hemen · ilk iptalde | Migration canlıya çıktıktan ve ön kontrol temizken | Aboneliksiz kayıtları önce görmek |
