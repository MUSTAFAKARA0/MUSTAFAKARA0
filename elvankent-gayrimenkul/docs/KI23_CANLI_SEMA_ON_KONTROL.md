# KI-23 · Canlı veritabanı şema ön kontrolü (01.11.2026, K-33 / K-34 / K-35)

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

## 2. Migration geçmişi: canlı sonuç İÇERİKSİZ=21 — kök neden ve ayrım (K-35)

### 2.1 Sahibin ikinci canlı çıktısı (01.11, "Supabase Snippet Untitled query 4.csv")

`supabase/ops/canli_migration_gecmisi.sql` → **`İÇERİKSİZ=21, KAYITSIZ=10`, `AYNI=0`**; kayıt defteri 21 kayıt · en yeni
`20261001000001`. Beklenen `AYNI=21` **doğrulanmadı**: 21 kaydın hiçbirinde ifade listesi yok (adlar dolu).

**Düzeltme (K-34'te yanlış yazılanlar):** (1) "ilk 21 dosya Supabase CLI ile kaydedilerek uygulanmış görünüyor" — yanlış; CLI
kaydı ifadeleri doldurur. (2) "İÇERİKSİZ = `migration repair` ile işaretlenmiş" — kanıtsız bir varsayımdı ve yerel deneyle
çürütüldü (aşağıda).

### 2.2 Kök neden araştırması (kanıt; varsayım değil)

| # | Soru | Kanıt | Sonuç |
| --- | --- | --- | --- |
| 1 | CLI `db push` / `supabase start` kaydı nasıl? | Yerel: her kayıt dolu (ör. `20261002000001` → 30 ifade) | İÇERİKSİZ üretmez |
| 2 | CLI `migration repair --status applied` kaydı nasıl? | Yerel deney (CLI 2.122.0, canlı benzeri yığın): `repair` dosyayı okur, **ifadeleri doldurur (30)**, şema nesnesi oluşturmaz | Bu sürümde İÇERİKSİZ üretmez. (Eski CLI sürümleri denenmedi.) |
| 3 | Depoda `(version, name)` ile kayıt yazan bir şey var mı? | `supabase/demo/01_v1_schema.sql`, `02_v2_enums.sql`, `03_v2_stage3.sql`, `06_platform_updates.sql` (SQL Editor kurulum paketleri, `scripts/build-demo-sql.mjs` üretir): sonda `insert into supabase_migrations.schema_migrations (version, name) … on conflict do nothing` — **statements yazılmaz (NULL)** | İÇERİKSİZ ile birebir uyumlu tek mekanizma |
| 4 | Hangi paket sürümü canlıdaki listeyle örtüşüyor? | Git geçmişi: `06_platform_updates.sql`'in kayıt listesi **`d721428` (28.09)** sürümünde `20261001000001`'de biter; sonraki sürüm (`17a19b6`, 03.10) `20261002000001`'i ekler. 01/02/03 yalnız `f760625` (27.09) sürümü var | Canlının 21 kaydı = 01+02+03 (17) + 06@≤`d721428` (4) |
| 5 | O paketlerin içeriği depodaki migration'larla aynı mı? | Tarihî paketlerdeki 27 migration bölümü (`f760625` 01/02/03, `62c0614`/`86cd928`/`e1f64f4`/`d721428` 06) **bugünkü dosyalarla bayt bayt aynı** (`scripts/canli-denetim-prova.sh` 1. adım; CI'da her gönderimde) | İçerik farkı yok |
| 6 | Bu yol canlının çıktısını yeniden üretiyor mu? | Boş yerel yığına tarihî paketler SQL Editor gibi tek işlemde uygulandı → `canli_sema_tespiti`: 21 VAR / ilk eksik `20261002000001`; `canli_migration_gecmisi`: **`İÇERİKSİZ=21, KAYITSIZ=10`** — sahibin iki CSV'siyle aynı | Mekanizma yerelde yeniden üretildi |

**En olası kök neden (henüz canlıda doğrulanmadı):** canlı veritabanı, depodaki **demo kurulum paketleriyle** (SQL Editor) kurulmuş
ve güncellenmiş; kayıtlar bu paketlerin sonundaki `(version, name)` satırıyla yazılmış. Bu bir varsayım olarak bırakılır;
canlıda doğrulaması §2.4'teki köken sorgusudur. **Dikkat:** paketlerin başlığı "YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı
(production) veritabanında çalıştırmayın" der; doğrulanırsa production'ın bağlı olduğu veritabanı bir **demo kurulumudur**
(proje adı da `elvankent-demo`). Bu, KI-23'ün asıl sorusu olan "canlı DB kimliği"ne doğrudan bilgi verir (demo ilanları /
demo yönetici hesabı olup olmadığı ayrıca, veri okumadan, sahipçe değerlendirilmelidir).

### 2.3 İÇERİKSİZ = eksik uygulama mı, yalnız eksik geçmiş mi?

Ayırt edici özellik: demo paketleri her biri **tek SQL Editor sorgusu = tek işlem**dir ve kayıt satırı paketin **sonundadır**.
Kayıt satırı varsa, aynı işlemdeki bütün migration gövdeleri de işlenmiştir (biri hata verseydi işlem bütünüyle geri alınır, kayıt
da yazılmazdı). Yani kayıt, aynı işlemde yazıldıysa **eksiksiz uygulamanın** kanıtıdır; ayrı yazıldıysa hiçbir şey kanıtlamaz.
Bunu ölçmenin yolu PostgreSQL'in işlem numarası (`xmin`): kayıt satırını yazan işlemde oluşturulmuş sistem kataloğu satırları
(tablo, sütun, fonksiyon, politika, tür) bugün hâlâ duruyorsa kayıt şemayla aynı işlemde yazılmıştır.

- **ŞEMA İLE AYNI İŞLEM** → o gruptaki migration'lar eksiksiz uygulanmış (atomiklik); İÇERİKSİZ yalnız eksik geçmiş bilgisidir.
- **BELİRSİZ** (o işlemden katalog satırı kalmamış) → kanıt yok. Yerelde görüldü: 06'nın ilk sürümü sonraki 06 sürümleriyle
  yeniden çalıştırılınca (create or replace, drop/create policy) ilk işlemin bütün katalog satırları yenilenir. Bu gruptaki
  migration'lar için içerik kanıtı §2.5'teki parmak izidir.
- Yerel negatif: uygulama yapmadan elle yazılan kayıt → BELİRSİZ (yakalandı).

### 2.4 Köken sorgusu: `supabase/ops/canli_kayit_kokeni.sql` (tek SELECT, salt okunur, kişisel veri yok)

K1 demo işaret tablosu (`elvankent_demo.environment`, 01 paketinin oluşturduğu) var mı + kurulum tarihi · K2 kayıt tablosu
sütunları · K3 her kayıt: ad, statements NULL / boş dizi / sayı, işlem no · K4 her işlem grubu: o işlemde oluşturulup bugün duran
katalog satırı sayıları → ŞEMA İLE AYNI İŞLEM / BELİRSİZ · K5 demo işaretini oluşturan işlem hangi kayıt grubunun işlemi.

Yerel simülasyonda (tarihî paketlerle): K1 VAR · 21 kayıt statements NULL · 7 işlem grubunun 6'sı ŞEMA İLE AYNI İŞLEM, yeniden
çalıştırılan ilk 06 grubu BELİRSİZ · K5 işaret V1 grubuyla (`20260922000001…04`) aynı işlemde. CLI ile kurulmuş yığında ise
K1 YOK ve her kayıt dolu — iki yol çıktıdan ayırt edilir.

### 2.5 Şema ve güvenlik denetimi: `supabase/ops/canli_sema_denetimi.sql` (tek SELECT, salt okunur, yalnız sistem kataloğu)

- **G — mutlak kurallar (beklenen değere gerek yok; kiracı yalıtımına öncelik):** G1 RLS'i kapalı public tablo · G2 kiracı
  tablosunda (organization_id sütunlu) anon/herkese koşulsuz (`true`) okuma politikası · G3 `search_path`'i sabit olmayan
  SECURITY DEFINER fonksiyon · G4 RLS'i kapalı kiracı tablosunda anon yazma yetkisi. Herhangi biri = HATA, dur.
- **P — parmak izi (828 nesne):** 37 tablo (sütunlar, varsayılanlar, RLS/force bayrakları), 37 tablo yetkisi (anon /
  authenticated / service_role / PUBLIC), 82 politika (public + storage.objects; komut, roller, USING, WITH CHECK), 77 fonksiyon
  (tam tanım: gövde, SECURITY DEFINER, search_path), 77 fonksiyon yetkisi, 317 kısıt, 56 tetikleyici, 123 indeks, 18 enum,
  4 kova (herkese açık mı, boyut sınırı, MIME). Beklenen = migration'ları `20261001000001`'e kadar **Supabase CLI ile** uygulanmış
  yerel başvuru (`scripts/sema-denetimi-build.sh`). Sonuç: AYNI / FARKLI / EKSİK / FAZLA; yalnız AYNI olmayanlar yazılır.
- **Yöntemden bağımsızlık:** demo paketleriyle (SQL Editor) kurulmuş yerel veritabanında da **828/828 AYNI, G TAMAM**.
- **Negatif kontroller (geri alınan işlemlerde, CI'da her gönderimde):** RLS kapatma → G1 · kiracı tablosuna koşulsuz anon
  politika → G2 · fonksiyon gövdesi değişikliği → P FARKLI · sabitsiz SECURITY DEFINER → G3 · anon'a yazma yetkisi → P FARKLI ·
  uygulamasız elle kayıt → köken BELİRSİZ. Hepsi yakalandı.
- **Okuma notu:** tanımlar oturumun `search_path`'ine göre yazılır; çıktının özet satırında yol görünür (SQL Editor:
  `"$user", public, extensions`). PostgreSQL sürümü de yazılır (başvuru 17.11); farklı ana sürüm bazı ifadeleri farklı yazabilir.

### 2.6 Canlıya dokunmadan ikinci kaynak: KI-24 geri yükleme provası

`scripts/restore-drill.sh` 9. adım: geri yüklenen kopyanın kayıt defteri `20261001000001`'de bitiyorsa (canlının durumu)
`canli_sema_denetimi.sql` o kopyada çalışır; G HATA → ŞEMA HATA (çıkış 3), P sonucu `DENETIM_P=` satırı. Yerelde: demo
paketleriyle kurulmuş veritabanının yedeği → geri yükleme → **G TAMAM, P 828/828 AYNI**; RLS'i kapatılmış kopyanın yedeği →
ŞEMA HATA, çıkış 3. Gerçek yedekle bu adım ancak KI-24 gerçek provası **onaylanıp** çalıştırılınca sonuç verir (başlatılmadı).
Not: `xmin` geri yüklemede korunmaz; köken sorgusu yalnız canlıda anlamlıdır.

### 2.7 Karar kuralı (O-5a engeli)

O-5a için **İÇERİKSİZ engeli açık kalır** ve şu üçü sağlanmadan kalkmaz:
1. `canli_kayit_kokeni.sql` (canlı): K1 VAR ya da başka bir mekanizmayı gösteren açık kanıt; K4'te her grup ŞEMA İLE AYNI İŞLEM
   ya da BELİRSİZ gruplar için 2. madde.
2. `canli_sema_denetimi.sql` (canlı): G TAMAM ve P'de FARKLI / EKSİK / FAZLA yok (varsa her biri tek tek açıklanır).
3. KI-24 gerçek provası (sahip onayıyla): 9. adım `DENETIM_G=TAMAM`, `DENETIM_P=AYNI`.
Kayıt defterini "düzeltmek" (statements doldurmak, repair) bu planın parçası değildir ve ayrı onay gerektirir.

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

## 6. Sahipten istenen sıradaki şey

İki salt okunur sorgu, SQL Editor'de, birer kez: `supabase/ops/canli_kayit_kokeni.sql` ve `supabase/ops/canli_sema_denetimi.sql`
(ikincisi uzun bir dosyadır; tamamı yapıştırılır). Çıktılar CSV olarak. Migration uygulamak ya da kayıt defterini düzeltmek
ayrı ve açık onay gerektirir; bu çıktılar gelmeden ve §2.7 sağlanmadan O-5a önerilmez.
