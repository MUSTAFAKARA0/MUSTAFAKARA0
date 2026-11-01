# KI-23 · Canlı veritabanı şema ön kontrolü (01.11.2026, K-33 / K-34)

Bu belge, canlı Supabase veritabanında (proje `elvankent-demo`) **hangi migration'ların eksik olduğunu**, bunun nasıl
doğrulandığını ve bugünkü production kodu (`a0f0a67`) ile uyumunu toplar. Geliştirme ortamının canlı veritabanına erişimi
yoktur; canlıda tek sorgu sahip tarafından, salt okunur olarak çalıştırıldı. Hiçbir migration uygulanmadı.

## 1. Kaynak: sahibin canlı tespit çıktısı (01.11.2026)

`supabase/ops/canli_sema_tespiti.sql` sahip tarafından Supabase SQL Editor'de çalıştırıldı; çıktı CSV olarak iletildi
("Supabase Snippet Untitled query 3.csv"). **Bu belgedeki eksik liste bu CSV'ye dayanır.**

| Satır | Değer |
| --- | --- |
| 1–21 (`20260922000001` … `20261001000001`) | **VAR** |
| 22–31 (`20261002000001` … `20261018000001`) | **YOK** (10 dosya) |
| 32–39 bekleyen (`supabase/pending`) | 8/8 **YOK** (beklenen) |
| 100 `karay_schema_version()` | fonksiyon yok |
| 101 `schema_migrations` | **21 kayıt · en yeni `20261001000001`** |
| 102 İLK EKSİK | `20261002000001_karay_platform.sql` |
| 103 TUTARLILIK | TAMAM: eksikler listenin son kısmı (10 dosya) |

Önceki tahmin düzeltildi: K-33'te yedek #48'in parmak izi uyarısından "en geç `20261008000001`'den itibaren (kesin 5, olası 12)"
denmişti. Gerçek durum ikisinin arasında: **10 eksik**, ilki `20261002000001`. (Parmak izi uyarısı `organization_invitations`
kaynaklıymış; `site_configs` canlıda var.)

## 2. Nesne kontrolü kanıt değildir — migration geçmişi ayrıca incelendi

`canli_sema_tespiti.sql` her dosya için **yalnız bir ayırt edici nesneye** bakar. `VAR`, o dosyanın bütün ifadelerinin eksiksiz
uygulandığını kanıtlamaz (ör. dosya elle kısmen çalıştırılmış ya da sonradan bir nesne elle değiştirilmiş olabilir). Bu yüzden
üç ayrı kanıt birlikte değerlendirilir:

| Kanıt | Bulgu | Değerlendirme |
| --- | --- | --- |
| a) Nesne kontrolü (CSV) | 21 VAR, sonra 10 YOK; arada boşluk yok | Sıralı uygulama ile tutarlı |
| b) Kayıt defteri özeti (CSV satır 101) | `supabase_migrations.schema_migrations`: **21 kayıt, en yeni `20261001000001`** | Kayıt sayısı ve en yeni sürüm (a) ile birebir aynı: ilk 21 dosya Supabase CLI ile kaydedilerek uygulanmış görünüyor. **Ama** özet, kayıtların hangi sürümler olduğunu ve içeriğini göstermez |
| c) Depo geçmişi (git, tam geçmiş indirildi) | 21 dosyanın her biri **tek commit**: oluşturulduktan sonra hiç değişmemiş | Canlıya uygulanan içerik, hangi tarihte uygulanmış olursa olsun, depodaki içerikle aynı olmalı |

**Açık kalan ve tek bir salt okunur sorguyla kapanacak olan:** kayıt defterindeki 21 kaydın sürüm sürüm depodaki dosyalarla
**aynı içerikle** yapıldığı. Bunun için yeni dosya: `supabase/ops/canli_migration_gecmisi.sql`.

- **Ne yapar:** kayıt defterindeki her sürüm için ifade sayısını ve ifadelerin MD5 özetini depodan beklenen değerlerle
  karşılaştırır (beklenenler, 31 migration'ın Supabase CLI 2.122.0 ile yerelde uygulanmasından alındı).
  Sonuç: `AYNI` · `FARKLI` (sayı/özet farklı) · `İÇERİKSİZ` (ifade listesi boş: `migration repair` ile işaretlenmiş, uygulandığının
  kanıtı değil) · `DEPODA YOK` (kayıtlı ama depoda olmayan sürüm) · `KAYITSIZ` (depoda var, kayıtta yok).
- **Ne yapmaz:** tek `SELECT`; yazmaz; ifade metnini yazdırmaz (yalnız sayı ve özet; içerik zaten depodaki migration dosyası).
- **Beklenen canlı sonuç:** `AYNI=21, KAYITSIZ=10`. `FARKLI` çıkarsa hata sayılmaz ama O-5a'dan önce elle incelenir (en olası
  neden farklı bir CLI sürümünün ifadeleri farklı bölmesi; bu durumda o dosyanın nesneleri postflight ile ayrıca denetlenir).
  `İÇERİKSİZ` ya da `DEPODA YOK` çıkarsa O-5a başlamaz.
- **Yerel doğrulama:** canlı benzeri yığın (21 migration) → `AYNI=21, KAYITSIZ=10` (sahibin CSV'siyle aynı tablo); geri alınan
  bir işlem içinde bir kaydın içeriği değiştirildi → `FARKLI`, bir kaydın içeriği boşaltıldı → `İÇERİKSİZ`, depoda olmayan sürüm
  eklendi → `DEPODA YOK`.

Uygulanmış 21 dosyanın **içeriğinin** (RLS, politikalar, yetkiler) tam denetimi canlıya dokunmadan KI-24 gerçek provasında yapılır:
gerçek yedek yerel veritabanına yüklenir, `postflight_v2` çalışır; eksik migration kaynaklı satırlar BİLGİ, uygulanmış dosyalardaki
gerçek RLS/yetki hataları HATA olarak ayrılır (sentetik D2–D4 senaryoları bunun gizlenmediğini gösteriyor).

## 3. Eksik migration listesi (CSV'ye göre kesin, tam sıra)

**O-5a — 9 temel migration** (her biri `supabase/ops/o5a/NN_<dosya>.sql` ile, ayrı sorgu, tek işlem):

1. `20261002000001_karay_platform.sql`
2. `20261004000001_design_family_access.sql`
3. `20261005000001_office_site_management.sql`
4. `20261006000001_brand_content_draft.sql`
5. `20261007000001_seo_draft.sql`
6. `20261008000001_owner_invitations.sql`
7. `20261009000001_custom_domains.sql`
8. `20261010000001_password_reset_requests.sql`
9. `20261011000001_customer_operations.sql` — `karay_schema_version()` bununla gelir

**Ayrı adım — KARAYS marka:** `20261018000001_karays_brand.sql`, **dosya olarak değil**, `supabase/ops/karays_brand/` runbook'u
(01 → 02 → 03 → 04). 01, sürüm fonksiyonu `20261011000001` olmadan **DUR** verir; bu yüzden O-5a'dan sonra gelir.

**Bekleyen — 8 dosya** (her biri kendi runbook'uyla; O-5 planı 3–4. aşamalar): `20261025000001` quota_lock,
`20261025000002` ops02 (bayrak kapalı), `20261026000001` media_quota_lock, `20261026000002` company_name_check,
`20261027000001` media_finalize_rpc, `20261027000002` media_column_privileges, `20261027000003` media_storage_slots,
`20261031000001` media_stray_sweep.

### O-5a dosyaları neden ham migration değil

SQL Editor ile uygulanan dosya `schema_migrations`'a **yazılmaz**; kayıt defteri 21'de kalır ve ileride biri `supabase db push`
çalıştırırsa CLI bu 9 dosyayı "uygulanmamış" sanıp yeniden çalıştırmaya kalkar. KARAYS runbook'u bu sorunu kendi `03_apply.sql`
içinde aynı işlemde kayıt yazarak çözüyor; O-5a aynı yolu izler:

- `supabase/ops/o5a/NN_<dosya>.sql` = migration dosyasının **birebir** içeriği + sonda, **aynı işlemde**,
  `insert into supabase_migrations.schema_migrations (version, name, statements)` (ifade = dosyanın tamamı).
- Dosya hata verirse kayıt da yazılmaz; kayıt yazılamazsa (sürüm zaten kayıtlı) dosya da uygulanmaz — **iki kez uygulamaya karşı
  koruma** (yerelde denendi: ikinci uygulama `duplicate key` ile reddedildi, kayıt sayısı değişmedi).
- Dosyalar `scripts/o5a-build.sh` ile üretilir; birim testi (O5A-01) gövdenin migration dosyasıyla birebir aynı olduğunu ve
  dosyaların güncel olduğunu denetler. Elle düzenlenmez.
- Uygulamadan sonra `canli_migration_gecmisi.sql` bu kayıtları `AYNI (O-5a kaydı)` olarak tanır; KARAYS runbook'unun içeriksiz
  kaydını `AYNI (KARAYS runbook kaydı)` olarak.

## 4. Kod ↔ şema uyumu (production `a0f0a67` bugün, eksik 10 dosyayla)

| Eksik dosya | Kodda kullanan yer | Dosya yokken canlıda | Dosya uygulanınca |
| --- | --- | --- | --- |
| `20261002000001` KARAY platformu | KARAYS sayfası profili (`public_platform_profile`), **"Bilgi al / Demo talep et" formu** (`submit_platform_lead`), KARAY konsolu ayarlar ve talepler | Sayfa varsayılan bilgilerle açılır; **form gönderimi "Talebiniz gönderilemedi" hatası verir — aday talepleri kaydedilmiyor**; konsol ayarlar/talepler ekranı hata verir | Form ve ekranlar çalışır; iletişim alanları boş başlar |
| `20261004000001` tasarım ailesi erişimi | KARAY › tasarım kataloğu, ofis aile seçimi | "Bu özellik için migration gerekli" uyarısı (kod bunu bekliyor) | Çalışır |
| `20261005000001` ofis site yönetimi | Ofis panelinden site düzenleme (`assert_site_editor`) | Ofis sahibinin kendi sitesini düzenlemesi hata verebilir (yalnız süper admin) | Sahip/yönetici düzenleyebilir |
| `20261006000001` marka taslağı, `20261007000001` SEO taslağı | Marka/SEO alanlarının taslak akışı | İlgili kaydetme işlemleri hata verebilir | Çalışır |
| `20261008000001` davet | Yeni müşteri açma (`platform_create_organization(..., p_invite_token_hash)`), davet gönderme/kabul | Yeni müşteri açma ve davet **hata verir** | Çalışır; mevcut kullanıcılar/şifreler değişmez |
| `20261009000001` alan adı | `domain_add` | Alan adı ekleme **hata verir** | Çalışır |
| `20261010000001` şifre sıfırlama sınırı | `auth_password_reset_allowed` | Kod sınırsız devam eder — kötüye kullanım sınırı **yok** | Sınır devrede |
| `20261011000001` müşteri işlemleri | `platform_customer_overview`, `platform_org_notes` | KARAY konsolu ana sayfası ve müşteri listesi **hata verir**; panel kurulum listesi gizlenir | Çalışır; `karay_schema_version()` gelir |
| `20261018000001` KARAYS | `company_name` varsayılanı | Ad "KARAY" kalır (görsel) | "KARAYS" (elle girilmiş ad korunur) |

Sonuç: bu dosyalar **yeni kod gerektirmez**; production kodu onları zaten bekliyor. Eksiklik kiracı sitelerinin ve ofis panelinin
temel işlevlerini (ilan, müşteri, RLS) bozmaz; KARAYS'ın kendi satış/yönetim işlevlerini (aday formu, konsol, yeni müşteri,
davet, alan adı) etkiler. Bu bulgu O-5a'yı aceleye getirmek için değil, önceliğini doğru koymak için yazıldı; sıra ve onay
O5_YAYIN_PLANI.md'dedir.

## 5. Yerel prova (canlıya dokunmadan)

`scripts/o5-upgrade-rehearsal.sh`, canlı benzeri yığında (`scripts/live-like-stack.sh <kesim>`, portlar 553xx, demo verisi)
canlıda izlenecek sırayı uçtan uca dener: tespit → eksik dosyalar (O-5a dosyası varsa o) tek işlemde, her birinden sonra tespit
`VAR` → KARAYS runbook'u 01–04 → `postflight_v2` → bekleyen 8 runbook (01→05 geri dönüş→yeniden uygulama) → son tespit 39/39 →
**migration geçmişi** (tutarsız kayıt yok; O-5a ile uygulananlar kayıtlı). Ardından aynı veritabanında `npm run test:rls`
(kiracı yalıtımı, RLS, MFA, ilan/üye/depolama kotaları, abonelik sınırları, medya, davet, alan adı).

| Başlangıç | Prova | Geçmiş | Güvenlik testleri |
| --- | --- | --- | --- |
| **Kesim `20261002000000` = canlının CSV'deki durumu** (21 VAR, 21 kayıt) | 9 O-5a dosyası + KARAYS + 8 runbook; postflight 22 TAMAM / 0 HATA; 39/39 VAR | `AYNI=21, AYNI (O-5a kaydı)=9, AYNI (KARAYS runbook kaydı)=1`; 31 kayıt | **201/201** |
| Kesim `20260930000002` (K-33, 12 eksik; O-5a dosyası öncesi) | 39/39 VAR, 0 HATA | — | 201/201 |
| Kesim `20261008000000` (K-33, 5 eksik) | 39/39 VAR, 0 HATA | — | 201/201 |

Bulgu (K-33, düzeltildi): canlı benzeri yığın `supabase init` varsayılanıyla TOTP'yi kapalı açıyordu; 4 MFA testi ortam yüzünden
düşmüştü. Canlıda TOTP açık olduğundan betik artık CI ile aynı ayarı yapar.

## 6. Sahipten istenen sıradaki tek şey

`supabase/ops/canli_migration_gecmisi.sql` çıktısı (bir kez, salt okunur, SQL Editor). Beklenen: `AYNI=21, KAYITSIZ=10`.
Bu çıktı ve KI-24 gerçek provası O-5a'nın ön koşuludur. Migration uygulamak ayrı ve açık onay gerektirir.
