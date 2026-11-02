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

## 7. Telefonsuz çalıştırma: GitHub Actions salt okunur denetimi (K-36, 01.11.2026; HENÜZ ÇALIŞTIRILMADI)

`canli_sema_denetimi.sql` ≈ 84 KB; Android'de Supabase SQL Editor yapıştırınca donuyor. Aynı denetim (kapsam aynı: 828 nesne
+ G1–G4) GitHub Actions'ta çalışacak şekilde hazırlandı:

| Parça | Görev |
| --- | --- |
| `.github/workflows/elvankent-ki23-canli-denetim.yml` | Yalnız sahibin elle tetiklemesi (aşağıda); `contents: read`; tek sır `SUPABASE_DB_URL`; denetim dosyası SHA-256 ile sabit; `persist-credentials: false`; artifact yok |
| `scripts/ki23-canli-denetim.sh` | Maskeleme (adres, kullanıcı, parola, ana makine, port) → SHA kontrolü → bekçi → oturum `PGOPTIONS=-c default_transaction_read_only=on` (+ statement/lock/idle zaman aşımları) ile AÇILIR, ilk sorgu yalnız ayarları okur, `on` değilse denetim gönderilmez → denetim → günlüğe yalnız sayılar |
| `scripts/ki23-denetim-guard.mjs` | Bağlanmadan önce: tek ifade, WITH … SELECT; yazma/DDL/ayar/işlem/dosya/süreç komutu, dolar gövdesi, satır içi yorum, psql meta komutu yok |
| `ops-requests/ki23-canli-denetim.request` | Tetik dosyası; depoda `# CALISTIR=evet` (kapalı) |

**Günlükte görünen (yalnız):** onaylı dosya özeti (ilk 12 hane), "oturum salt okunur başladı", PostgreSQL ana sürümü, search_path
SQL Editor ile aynı mı (evet/hayır), G1–G4 kural başına TAMAM / "HATA — n nesne", 10 kategori için AYNI/FARKLI/EKSİK/FAZLA sayısı,
toplam ve SONUÇ. Hata olursa yalnız sınıf: kimlik doğrulama / ana makine / zaman aşımı / bağlantı / havuzun PGOPTIONS reddi /
SQLSTATE. **Görünmeyen:** nesne adları, fonksiyon gövdeleri, kayıt içeriği, bağlantı adresi, kullanıcı, parola, ham hata metni.
Çıkış: 0 TAMAM · 4 bulgu var · 2 dosya/bekçi reddi · 3 bağlantı/oturum/SQL hatası.

**Tetikleme (yalnız sahip):** iş akışı yalnız (a) sahibin GitHub web'den `ops-requests/ki23-canli-denetim.request` dosyasında
`CALISTIR=evet` satırını açarak yaptığı düzenlemeyle (çalışma dalı) ya da (b) workflow_dispatch ile başlar; işi yapan koşul
`github.actor == repository_owner` ve commit mesajında `Claude-Session:` olmaması. Geliştirme oturumunun gönderimleri (bu dosyayı
ekleyen gönderim dahil) "skipped" olur; istek dosyası kapalıyken iş bağlanmadan durur. İsteğe bağlı ek kapı: Settings ›
Environments › `ki23-canli-denetim` › Required reviewers (tanımlanmazsa GitHub ortamı ilk çalışmada korumasız oluşturur).

**Varsayılan dal sorusu:** (a) yolu varsayılan dala almadan çalışır (aynı desen: `elvankent-restore-drill` çalışma dalındaki
gönderimle tetiklendi, #1 skipped). "Run workflow" düğmesi (b) ise GitHub'da yalnız iş akışı **varsayılan dalda** iken görünür;
varsayılan dal = production dalı ve oraya gönderim Vercel production dağıtımını tetikler → bu iş kapsamında YAPILMADI; ayrı onay
konusudur. Alternatifler: (1) istek dosyası (önerilen; şimdi hazır), (2) iş akışını ileride production'a alınacak bir sürümle
birlikte varsayılan dala almak (ayrı yayın onayı), (3) GitHub API ile dispatch — o da varsayılan dalda dosya ister.

**Sentetik doğrulama (yerel + CI, `scripts/ki23-canli-denetim-test.sh`, `canli-denetim-prova.sh` 4b. adım):** tarihî demo
paketleriyle kurulmuş canlı benzeri yığında, ayrı test rolüyle: T1 temiz → 0, G1–G4 TAMAM, 828 AYNI, günlükte parola/rol/adres/
port/fonksiyon gövdesi/nesne adı yok · T2 RLS kapalı + koşulsuz anon politika → 4, G1/G2 sayıları, ad yok · T3 onaysız dosya → 2,
bağlantı yok · T4 yazma komutlu kopya → bekçi 2 · T5 yanlış parola → 3 "kimlik doğrulama", parola yok · T6 kapalı port → 3, adres
yok · T7 betiğin PGOPTIONS'ıyla yazma → SQLSTATE 25006 · T8 GitHub maskeleri · T9 RLS'i aşamayan rol → `storage.buckets` görünmez,
kova EKSİK ayrıca "görünmüyor olabilir" diye işaretlenir.

**Bilinen risk:** Supabase bağlantı havuzunun (pooler) `options` başlangıç parametresini kabul edip etmediği yerelde sınanamaz.
Kabul etmezse ya da sessizce yok sayarsa iş, denetimi GÖNDERMEDEN "oturum salt okunur başlamadı / havuz PGOPTIONS'ı kabul etmedi"
ile durur (çıkış 3). Bu durumda farklı bir yöntem (ör. oturum içinde ayarla salt okunur) ayrı onayla değerlendirilir.

### 7.1 İki güvenlik iyileştirmesi (K-37, sahip isteği; HÂLÂ ÇALIŞTIRILMADI)

1. **Tek bağlantı, tek işlem.** Ayar kontrolü ile denetim artık aynı `psql` bağlantısında, aynı işlemdedir:
   `BEGIN READ ONLY` → aynı işlemde `default_transaction_read_only` ve `transaction_read_only` okunur → ikisi de `on` ise denetim
   dosyası `\i` ile aynı işlemde çalışır, değilse hiç dahil edilmez → `ROLLBACK`. `ON_ERROR_STOP`: herhangi bir hata işlemi bırakır,
   betik çıkış 3 ile ve yalnız güvenli sınıfla durur. Yazmayı iki bağımsız katman engeller (bağlantı başlangıcındaki
   `default_transaction_read_only=on` ve `BEGIN READ ONLY`); sentetik T12 yalnız ikincisinin de yettiğini gösterir.
2. **Tek kullanımlık tetik.** Push'ta `scripts/ki23-tetik-kontrol.sh` önceki ve yeni commit'teki istek dosyasını karşılaştırır:
   yalnız `CALISTIR=evet` satırının **kapalıdan açığa** geçtiği gönderim çalışır. Satır açıkken yapılan sıradan düzenlemeler,
   satırın kapatılması ve Actions'taki "Re-run" (`github.run_attempt == 1` koşulu) yeni denetim başlatamaz; önceki commit geçmişte
   yoksa (zorla gönderim) güvenli tarafta kalınır. Yeniden çalıştırmak için sahip satırı kapatıp (commit) yeniden açar (commit).

Kapsam (828 nesne + G1–G4), günlük gizliliği ve SHA-256 sabitlemesi değişmedi (denetim dosyası aynı; özet aynı).
Yeni sentetik testler: T10 havuz PGOPTIONS'ı yok sayarsa denetim dahil edilmez · T11 bekçiyi atlatmış yazma aynı işlemde 25006 ·
T12 yalnız BEGIN READ ONLY ile de 25006 · T13 yarıda hata → çıkış 3, yalnız SQLSTATE. Birim KT-10: tetik kuralı geçici git
deposunda 11 durumla (kapalı→açık, açık→açık, kapanış, kapat-yeniden aç, çok commit'li gönderim, yeni dal, bilinmeyen geçmiş, geçersiz girdi).

### 7.2 Canlı çalışma #4 ve düzeltme (K-38)

**#4 (sahip tetikledi, sahibin bağımsız günlük incelemesi):** tek kullanımlık tetik başarılı; bağlantı kuruldu;
`default_transaction_read_only=off`, `transaction_read_only=on`; betik denetim SQL'ini GÖNDERMEDEN çıkış 3 ile durdu (eski kural
ikisini birden istiyordu). Yani Supabase bağlantı havuzu `PGOPTIONS` başlangıç ayarını iletmiyor; `BEGIN READ ONLY` ise
işlemi salt okunur yapıyor. Canlıda hiçbir şey yazılmadı, denetim çalışmadı. CI #154: KT-09 istek dosyasını kapalı beklediği için
kırmızıydı (sahibin açması normal kullanım).

**Düzeltme:** güvenlik kapısı artık aynı bağlantıdaki gerçek işlemin `transaction_read_only` değeridir (`BEGIN READ ONLY` sonrası,
aynı işlemde okunur). `on` ise denetim aynı işlemde çalışır ve `ROLLBACK` ile biter; `off` ise denetim kesinlikle dahil edilmez
(çıkış 3). `default_transaction_read_only` yalnız bilgi olarak yazılır ("havuz başlangıç ayarını iletmedi; koruma BEGIN READ ONLY").
`PGOPTIONS` yine gönderilir (iletilirse ikinci katman). Yeni sentetik testler: T14 uçtan uca varsayılan off / işlem on (havuz
davranışı bağlantı adresindeki `options` ile taklit edildi) → denetim çalışır, 828 AYNI · T15 işlem salt okunur değil → denetim dahil
edilmez, hiçbir şey oluşmaz · T10 güncellendi. KT-09: istek dosyası açık ya da kapalı olabilir (tek CALISTIR satırı, sır yok);
tek kullanımlık kural (KT-10) ve geliştirme commit'lerinin dışlanması aynen. İstek dosyası yeniden **kapalı**.

## 8. KI-23 #6: 77 fonksiyon FARKLI — kök neden araştırması (K-39, 02.11.2026; canlıya yeni sorgu gönderilmedi)

**Canlı #6 (sahibin aktardığı):** 828 nesne; 751 AYNI, 77 FARKLI; farkların hepsi `fonksiyon` kategorisinde; fonksiyon yetkileri
77/77 AYNI; G1–G4 TAMAM; search_path beklenenle aynı; PostgreSQL 17.

**Yerel kanıtlar (yalnız yerel veritabanları):**

| # | Deney | Sonuç |
| --- | --- | --- |
| 1 | Başvurudaki 77 fonksiyonun profili | 77'sinin de gövdesi çok satırlı; 77'sinde de `SET` ayarı var; yalnız 18'inde ASCII dışı karakter, 11'inde yorum, 0'ında satır sonu boşluğu |
| 2 | Bu profille her adayın tahmini | Unicode normalleştirme (en çok 18) ve yorum ayıklama (en çok 11) tek başına 77'yi açıklayamaz; satır sonu boşluğu kırpma 0 fark üretir → **elendi**. 77'yi açıklayabilenler: (a) satır sonu biçimi (CRLF), (b) tüm fonksiyonlarda ortak bir başlık/SET biçim farkı |
| 3 | Aynı tarihî demo paketleri (`f760625` 01–04, 06 dört sürüm) **CRLF** satır sonlarıyla, SQL Editor gibi tek işlemde boş yığına | Denetim: **751 AYNI, 77 FARKLI yalnız fonksiyon, fonksiyon yetkileri 77 AYNI, G TAMAM** — canlı #6 ile birebir aynı desen |
| 4 | CRLF kurulumu ↔ CLI başvurusu, fonksiyon bazında | Ham gövde 0/77 aynı; **`\r` çıkarılınca gövde 77/77 aynı**; başlık (dil, oynaklık, definer, strict, leakproof, paralel, maliyet, dönüş, argümanlar, SET) **77/77 aynı**; `pg_get_functiondef` `\r` çıkarılınca 77/77 aynı |
| 5 | Davranış: başvuru gövdelerinde satır sonu içeren dize sabiti var mı (sözcük çözümleyici taraması) | **0/77** → CRLF'deki `\r` yalnız boşluk/yorum konumlarına düşer; PostgreSQL/PL/pgSQL çözümleyicisi bunları boşluk sayar → davranış aynı |
| 6 | LF ile kurulmuş demo yolu (K-35) | 828/828 AYNI — kurulum yöntemi (SQL Editor/paket) tek başına fark üretmez; fark satır sonu biçimine bağlı |

**Sonuç (kesinlik derecesiyle):** CRLF ile kurulmuş bir veritabanının canlı #6'daki deseni *tam olarak* ürettiği ve bu durumda farkın
davranışsız (yalnız biçim) olduğu **yerelde kanıtlandı**. Canlının farkının gerçekten CRLF olduğu ise **henüz kanıtlanmadı**
(aday (b) canlı veri olmadan elenemez). Canlıda bunu kesinleştirecek salt okunur ölçüm hazırlandı, ÇALIŞTIRILMADI.

**Hazırlanan teşhis (`supabase/ops/canli_fonksiyon_teshis.sql`, sahip onayıyla aynı Actions iş akışında):** tek SELECT, yalnız
`pg_proc`/`pg_language`; her fonksiyon için başlık, ham gövde ve `\r` çıkarılmış gövde özetleri başvuruyla karşılaştırılır; yalnız
SAYILAR döner (ad, gövde yazılmaz). Denetimle aynı salt okunur işlemde, ikinci SHA-256 sabiti ve bekçiyle. Karar kuralı:
başlık 77/77 ve CR'siz gövde 77/77 AYNI → "TAMAM (biçim farkı)" (çıkış 0); aksi → "AÇIKLANAMIYOR" (çıkış 4). Yerel doğrulama:
LF kurulumu → hepsi AYNI; CRLF → başlık 77, ham 0, CR'siz 77 → TAMAM (biçim farkı); bir gövde değişince CR'siz 76 → çıkış 4;
bir başlık (oynaklık) değişince başlık 76 → çıkış 4. KI-24 gerçek provasında da aynı teşhis 9. adımda çalışır
(`DENETIM_FONKSIYON=AYNI|BICIM|ACIKLANAMAZ`). Fonksiyonlar otomatik değiştirilmez; CRLF "düzeltmesi" gerekmiyor (davranış aynı) —
istenirse O-5 sırasında fonksiyonlar LF ile yeniden oluşturulabilir (ayrı karar).

### 8.1 Canlı sonuç — Actions #8 (02.11.2026 05:24 UTC, sahip tetikledi)

`SONUÇ: TAMAM (biçim farkı)`. G1–G4 TAMAM; P: 751 AYNI, 77 FARKLI (yalnız fonksiyon), EKSİK/FAZLA 0; search_path SQL Editor ile aynı;
PostgreSQL 17; varsayılan salt okunur ayar off (havuz iletmiyor), işlem salt okunur on. **Fonksiyon teşhisi:** beklenen 77, eşleşen imza
77, başlık AYNI 77, gövde ham AYNI 0, **CR çıkarılınca AYNI 77**, CR içeren gövde 77, beklenmeyen 0. → Canlıdaki 77 fonksiyon farkının
yalnız satır sonu biçimi (CRLF) olduğu artık **canlıda kanıtlandı**; tanımlar ve davranış başvuruyla aynı.

**§2.7 karar kuralının durumu:** (2) şema/güvenlik denetimi ✓ (G TAMAM; tüm P farkları açıklandı). (1) köken sorgusu — bekliyor.
(3) KI-24 gerçek provası 9. adım — bekliyor (sahip onayı). O-5a engeli bu ikisi gelene kadar açık.

### 8.2 Köken sorgusu canlı sonucu (02.11.2026, sahip, SQL Editor, "query 7" CSV) — §2.7 koşul 1 ✓

| Satır | Canlı sonuç |
| --- | --- |
| K1 demo işareti | **VAR · kurulum 2026-09-27** — canlı veritabanı `supabase/demo` paketleriyle kurulmuş (§2.2 varsayımı **doğrulandı**) |
| K2 | `version:text, statements:ARRAY, name:text` (paketlerin oluşturduğu tablo) |
| K3 | 21 kaydın hepsi `statements NULL` |
| K4 | 4 işlem grubu, **hepsi ŞEMA İLE AYNI İŞLEM**: 1212 (V1, 4 kayıt; pg_class 57 · pg_attribute 444 · pg_type 40) · 1222 (enum, 1; pg_type 2) · 1223 (V2+Stage 3, 12; pg_class 160 · pg_attribute 806 · pg_proc 59 · pg_policy 78 · pg_type 68) · 2431 (06 paketi, 4; pg_class 25 · pg_attribute 79 · pg_proc 18 · pg_policy 4 · pg_type 4) |
| K5 | Demo işaret tablosu V1 grubuyla (1212) aynı işlemde |

**Yorum (kanıtlı):** her kayıt grubu, o grubun şema nesneleriyle **aynı veritabanı işleminde** yazılmış. Paketler tek işlemde çalıştığı
ve kayıt satırı paketin sonunda olduğu için, kaydın varlığı paketteki bütün migration gövdelerinin **eksiksiz** uygulandığını gösterir
(atomiklik). İlk üç grubun katalog sayıları yerel simülasyonla (tarihî paketler) **birebir aynı**. 06 paketi canlıda tek seferde
(`d721428` sürümü, 4 kayıt tek işlemde) çalıştırılmış; BELİRSİZ grup yok. → **İÇERİKSİZ = yalnız eksik geçmiş içeriği; eksik uygulama değil.**

**§2.7 durumu:** (1) köken ✓ · (2) şema/güvenlik denetimi ✓ (#8) · (3) KI-24 gerçek provası 9. adım — sahip onayı verildi (02.11),
çalıştırma bekleniyor. Üçüncüsü de olumlu çıkarsa O-5a engeli kalkar (O-5a'nın kendisi yine ayrı onay ister).

**Yönetişim bulgusu (karar sahibin):** production'ın bağlı olduğu veritabanı, başlığında "YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR"
yazan kurulum paketleriyle kurulmuş (`elvankent_demo.environment` tablosu canlıda var; proje adı `elvankent-demo`). Bu paketler
04 (12 demo ilan) ve 05 (demo yönetici) adımlarını da içerir; canlıda demo ilan/hesap kalıp kalmadığı veri okumadan bilinmiyor.
Teknik sorun değil (şema doğru), ama "demo" etiketli bir projenin production olarak kullanılması ayrıca değerlendirilmeli.
