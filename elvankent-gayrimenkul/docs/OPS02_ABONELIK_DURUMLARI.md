# OPS-02 · Abonelik ve organizasyon durumları (teknik tasarım)

> **Durum (24.10.2026):** Tasarım. Kod değişmedi. Kalıcı çözüm D-05 (iptal, veri saklama) ve D-04 kararlarını bekliyor; o zamana kadar [operations/README.md](operations/README.md)'deki geçici kural geçerlidir: abonelik iptal edilmez, organizasyon askıya alınır.

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

**RLS etkisi:** Okuma politikaları değişmez. Kiracı izolasyonu `has_org_permission` ve üyelik kontrolleriyle zaten sağlanıyor. Değişiklik yalnızca üç limit kontrolünde, "plan satırı yok" durumunu sınırsız yerine **sıfır** sayar. Feature fonksiyonları zaten kapalı döner.

## 3. Uygulama planı (karardan sonra)

1. **Migration.** Üç kontrolde plan satırı yokken, `platform_settings` üzerindeki bir anahtar açıksa (`enforce_subscription_limits`, varsayılan `false`) reddet. Anahtar kapalıyken davranış bugünküyle aynı kalır.
   - Bayrak, varsayılan organizasyon ve demo ofisler gibi aboneliği olmayan kayıtların yanlışlıkla kapanmasını önler. Açmadan önce `03_apply`'daki gibi bir ön kontrol, aboneliksiz aktif organizasyonları listeler.
2. **RLS/birim testleri.**
   - `cancelled` ve `expired` iken yeni ilan, üye ve yükleme reddedilir.
   - Bayrak kapalıyken eski davranış sürer.
   - Yeniden etkinleştirince haklar geri gelir.
3. **Panel.** Durum şeridi ve "verilerinizi indirin" bağlantısı (dışa aktarma zaten var).

Yalnızca kod değişikliğidir, ücretlendirme mantığı eklemez. Canlıya çıkışı bir migration olduğundan O-5 onayı ve P0 kapıları gerekir.

## 4. Karar tablosu

| Karar | Seçenekler | Öneri | Gerekçe |
| --- | --- | --- | --- |
| D-05a İptal ne zaman geçerli | Hemen · dönem sonunda | Dönem sonunda | Ödenmiş süre korunur; sektör alışkanlığı |
| D-05b İptal sonrası site | Açık kalır (salt okunur) · kapanır | Kısa ek süre (ör. 14 gün), sonra askı | Müşteri verisini ve alan adını taşıyabilir |
| D-05c Veri saklama | X gün askı ve silme · süresiz | 90 gün, sonra silme (sözleşmeye yazılır) | KVKK: amaç sona erince silme |
| D-05d Dışa aktarma | Yalnız tablo · görseller dahil | Tablo (bugün var); görseller talep üzerine elle | Ek geliştirme gerektirmez |
| D-04 `past_due` ek süresi | Yok · N gün | 7 gün ek süre, sonra `expired` | Ödeme gecikmesi müşteriyi hemen kesmez |
| Bayrağın açılışı | Hemen · ilk iptalde | Migration canlıya çıktıktan ve ön kontrol temizken | Aboneliksiz kayıtları önce görmek |
