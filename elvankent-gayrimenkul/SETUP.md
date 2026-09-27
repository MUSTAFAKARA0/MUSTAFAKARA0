# Kurulum ve Canlıya Alma (V2)

Bu belge; mevcut V1 sitesini V2'ye yükseltmeyi, sıfırdan kurulumu ve yerel geliştirmeyi adım adım anlatır. Mimari ayrıntılar için [ARCHITECTURE.md](./ARCHITECTURE.md), panel kullanımı için [ADMIN_GUIDE.md](./ADMIN_GUIDE.md).

> **Önemli:** Veritabanı değişiklikleri geri alınması zor işlemlerdir. Aşağıdaki adımlara başlamadan önce **mutlaka yedek alın** (Supabase Dashboard › Database › Backups veya `pg_dump`).

---

## A. Mevcut canlı sistemi (V1) V2'ye yükseltme

### 1. Yedek alın

- Supabase Dashboard › **Database › Backups** bölümünden güncel yedeği doğrulayın (ücretsiz planda günlük yedek 7 gün saklanır), ya da:
  ```bash
  pg_dump "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" -Fc -f yedek-v1.dump
  ```

### 2. Migration'ları sırayla uygulayın

V1'de ilk dört dosya (`20260922000001…04`) zaten uygulanmıştır. **Bunları tekrar çalıştırmayın.** Yalnızca şu dosyaları **bu sırayla** uygulayın:

```
20260926000001_v2_enums.sql
20260926000002_v2_tenancy.sql
20260926000003_v2_properties.sql
20260926000004_v2_crm.sql
20260926000005_v2_content.sql
20260926000006_v2_audit.sql
20260926000007_v2_security.sql
20260926000008_v2_storage.sql
20260926000009_v2_reference_data.sql
20260927000001_v2_platform_fixes.sql
```

İki yöntem:

- **Supabase CLI (önerilir):** `supabase link --project-ref PROJE` ardından `supabase db push`. CLI hangi dosyaların uygulandığını takip eder, yalnızca eksik olanları çalıştırır.
- **SQL Editor:** her dosyanın içeriğini sırayla yapıştırıp çalıştırın. Bir dosya hata verirse **sonrakilere geçmeyin**; hatayı giderin.

Migration'lar V1 verisini korur ve taşır: ilanlar, fotoğraflar, iletişim talepleri, işletme ayarları ve yönlendirmeler varsayılan kiracıya (Elvankent Gayrimenkul) bağlanır. V1'deki yönetici hesapları varsayılan kiracının **sahibi (owner)** olur.

### 3. Ortam değişkenlerini güncelleyin (Vercel › Project Settings › Environment Variables)

Tam liste ve açıklamalar `.env.example` dosyasındadır. V1'e göre **yeni** olanlar:

| Değişken | Zorunlu | Gizli | Not |
| --- | --- | --- | --- |
| `DEFAULT_TENANT_SLUG` | Evet | Hayır | `elvankent` |
| `CRON_SECRET` | Evet | **Evet** | `openssl rand -hex 32` — günlük medya temizliği için |
| `PLATFORM_ROOT_DOMAIN` | Hayır | Hayır | SaaS alt alan adları için (ör. `platform.com`) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_URL` | Hayır | Hayır | Boşsa otomatik türetilir |
| `MAP_PROVIDER`, `MAP_API_KEY`, `MAP_STYLE`, `MAP_ATTRIBUTION` | Hayır | `MAP_API_KEY` gizli | Harita sağlayıcısı (V1'deki `MAP_TILE_URL` çalışmaya devam eder) |

`SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `CRON_SECRET`, `MAP_API_KEY` **asla** `NEXT_PUBLIC_` önekiyle tanımlanmaz.

### 4. Supabase Auth ayarları

Dashboard › **Authentication › URL Configuration**:

- **Site URL:** `https://elvankentgayrimenkul.com`
- **Redirect URLs:** `https://elvankentgayrimenkul.com/admin/auth/callback` (şifre sıfırlama bağlantıları bu adrese döner; özel alan adı eklenen her ofis için de ekleyin)

Önerilen: Authentication › Providers › Email'de **"Allow new users to sign up" kapalı** olsun (kullanıcılar panelden eklenir).

### 5. Dağıtım (deploy)

Kodu `main` dalına birleştirin (veya Vercel'de ilgili dalı yayınlayın). `vercel.json` içindeki günlük zamanlanmış görev (`/api/cron/media-cleanup`, 03:17 UTC) otomatik tanımlanır; Vercel `CRON_SECRET` değerini isteğe otomatik ekler.

### 6. Süper admin (platform yöneticisi) hesabı

Kendi bilgisayarınızda, `.env.local` içinde `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` tanımlıyken:

```bash
npm run create-admin -- sizin@eposta.com 'Guclu-Bir-Sifre-123' --super-admin
```

Bu komut hesabı varsayılan kiracıya **owner** olarak da ekler. Yalnızca platform yöneticisi olacaksanız `--no-org` ekleyin.

### 7. Canlıda kontrol listesi

- [ ] Ana sayfa, `/satilik`, bir ilan detayı ve `/iletisim` açılıyor.
- [ ] `/admin/giris` ile giriş yapılıyor; panel özeti geliyor.
- [ ] Bir ilana fotoğraf yüklenip işleniyor (4K dahil); ilan sitede görünüyor.
- [ ] İletişim formundan gönderilen test talebi **Talepler** ekranına düşüyor.
- [ ] `/sitemap.xml` ve `/robots.txt` açılıyor; Google Search Console'a site haritası gönderildi.
- [ ] **Güvenlik / Loglar** ekranında giriş kaydı görünüyor.
- [ ] Hukuki metinler (KVKK, gizlilik, çerez, kullanım koşulları) bir hukuk danışmanına gözden geçirtildi ve panelde "incelendi" onayı verildi.
- [ ] Demo ilanlar, gerçek ilanlar eklendikten sonra **Ayarlar › Demo ilanlar** ekranından kaldırıldı.

### Geri dönüş (acil durum)

Uygulama sürümünü Vercel'de önceki dağıtıma "Promote" ederek geri alabilirsiniz; ancak V2 veritabanı şeması V1 koduyla uyumlu **değildir**. Veritabanını geri almak gerekirse 1. adımdaki yedekten geri yükleme yapılır (yükseltmeden sonra girilen veriler kaybolur). Bu nedenle yükseltmeyi düşük trafikli bir saatte yapın.

---

## B. Sıfırdan kurulum (yeni proje)

1. [supabase.com](https://supabase.com) üzerinde yeni proje oluşturun (bölge: Frankfurt `eu-central-1` önerilir).
2. `supabase/migrations/` altındaki **tüm** dosyaları dosya adı sırasıyla uygulayın (`supabase db push` veya SQL Editor).
3. İsteğe bağlı: `supabase/seed.sql` ile **DEMO** olarak işaretli örnek ilanları ekleyin (gerçek mülk değildir; tekrar çalıştırılabilir).
4. `.env.example` → `.env.local` kopyalayıp doldurun; aynı değerleri Vercel'e girin.
5. Vercel'e bağlayıp yayınlayın; A.4–A.7 adımlarını uygulayın.

## C. Yeni bir emlak ofisi (kiracı) ekleme

1. Süper admin hesabıyla `/platform` › **Yeni organizasyon**: ad, kısa ad (alt alan adı), ilan no öneki, plan, sahip e-postası. Sahip hesabı yoksa geçici şifreyle oluşturulur ve şifre **yalnızca bir kez** gösterilir.
2. Özel alan adı kullanılacaksa: organizasyon sayfasında alan adını ekleyin (birincil işaretleyin), **Vercel › Domains** bölümüne aynı alan adını ekleyin ve DNS kaydını (CNAME/A) sağlayıcınızda tanımlayın. Supabase Auth › Redirect URLs listesine `https://ALANADI/admin/auth/callback` ekleyin.
3. Alt alan adı kullanılacaksa `PLATFORM_ROOT_DOMAIN` tanımlı olmalı ve Vercel'e joker alan adı (`*.platform.com`) eklenmelidir.
4. Ofis sahibi giriş yapıp **Şirket Ayarları**'ndan logo, renk ve iletişim bilgilerini girer.

## D. Yerel geliştirme

```bash
cp .env.example .env.local   # yerel veya test Supabase projesinin bilgileri
npm install
npm run dev                  # http://localhost:3000
```

Yerel Supabase kullanıyorsanız (`supabase start`), `.env.local` içinde `NEXT_IMAGE_ALLOW_LOCAL_IP=1` tanımlayın (yalnızca yerelde).

## E. Kalite kontrolleri

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint (React Compiler kuralları dahil)
npm run test:rls     # Güvenlik testleri (kendi geçici test ofislerini oluşturup siler)
npm run test:e2e     # Playwright (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD gerekir)
npm run build        # Production build
npm run check        # typecheck + lint + build
npm run db:types     # Veritabanı şemasından TypeScript tipleri (DATABASE_URL gerekir)
```

> `test:rls` ve `test:e2e` gerçek veritabanına yazar. Canlı veritabanında çalıştırmadan önce yedek alın; mümkünse ayrı bir test projesi kullanın.

## F. Yedekleme ve veri dışa aktarma

- Veritabanı: Supabase otomatik yedekleri + dönemsel `pg_dump`.
- Depolama: `media-originals` kovası orijinal fotoğrafları içerir; Supabase Storage yedeğe dahil değildir, önemli ise dönemsel olarak dışa aktarın (ör. `supabase storage` CLI veya S3 uyumlu araçlar).
- Panelden: **Ayarlar › Veri dışa aktarma** ile ilanlar, müşteriler ve talepler CSV/JSON olarak indirilebilir (her dışa aktarma güvenlik kaydına yazılır).
