# Demo ortamı kurulumu ve telefon kabul testi

Amaç: canlı sisteme hiç dokunmadan, telefondan açılabilen bir demo:

- `https://DEMO-ADRESI/` (ziyaretçi sitesi)
- `https://DEMO-ADRESI/admin/giris` (yönetim paneli)

Demo, canlıdan tamamen ayrı iki parçadan oluşur: **ayrı bir Supabase projesi** (`elvankent-demo`) ve **ayrı bir Vercel projesi** (`elvankent-demo`). Canlı Supabase projesinden veya canlı Vercel projesinden hiçbir değer kopyalanmaz.

> Kurulumu **bilgisayardan** yapın (kopyala-yapıştır adımları var). Süre: 30–45 dakika. Telefon yalnızca testte kullanılır.

---

## Kim ne yapar

| Kod tarafında hazır olanlar | Sizin hesaplarınızda yapmanız gerekenler |
| --- | --- |
| `supabase/demo/01…05` SQL dosyaları: migration'lar doğru sırada; 12 DEMO ilan; yönetici yetkisi | Supabase'de yeni `elvankent-demo` projesini açmak |
| SQL dosyalarında koruma: 01 yalnızca **boş** veritabanında çalışır ve veritabanını "DEMO" olarak işaretler. 02–05 bu işaret yoksa hiçbir şey yapmadan durur. Canlı veritabanında yanlışlıkla çalıştırılsalar bile hata verip dururlar. | 5 SQL dosyasını SQL Editor'de sırayla çalıştırmak |
| `SITE_ENV=demo`: bütün sayfalarda `noindex`, robots.txt'de site haritası yok, "DEMO ORTAMI" şeridi görünür | Demo yönetici kullanıcısını ve şifresini oluşturmak |
| `*.vercel.app` adresleri otomatik olarak varsayılan ofise (Elvankent) bağlanır | Vercel'de yeni `elvankent-demo` projesini açmak ve ortam değişkenlerini girmek |
| Demo görselleri kodun içinde (`public/demo`), ayrıca yükleme gerekmez | Supabase Auth adres ayarlarını yapmak |
| Yerelde prova edildi: boş veritabanına 01→05 tek sorgu olarak uygulandı, 12 ilan ve yönetici oluştu, koruma testleri geçti | Telefon kabul testi |

---

## ⚠️ Başlamadan önce: mevcut canlı Vercel projeniz

V1 için daha önce bir Vercel projesi oluşturduysanız (ör. `elvankentgayrimenkul.com`):

1. Açın: Vercel › o proje › **Settings › Environments › Production › Branch Tracking**.
2. Orada `claude/elvankent-real-estate-platform-vxq9dj` yazıyorsa bu dala yapılan her gönderim canlıya dağıtılır. Bu durumda V2 kodu canlıdaki V1 veritabanıyla çalışıyor olabilir.
3. Böyle bir durum varsa demoya geçmeden bana yazın. Canlı projede hiçbir şeyi değiştirmeyin.

Demo için **o projeyi kullanmayın**. Aşağıda yeni bir proje açılıyor.

---

## Adım 1 — Supabase demo projesi

### 1.1 Proje oluşturma
[supabase.com/dashboard](https://supabase.com/dashboard) › **New project**

| Alan | Değer |
| --- | --- |
| Organization | kendi organizasyonunuz |
| Project name | `elvankent-demo` |
| Database password | **Generate a password** → parola yöneticinize kaydedin (demo kurulumunda tekrar gerekmez) |
| Region | **Central EU (Frankfurt)** |
| Plan | Free |
| Security / Data API seçenekleri (görünürse) | varsayılanları değiştirmeyin (Data API **açık** kalmalı) |

**Create new project** → proje hazır olana kadar 1–2 dakika bekleyin.

> Bundan sonraki her ekranda sol üstte proje adının **elvankent-demo** olduğunu kontrol edin.

### 1.2 Veritabanını kurma: SQL dosyalarını sırayla çalıştırma

Dosyaları sırayla açın. Her biri için:

1. Linki açın, sayfanın tamamını seçip kopyalayın (Ctrl+A, Ctrl+C).
2. Supabase › **SQL Editor** › **+ New query** › yapıştırın › **Run**.

| Sıra | Dosya | Beklenen sonuç |
| --- | --- | --- |
| 1 | [01_v1_schema.sql](https://raw.githubusercontent.com/MUSTAFAKARA0/MUSTAFAKARA0/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/demo/01_v1_schema.sql) | `Success. No rows returned` |
| 2 | [02_v2_enums.sql](https://raw.githubusercontent.com/MUSTAFAKARA0/MUSTAFAKARA0/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/demo/02_v2_enums.sql) | `Success. No rows returned` |
| 3 | [03_v2_stage3.sql](https://raw.githubusercontent.com/MUSTAFAKARA0/MUSTAFAKARA0/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/demo/03_v2_stage3.sql) (büyük dosya, ~190 KB) | `Success. No rows returned` |
| 4 | [04_demo_seed.sql](https://raw.githubusercontent.com/MUSTAFAKARA0/MUSTAFAKARA0/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/demo/04_demo_seed.sql) | Sonuç tablosu (`set_config` → `on`) |

- **Her dosyayı ayrı bir sorgu olarak çalıştırın.** Dosyaları tek pencerede birleştirmeyin; 02'deki yeni değerler ancak ayrı çalıştırılınca kullanılabilir hâle gelir.
- Supabase "**Potential issue detected** / destructive operation" uyarısı gösterebilir. Dosyalarda `drop policy if exists` gibi satırlar olduğu için bu beklenen bir durumdur. Proje adının `elvankent-demo` olduğunu kontrol edip **Run this query** ile onaylayın.
- Bir dosya hata verirse **sonrakine geçmeyin**. Hata mesajını bana iletin. Her dosya kendi içinde bütündür: hata verirse değişiklikleri geri alınır.
- `DURDURULDU: …` mesajı korumanın devreye girdiğini gösterir. Çoğunlukla sıra yanlıştır ya da yanlış projedesinizdir.

**Kontrol**: yeni bir sorguda şunu çalıştırın:
```sql
select count(*) filter (where is_demo) as demo_ilan, count(*) as toplam from public.properties;
```
Sonuç `12 | 12` olmalı.

### 1.3 Auth ayarları

1. **Authentication › Sign In / Providers**:
   - **Email**: açık.
   - **Allow new users to sign up**: **KAPALI**. Panele yalnızca sizin oluşturduğunuz hesaplar girer.
   - Save.
2. **Authentication › Multi-Factor** (bazı arayüzlerde Sign In / Providers altında): **TOTP** "Enabled" olmalı (varsayılan).
3. **URL Configuration** ayarı demo adresi belli olunca yapılır (Adım 4).

### 1.4 API değerlerini not alma (Vercel'de kullanılacak)

**Project Settings › API Keys** (veya **Settings › API**):

| Supabase'deki ad | Vercel'deki değişken |
| --- | --- |
| Project URL: `https://xxxxxxxx.supabase.co` (Settings › Data API ya da API sayfasında) | `NEXT_PUBLIC_SUPABASE_URL` |
| **Legacy API keys** sekmesi › `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Legacy API keys** sekmesi › `service_role` `secret` (**Reveal**) | `SUPABASE_SERVICE_ROLE_KEY` |

- Tercihen **Legacy** anahtarları kullanın; test edilen yol budur.
- Yalnızca yeni tip anahtarlar varsa `sb_publishable_…` değerini ANON değişkenine, `sb_secret_…` değerini SERVICE_ROLE değişkenine yazın. Uygulama bunlarla da çalışacak şekilde yazıldı, ancak yerelde bu anahtar tipiyle test edilmedi.
- `service_role` / `secret` anahtarı gizlidir. Yalnızca Vercel'e girilir; sohbete, e-postaya veya koda yazılmaz.

---

## Adım 2 — Demo yönetici hesabı

### 2.1 Şifre
Parola yöneticinizin (Chrome/Google Parola Yöneticisi, 1Password, Bitwarden) üreticisiyle oluşturun: **en az 20 karakter**, harf ve rakam içersin. Şifreyi sohbete veya belgeye yazmayın.

### 2.2 Kullanıcıyı oluşturma
Supabase › **Authentication › Users** › **Add user** › **Create new user**:

| Alan | Değer |
| --- | --- |
| Email | erişebildiğiniz bir adres (ör. `adiniz+demo@gmail.com`). Şifre sıfırlama e-postası buraya gelir. |
| Password | 2.1'deki şifre |
| Auto Confirm User | **işaretli** |

**Create user**.

### 2.3 Yönetici yetkisi verme
1. [05_demo_admin.sql](https://raw.githubusercontent.com/MUSTAFAKARA0/MUSTAFAKARA0/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/demo/05_demo_admin.sql) içeriğini SQL Editor'de yeni bir sorguya yapıştırın.
2. Hiçbir satırı değiştirmeyin; dosya demo veritabanındaki tek kullanıcıyı kendisi bulur. Metnin sonuna bir kez tıklayın (seçili bir yer kalmasın) → **Run**.
3. Sonuç tablosunda `e-postanız | owner | true` görünmeli.

Bu hesap demo ofisinin **sahibi** olur ve `/platform` (süper admin) ekranına da erişir.

> Alternatif (terminal kullananlar için): `.env.local` içine **yalnızca demo** projesinin URL ve service_role değerlerini yazıp `npm run create-admin -- eposta@... --super-admin` çalıştırın. Betik güçlü bir şifre üretir ve bir kez gösterir.

---

## Adım 3 — Vercel demo projesi

**Neden ayrı proje?** Ortam değişkenleri projeye bağlıdır. Ayrı bir projede canlı Supabase anahtarlarının demoya karışma ihtimali yoktur. Ayrıca `elvankent-demo.vercel.app` adresi Vercel girişi istemeden telefondan açılır.

Vercel bu projenin ana adresine "Production" der. Bu yalnızca Vercel'in kullandığı terimdir: proje yalnızca demo veritabanına bağlıdır, `SITE_ENV=demo` ile arama motorlarına kapalıdır ve gerçek alan adınızla ilgisi yoktur.

### 3.1 Projeyi içe aktarma
> **Kurulumda karşılaşılan durumlar:** Vercel içe aktarırken deponun **varsayılan dalını** okur. Varsayılan dal başka bir projeyse içe aktarma ekranında o proje görünür ya da "404: NOT_FOUND" sayfası yayınlanır. Çözüm: projeyi oluşturduktan sonra Settings › **Build and Deployment**'da Framework Preset = **Next.js**, Root Directory = `elvankent-gayrimenkul`, Node.js = **22.x**; Settings › **Environments › Production › Branch Tracking** = `claude/elvankent-real-estate-platform-vxq9dj`; ardından dala yapılan ilk gönderim doğru yayını başlatır. Daha kalıcı çözüm: GitHub › Settings › Default branch'i bu dal yapmak.

[vercel.com/new](https://vercel.com/new) › **Import Git Repository**:
- `MUSTAFAKARA0/MUSTAFAKARA0` › **Import**.
- Depo listede görünmüyorsa **Adjust GitHub App Permissions** ile bu depoya erişim verin.

**Configure Project** ekranı:

| Alan | Değer |
| --- | --- |
| Project Name | `elvankent-demo` |
| Framework Preset | **Next.js** (otomatik seçilmezse listeden seçin) |
| Root Directory | Listede `elvankent-gayrimenkul` varsa seçin. **Görünmeyecektir**, çünkü deponun varsayılan dalında bu klasör yok. Şimdilik değiştirmeyin; 3.3'te ayarlanacak. |
| Build / Output / Install Settings | değiştirmeyin |

**Environment Variables** bölümüne aşağıdaki tabloyu girin (hepsi **demo** değerleri):

| Key | Value |
| --- | --- |
| `SITE_ENV` | `demo` |
| `NEXT_PUBLIC_SUPABASE_URL` | 1.4'teki Project URL (`https://xxxxxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1.4'teki anon / publishable anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | 1.4'teki service_role / secret anahtar |
| `NEXT_PUBLIC_SITE_URL` | `https://elvankent-demo.vercel.app` (Vercel farklı bir adres verirse 3.5'te düzeltilir) |
| `DEFAULT_TENANT_SLUG` | `elvankent` |
| `IP_HASH_SALT` | rastgele, en az 32 karakter (parola yöneticisi üreticisi veya `openssl rand -hex 32`) |
| `CRON_SECRET` | rastgele, en az 32 karakter; `IP_HASH_SALT` değerinden **farklı** olmalı |
| `EMAIL_PROVIDER` | `none` |
| `MAP_PROVIDER` | `osm` |

- **Eklemeyin:** `RESEND_API_KEY`, `SENTRY_DSN`, `ERROR_WEBHOOK_URL`, `VERCEL_API_TOKEN`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, ve canlı projeye ait hiçbir değer.
- Proje oluştuktan sonra Settings › Environment Variables'da `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT` ve `CRON_SECRET` için **Sensitive** seçeneğini açın.

**Deploy** → Bu ilk dağıtım varsayılan daldan yapıldığı için **başarısız olacak** ("No Next.js version detected" benzeri bir hata). Bu beklenen bir durumdur. Proje oluştu; devam edin.

### 3.2 Doğru dalı bağlama
Proje › **Settings › Environments › Production** › **Branch Tracking** → `claude/elvankent-real-estate-platform-vxq9dj` → **Save**.

### 3.3 Kök klasör ve Node sürümü
Proje › **Settings › Build and Deployment**:
- **Root Directory**: `elvankent-gayrimenkul` → Save.
- **Node.js Version**: `22.x` → Save.
- **Ignored Build Step** (isteğe bağlı, önerilir): **Only build production**. Diğer dallar bu projede boşuna derlenmez.

### 3.4 Dağıtımı başlatma
Proje › **Deployments** › sağ üstteki **⋯** veya **Create Deployment**:
- Dal olarak `claude/elvankent-real-estate-platform-vxq9dj` yazın → **Create Deployment**.
- Bu seçenek yoksa bana "demo deploy tetikle" yazın. Dala küçük bir belge commit'i gönderirim ve Vercel dağıtımı kendiliğinden başlar.

Derleme 3–5 dakika sürer. Durum **Ready** olmalı.

### 3.5 Demo adresini kesinleştirme
Proje › **Settings › Domains**: `…​.vercel.app` ile biten adres **demo adresinizdir** (ör. `elvankent-demo.vercel.app`).
- Adres `NEXT_PUBLIC_SITE_URL` değerinden farklıysa (ör. `elvankent-demo-abc.vercel.app`): Settings › Environment Variables › `NEXT_PUBLIC_SITE_URL` değerini düzeltin → Deployments › son dağıtım › **⋯ › Redeploy**. Bu değer derleme sırasında okunduğu için yeniden dağıtım gereklidir.
- Telefonda **yalnızca bu adresi** kullanın. Dağıtıma özel uzun adresler (`elvankent-demo-8f3k…-hesap.vercel.app`) Vercel girişi ister; bu normaldir.

---

## Adım 4 — Supabase adres ayarları

Supabase (elvankent-demo) › **Authentication › URL Configuration**:

| Alan | Değer |
| --- | --- |
| Site URL | `https://DEMO-ADRESI` (3.5'teki adres) |
| Redirect URLs › Add URL | `https://DEMO-ADRESI/admin/auth/callback` |

Save.

---

## Adım 5 — Kurulum kontrolü (telefondan da yapılabilir)

| Adres | Beklenen |
| --- | --- |
| `https://DEMO-ADRESI/api/health` | `{"status":"ok","db":"ok",…}` |
| `https://DEMO-ADRESI/robots.txt` | son satır `# Demo / önizleme ortamı: dizine eklenmez`; **`Sitemap:` satırı yok** |
| `https://DEMO-ADRESI/` | üstte sarı **DEMO ORTAMI** şeridi |

### Sorun giderme

| Belirti | Neden / çözüm |
| --- | --- |
| Derleme hatası "No Next.js version detected" / "package.json not found" | Root Directory (3.3) veya dal (3.2) yanlış |
| `/api/health` → `503` / `"db":"error"` | Supabase URL veya anahtarı yanlış, ya da 01–03 çalıştırılmamış. Değişkeni düzeltince **Redeploy** gerekir. |
| Site açılıyor ama ilan yok | 04 çalıştırılmamış (1.2'deki kontrol sorgusu `12` vermeli) |
| Girişte "E-posta veya şifre hatalı" | 2.2'de "Auto Confirm User" işaretlenmemiş veya şifre farklı. Authentication › Users › kullanıcı › **Send password recovery** ya da kullanıcıyı silip yeniden oluşturun. |
| Giriş oluyor ama panel açılmıyor / yetki hatası | 05 çalıştırılmamış veya e-posta yanlış yazılmış |
| Telefonda Vercel giriş ekranı çıkıyor | Dağıtıma özel adres açılmış; 3.5'teki alan adını kullanın |
| DEMO şeridi yok | `SITE_ENV=demo` eksik veya yanlış yazılmış; düzeltip **Redeploy** |

---

## Telefon kabul testi

Adres: `https://DEMO-ADRESI` · Panel: `https://DEMO-ADRESI/admin/giris`

Formlarda **gerçek kişi bilgisi kullanmayın**. Örnek: "Test Kişi", `0555 000 00 00`, `test@example.com`.

**0. Hazırlık (bir kez)**
- [ ] `/admin/giris` ile girin › **Şirket ayarları** › Telefon ve WhatsApp alanlarına **örnek** `0555 000 00 00` yazın › Kaydet.
  Yeni demo veritabanında iletişim numarası yoktur; numara girilmezse ilan sayfasında WhatsApp ve Ara butonları görünmez (bu doğru davranıştır).
- [ ] Çıkış yapın, ziyaretçi testlerine geçin.

**A. Genel**
1. [ ] Ana sayfa: sarı **DEMO ORTAMI** şeridi görünüyor; sayfa yana kaymıyor.
2. [ ] `/robots.txt`: `Sitemap:` satırı yok, "dizine eklenmez" notu var (noindex).
3. [ ] Menü açılıp kapanıyor; alt bilgideki bağlantılar çalışıyor.

**B. İlanlar (toplam 12 DEMO ilan)**
4. [ ] `/satilik`: **8** ilan (5 konut, 1 ticari, 2 arsa).
5. [ ] `/kiralik`: **4** ilan (2 konut, 2 ticari).
6. [ ] Tüm ilan başlıkları "DEMO –" ile başlıyor.
7. [ ] Ana sayfa arama kutusu (Satılık/Kiralık, konum, tip, oda, bütçe) → sonuç sayfası.
8. [ ] Filtreler paneli: oda sayısı ve fiyat uygulanıyor; "Temizle" çalışıyor; sıralama değişiyor.
9. [ ] Sonuç çıkmayan bir aramada boş durum mesajı ve filtreleri temizleme seçeneği görünüyor.

**C. İlan detayı ve galeri**
10. [ ] Başlık, fiyat, özellikler, açıklamadaki "Bu bir DEMO ilandır" notu, harita (yaklaşık konum).
11. [ ] Galeri: parmakla kaydırma; dokununca tam ekran; iki parmakla yakınlaştırma; kapatma.
12. [ ] WhatsApp butonu uygulamayı hazır mesajla açıyor; Ara butonu telefon uygulamasını açıyor (örnek numara; göndermeden/aramadan kapatın).
13. [ ] Paylaş butonu telefonun paylaşım menüsünü açıyor.

**D. Favoriler ve karşılaştırma**
14. [ ] İki ilanı favoriye ekleyin → `/favoriler` listesinde görünüyorlar.
15. [ ] İki ilanı karşılaştırmaya ekleyin → `/karsilastir` tablosu yan yana gösteriyor; temizleme çalışıyor.

**E. İletişim formları**
16. [ ] İlan detayında bilgi formu: boş gönderince hata mesajları; doldurunca "Teşekkürler".
17. [ ] Randevu formu (ilan detayı) ve `/iletisim` formu gönderiliyor.
18. [ ] Formu doldururken açılan klavye alanları kapatmıyor.

**F. Yönetim paneli**
19. [ ] `/admin/giris`: yanlış şifre reddediliyor; doğru şifreyle panel (Dashboard) açılıyor.
20. [ ] **Talepler**: 16–17'de gönderdiğiniz talepler listede; menüde "yeni" rozeti görünüyor; talebi açın, durum değiştirin, not ekleyin.
21. [ ] **Müşteriler**: formdan gelen test kişisi oluşmuş. **Randevular**: randevu talebi görünüyor.
22. [ ] **İlanlar › Yeni ilan**: sihirbaz; konum seçimi (il/ilçe/mahalle); **telefondan fotoğraf yükleme** (kamera veya galeri); sıralama; kapak seçimi; fiyat; **Yayınla** → ilan sitede görünüyor.
23. [ ] Mevcut bir demo ilanı düzenleyin, durumunu "Satıldı" yapın → sitede rozet görünüyor.
24. [ ] **Koleksiyonlar**: 2 ilanlık bir seçki oluşturun, bağlantısını telefonda açın.
25. [ ] **Hesabım › İki adımlı doğrulama**: Google Authenticator ile kurun, çıkış yapıp tekrar girişte kod isteniyor.
26. [ ] **Ayarlar**, **Şirket ayarları**, **Kullanıcılar**, **Güvenlik kayıtları** sayfaları açılıyor; yana kayma yok.
27. [ ] `/platform` (süper admin): organizasyonlar listesi açılıyor.

**G. Ayrım kontrolü**
28. [ ] Demo sitede gerçek ilanınız, müşteriniz veya gerçek telefon/e-posta bilginiz **görünmüyor**. Yalnızca şirket adı, genel tanıtım metni ve sizin girdiğiniz örnek numara var.

Her sorun için şunları iletin: **test numarası + sayfa adresi + telefon modeli/tarayıcı + ekran görüntüsü**. Önce bunlar düzeltilir, yeni özelliğe geçilmez.

---

## Bilinen sınırlamalar (demo)

- İlanlar ve görseller örnektir; demo arama motorlarına kapalıdır.
- E-posta bildirimi kapalıdır (`EMAIL_PROVIDER=none`); talepler panelde görünür.
- Şifre sıfırlama e-postaları Supabase'in varsayılan servisiyle gider; saatte birkaç e-postayla sınırlıdır.
- Harita OpenStreetMap döşemeleriyle çalışır (demo için yeterli).
- Supabase Free planında proje 7 gün kullanılmazsa duraklatılır; panelden **Restore** ile geri açılır.
- Vercel'in ücretsiz (Hobby) planı demo için uygundur. Ticari canlı kullanım için Pro plan gerekir (Vercel kullanım koşulları).
- Demo projesinde de her gece bir temizlik görevi (`vercel.json` cron) yalnızca demo veritabanında çalışır.

## Demoyu kaldırma

Supabase › elvankent-demo › Settings › General › **Delete project**, ardından Vercel › elvankent-demo › Settings › **Delete Project**. Canlı sistem etkilenmez.

## Kod değişirse (geliştirici notu)

`supabase/demo/01–04` dosyaları `npm run demo:sql` ile `supabase/migrations` ve `supabase/seed.sql`'den üretilir; CI güncel olup olmadıklarını kontrol eder. Demo veritabanı kurulduktan sonra eklenecek yeni migration'lar Supabase CLI ile uygulanabilir: `supabase db push` yalnızca eksik olanları çalıştırır, çünkü 01–03 migration geçmişini kaydeder.
