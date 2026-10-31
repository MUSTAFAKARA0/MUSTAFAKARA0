# Sahibin yapacakları · adım adım (31.10.2026)

> Bu listeyi siz yaparsınız; değerleri (anahtar, şifre, bağlantı adresi) **kimseye yazmayın**, bana da göndermeyin.
> Bana yalnızca "tamam" ve gerekiyorsa ekran görüntüsü (değerler görünmeyecek şekilde) yeter.
> Ayrıntılı teknik açıklama: [BACKUP_RESTORE.md](BACKUP_RESTORE.md) "Açılış kapısı".

Sıra önemlidir: **A (gece yedeği) → B (geri yükleme provası) → C (diğer kararlar)**.

---

## Önce bilmeniz gereken bir durum (karar sizde)

Zamanlanmış gece yedeği GitHub'da yalnızca **varsayılan daldan** çalışır. Bu deponun varsayılan dalı production dalıdır (`ff2f7da`)
ve orada yedek iş akışının **eski sürümü** var. Yedeği açtığınız anda:

- **Elle çalıştırma** (adım A5) yeni sürümle yapılabilir: çalıştırırken dal olarak `claude/karays-mission-control-vn8g65` seçilir.
- **Her gece kendiliğinden** çalışan ise eski sürümdür. Eski sürüm yedeği doğru alır, ama günlüğüne (log) **tablo başına kayıt sayılarını
  ve dosya boyutunu** yazar. Depo herkese açık olduğu için bu günlükler herkese açıktır (kişi bilgisi yok, ama kaç müşteri/talep olduğu görünür).

Seçenekler:
1. **Önerilen:** Yedeği şimdi açın (yedeksiz kalmak daha büyük risk). Yeni iş akışı bir sonraki production yayınıyla (O-4) varsayılan dala
   geçer; o zamana kadar gece çalışmalarının günlüklerini isterseniz Actions'ta silersiniz (çalışma sayfası › sağ üst "…" › Delete all logs).
2. Depoyu özel (private) yapmak: günlükler gizlenir, ama özel depoda GitHub Actions ücretsiz dakikası sınırlıdır (CI her gönderimde ~40 dk harcar).

---

## A. Gece yedeğini açmak (O-3) · yaklaşık 30 dk

### A1. Cloudflare hesabı ve R2 kovası
1. https://dash.cloudflare.com adresine girin (hesap yoksa ücretsiz açın).
2. Sol menü **R2 Object Storage** › ilk kez kullanıyorsanız R2'yi etkinleştirin (ücretsiz kotası var; Cloudflare kart bilgisi isteyebilir).
3. **Create bucket** › ad: örn. `karays-yedek` › konum: Avrupa (EU / Automatic) › **Create**. Kova **herkese açık yapılmaz** (Public access kapalı kalsın).
4. R2 ana sayfasında sağda **Account ID** yazar: not edin (uç nokta için gerekecek).

### A2. R2 erişim anahtarı (yalnız bu kovaya)
1. R2 ana sayfası › **Manage R2 API Tokens** (ya da **API** › **Manage API tokens**) › **Create API token**.
2. Ad: `karays-yedek-github` · İzin: **Object Read & Write** · Kapsam: **Apply to specific buckets only** › `karays-yedek` · süre: sınırsız.
3. **Create** › ekranda çıkan **Access Key ID** ve **Secret Access Key**'i güvenli bir yere kopyalayın (gizli anahtar bir daha gösterilmez).
4. Uç nokta: `https://<Account ID>.r2.cloudflarestorage.com` (ekranda "S3 API" olarak da görünür).

### A3. Supabase S3 anahtarı (fotoğrafları okumak için)
1. https://supabase.com/dashboard › **elvankent-demo** projesi › sol menü **Project Settings** (dişli) › **Storage**
   (doğrudan: https://supabase.com/dashboard/project/_/settings/storage › projeyi seçin).
2. **S3 Connection** bölümü: "Enable connection via S3 protocol" açık olmalı. Buradaki **Endpoint** ve **Region** (`eu-central-1`) değerlerini not edin.
3. Aynı bölümde **S3 Access Keys** › **New access key** › açıklama: `karays-yedek` › **Create** › **Access key ID** ve **Secret access key**'i kopyalayın.

### A4. Supabase veritabanı bağlantı adresi (Session pooler)
1. Proje ana sayfasında üstte **Connect** düğmesi (doğrudan: https://supabase.com/dashboard/project/_?showConnect=true).
2. **Connection String** › tür **URI** › **Session pooler** satırındaki adresi kopyalayın (`postgresql://postgres.<…>@aws-…pooler.supabase.com:5432/postgres`).
3. Adresteki `[YOUR-PASSWORD]` yerine veritabanı şifresini yazın. Şifreyi bilmiyorsanız: **Project Settings › Database › Reset database password**.
   (Uygulama bu şifreyi kullanmaz; sıfırlamak siteyi etkilemez.)

### A5. GitHub sırları (Secrets) · 9 adet
https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/settings/secrets/actions/new adresinde her biri için **Name** ve **Secret** girip **Add secret**:

| Name | Değer |
|---|---|
| `SUPABASE_DB_URL` | A4'teki adres (şifre dahil) |
| `SUPABASE_S3_ENDPOINT` | A3 Endpoint |
| `SUPABASE_S3_REGION` | A3 Region (`eu-central-1`) |
| `SUPABASE_S3_ACCESS_KEY_ID` | A3 Access key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | A3 Secret access key |
| `BACKUP_S3_ENDPOINT` | A2 uç noktası `https://<Account ID>.r2.cloudflarestorage.com` |
| `BACKUP_S3_REGION` | `auto` |
| `BACKUP_S3_ACCESS_KEY_ID` | A2 Access Key ID |
| `BACKUP_S3_SECRET_ACCESS_KEY` | A2 Secret Access Key |

### A6. GitHub değişkenleri (Variables) · 3 adet
https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/settings/variables/actions/new :

| Name | Value |
|---|---|
| `BACKUP_BUCKET` | `karays-yedek` (A1'deki kova adı) |
| `BACKUP_S3_PROVIDER` | `Cloudflare` |
| `ELVANKENT_BACKUP_ENABLED` | `true` (**en son** ekleyin; bu açıldığı anda gece yedeği başlar) |

### A7. İlk yedeği elle çalıştırmak
1. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/workflows/elvankent-backup.yml
2. Sağda **Run workflow** › **Use workflow from:** `claude/karays-mission-control-vn8g65` › **Run workflow**.
3. 5–15 dk sonra yeşil tik görünmeli. Kırmızıysa: günlükte yalnızca eksik/yanlış ayarın **adı** yazar; bana adı ve adım numarasını söyleyin.
4. Cloudflare › R2 › `karays-yedek` içinde `db/` klasöründe 4 dosya (`.dump`, `.fingerprint.txt`, `.tables.txt`, `.sha256`) ve `storage/current/` görünmeli.
5. Bana "A tamam" yazın; KALAN_ISLER'de KI-22/KI-28'i kanıtla güncellerim.

---

## B. Geri yükleme provası (KI-24) · A'dan sonra, yaklaşık 1 saat

Gerçek yedek **asla canlıya** değil, kendi bilgisayarınızdaki boş bir test veritabanına yüklenir. Müşteri verisi bilgisayarınızda kalır,
bana gönderilmez. A bitince bu bölümü sizin bilgisayarınıza (Windows/Mac) göre ayrıntılı yazacağım; gerekenler:
Docker Desktop (https://www.docker.com/products/docker-desktop/), Supabase CLI (https://supabase.com/docs/guides/local-development/cli/getting-started),
rclone (https://rclone.org/downloads/) ve depodaki `scripts/restore-drill.sh`.

---

## C. Diğer bekleyen kararlar (sıra önerisi)

1. **P0-2 · canlı veritabanı kimliği:** Supabase › elvankent-demo › **SQL Editor** › New query › `supabase/ops/karays_brand/01_preflight.sql`
   dosyasının tamamını yapıştırın › **Run** (yalnızca okur). Çıktı tablosunun ekran görüntüsü. Dosya:
   https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/blob/claude/karays-mission-control-vn8g65/elvankent-gayrimenkul/supabase/ops/karays_brand/01_preflight.sql
2. **O-1 · Vercel teyidi:** https://vercel.com/dashboard › proje › **Deployments**: production dağıtımının commit'i `ff2f7da` mı ve bir önceki
   dağıtımın "…" menüsünde **Instant Rollback** var mı; **Settings › Environment Variables**'ta `SITE_ENV` değeri (yalnız değeri söyleyin)
   ve **Settings › General › Root Directory** = `elvankent-gayrimenkul`. Ekran görüntüleri.
3. **O-4 · yalnız güvenlik yaması yayını:** 1 ve 2 tamamsa yazılı "O-4 A onaylıyorum" (yayın adımlarını birlikte yaparız).
4. **D-05 · iptal ve veri saklama:** hukukçu görüşüyle; panel şeridinin (KI-21) metni buna göre yazılacak.
5. **D-04 · ödeme gecikmesinde ek süre:** öneri 7 gün; "kabul" ya da başka süre.
6. **PR #2:** https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/pull/2 › yanlış hedef dala açılmış; **Close pull request** (birleştirmeyin).
7. **O-5 migration onayları** (4b…4f) ve **O-2, O-6**: P0-2 ve A/B bittikten sonra tek tek, runbook'larıyla.
