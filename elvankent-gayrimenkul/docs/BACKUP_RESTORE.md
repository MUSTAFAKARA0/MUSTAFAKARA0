# Yedekleme ve geri yükleme

Supabase'in veritabanı yedekleri (günlük / PITR) **Storage dosyalarını (fotoğraflar, logolar) kapsamaz.** Bu nedenle iki ayrı yedek gerekir.

## Otomatik günlük yedek (GitHub Actions)

`.github/workflows/elvankent-backup.yml` her gece 04:23 (TR):
1. `pg_dump` ile veritabanının tam yedeği (özel biçim) → `BACKUP_BUCKET/db/db-TARIH.dump` (okunabilirlik `pg_restore --list` ile doğrulanır),
2. Storage kovaları (`media-originals`, `media`, `branding`, `property-images`) → `BACKUP_BUCKET/storage/current/…` (rclone sync; silinen/değişen dosyalar `storage/deleted/TARIH/…` altına taşınır),
3. Saklama: veritabanı yedekleri `BACKUP_RETENTION_DAYS` (varsayılan 30) gün, silinen dosyaların kopyaları 90 gün.

**Sizin yapmanız gerekenler** (anahtarlar uydurulmadı):
- Yedek deposu: Cloudflare R2, Backblaze B2 veya AWS S3'te bir kova ("versioning" açık olması önerilir) ve yalnızca bu kovaya yazabilen erişim anahtarı.
- Supabase › Project Settings › Storage › **S3 Connection**: S3 erişimini açın, uç nokta, bölge ve erişim anahtarı oluşturun.
- Supabase › Project Settings › Database › Connection string (Session pooler, IPv4): `SUPABASE_DB_URL`.
- GitHub › Settings › Secrets and variables › Actions:
  - Secrets: `SUPABASE_DB_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
  - Variables: `ELVANKENT_BACKUP_ENABLED=true`, `BACKUP_BUCKET`, (isteğe bağlı) `BACKUP_S3_PROVIDER` (ör. `Cloudflare`, `AWS`), `BACKUP_RETENTION_DAYS`
- Zamanlanmış iş akışları yalnızca deponun **varsayılan dalında** çalışır; V2 varsayılan dala birleştirilince başlar. Actions › elvankent-backup › **Run workflow** ile elle deneyin.

## Elle yedek (bilgisayarınızdan)

```bash
pg_dump "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" -Fc -f yedek-$(date +%F).dump
pg_restore --list yedek-$(date +%F).dump > /dev/null && echo "yedek okunabilir"
npm run backup:storage -- --out=./yedek/storage            # artımlı: değişmeyen dosyalar atlanır; manifest.json (SHA-256)
```

## Geri yükleme

**Fotoğraflar:**
```bash
npm run restore:storage -- --from=./yedek/storage                     # KURU ÇALIŞTIRMA: ne yükleneceğini gösterir
npm run restore:storage -- --from=./yedek/storage --apply             # eksik dosyaları yükler (var olanlara dokunmaz)
npm run restore:storage -- --from=... --buckets=media-originals --apply --overwrite   # yalnızca gerekiyorsa üzerine yazar
```
Yerelde doğrulandı: silinen bir dosya kuru çalıştırmada listelendi, `--apply` ile yalnızca o dosya yüklendi, SHA-256 birebir aynı.

**Veritabanı:** tercihen Supabase › Database › Backups (veya PITR) › Restore. Kendi yedeğinizden: yeni/boş bir projeye `pg_restore --no-owner --dbname "…" yedek.dump` (roller ve Supabase iç şemaları nedeniyle önce demo/test projesinde deneyin). Yerel provada yedekten geri yükleme V1 sayılarını birebir verdi.

**Geri yükleme tatbikatı:** 3 ayda bir yedeği demo projesine geri yükleyip `supabase/ops/postflight_v2.sql` ve birkaç ilan sayfasıyla kontrol edin.
