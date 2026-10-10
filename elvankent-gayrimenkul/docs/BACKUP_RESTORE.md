# Yedekleme ve geri yükleme

> **FAZ 0 (05.10.2026) durumu:** Yedek mekanizması kodda hazır ve yerelde uçtan uca doğrulandı (aşağıda "Doğrulama kaydı"). Canlıda **çalışmıyor**: GitHub iş akışı `ELVANKENT_BACKUP_ENABLED=true` ve sırlar tanımlanana kadar her gece "atlandı" olarak biter. İlk müşteri alınmadan önce aşağıdaki "Açılış kapısı" adımları tamamlanmalıdır.

## İki ayrı yedek: sağlayıcının yedeği ≠ KARAY'ın yedeği

| | Sağlayıcı yedeği (Supabase) | KARAY'ın kontrol ettiği yedek |
| --- | --- | --- |
| Ne | Supabase'in proje yedeği / PITR | `pg_dump` (özel biçim, yetkiler dahil) + Storage dosyaları + kritik veri parmak izi |
| Nerede | Supabase altyapısında | KARAY'ın S3 uyumlu yedek deposunda (R2 / B2 / S3 — Supabase'ten bağımsız) |
| Kapsam | Veritabanı. **Storage dosyalarını (fotoğraf, logo) kapsamaz.** | Veritabanı + tüm Storage kovaları |
| Sıklık / saklama | **Projenin Supabase planına bağlıdır; bu depodan doğrulanamaz.** Supabase › Database › Backups ekranından plan, sıklık, saklama süresi ve PITR durumu okunup buraya yazılmalıdır. | Her gece 04:23 (TR). Veritabanı: `BACKUP_RETENTION_DAYS` (varsayılan **30 gün**). Silinen/değişen dosyaların eski kopyaları: **90 gün**. |
| Kim geri yükler | Supabase paneli (Restore / PITR) | KARAY (aşağıdaki prosedür) |
| Sağlayıcı kapanırsa / hesap erişimi kaybolursa | Kullanılamaz | Kullanılabilir |

"Supabase zaten yedekliyor" varsayımı yapılmaz: sağlayıcı yedeği ek bir güvencedir; KARAY'ın asıl güvencesi kendi deposundaki yedektir.

**Hedefler (ilk 10–20 müşteri için):** RPO ≤ 24 saat (gece yedeği; sağlayıcıda PITR açıksa dakikalar), RTO ≤ 4 saat (tam geri yükleme + son kontrol + smoke test).

## Otomatik günlük yedek (GitHub Actions)

`.github/workflows/elvankent-backup.yml` her gece 04:23 (TR):
1. `pg_dump --format=custom --no-owner` → `BACKUP_BUCKET/db/db-TARIH.dump` (okunabilirlik `pg_restore --list` ile doğrulanır). **Yetkiler (GRANT/REVOKE) yedekte kalır** — bkz. "Neden `--no-privileges` YOK".
2. Kritik veri parmak izi (`supabase/ops/backup_fingerprint.sql`) → `db-TARIH.fingerprint.txt` (aynı klasör).
3. Storage kovaları (`media-originals`, `media`, `branding`, `property-images`) → `BACKUP_BUCKET/storage/current/…` (rclone sync; silinen/değişen dosyalar `storage/deleted/TARIH/…` altına taşınır).
4. Saklama: veritabanı yedekleri ve parmak izleri `BACKUP_RETENTION_DAYS` gün, silinen dosyaların kopyaları 90 gün.

### Açılış kapısı (sizin yapmanız gerekenler — anahtarlar uydurulmadı)
- [ ] Yedek deposu: Cloudflare R2, Backblaze B2 veya AWS S3'te bir kova ("versioning" açık önerilir) ve yalnızca bu kovaya yazabilen erişim anahtarı.
- [ ] Supabase › Project Settings › Storage › **S3 Connection**: S3 erişimini açın, uç nokta, bölge ve erişim anahtarı oluşturun.
- [ ] Supabase › Project Settings › Database › Connection string (Session pooler, IPv4): `SUPABASE_DB_URL`.
- [ ] GitHub › Settings › Secrets and variables › Actions:
  - Secrets: `SUPABASE_DB_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
  - Variables: `ELVANKENT_BACKUP_ENABLED=true`, `BACKUP_BUCKET`, (isteğe bağlı) `BACKUP_S3_PROVIDER` (ör. `Cloudflare`, `AWS`), `BACKUP_RETENTION_DAYS`
- [ ] Actions › elvankent-backup › **Run workflow** ile elle çalıştırın; yeşil bitmeli, depoda `.dump` + `.fingerprint.txt` + `storage/current/…` oluşmalı.
- [ ] Bu yedeği bir test/demo projesine geri yükleyip (aşağıdaki "Tam geri yükleme") parmak izini karşılaştırın.
- [ ] Supabase › Database › Backups: planın sunduğu yedek/PITR durumunu bu belgenin tablosuna yazın.

## Elle yedek (bilgisayarınızdan)

```bash
pg_dump "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" -Fc --no-owner -f yedek-$(date +%F).dump
pg_restore --list yedek-$(date +%F).dump > /dev/null && echo "yedek okunabilir"
psql "postgresql://…" -X -At -f supabase/ops/backup_fingerprint.sql > yedek-$(date +%F).fingerprint.txt
npm run backup:storage -- --out=./yedek/storage            # artımlı: değişmeyen dosyalar atlanır; manifest.json (SHA-256)
```

## Geri yükleme

### Tam geri yükleme (veritabanı)
1. **Hedef boş olmalı**: yeni bir Supabase projesi (aynı bölge) veya boş bir veritabanı. Canlının üzerine doğrudan geri yükleme yapılmaz.
2. `pg_restore --no-owner --dbname "postgresql://…HEDEF…" db-TARIH.dump` — **`--no-privileges` KULLANMAYIN.**
3. Son kontrol: `psql "…HEDEF…" -f supabase/ops/postflight_v2.sql` → tüm "durum"lar TAMAM (KARŞILAŞTIRIN satırları hariç). Özellikle 18, 23, 24, 25: yalnızca sunucuya açık fonksiyonların istemciye kapalı olduğunu doğrular.
4. Parmak izi: `psql "…HEDEF…" -X -At -f supabase/ops/backup_fingerprint.sql | diff db-TARIH.fingerprint.txt -` → çıktı boş olmalı.
5. Uygulamanın ortam değişkenlerini (Vercel) hedef projeye çevirin, `/api/health` ve bir ilan sayfasıyla smoke test yapın.

Sağlayıcı yedeğiyle (Supabase › Database › Backups / PITR › Restore) geri yüklendiğinde de 3–5. adımlar aynen uygulanır.

### Neden `--no-privileges` YOK
FAZ 0 provasında `--no-privileges` ile alınan bir yedek boş veritabanına geri yüklendi: veritabanının yetki kısıtlamaları (REVOKE) kayboldu ve **yalnızca sunucu anahtarıyla çağrılması gereken 81 güvenlik fonksiyonu** (davet kabulü, alan adı işlemleri, şifre sıfırlama sınırı, KARAY talep kaydı…) anonim istemciye açıldı (11 → 92). Son kontrol bunu 18, 23, 24 ve 25. satırlarda HATA olarak yakaladı. Yetkiler korunarak alınan yedekte aynı geri yükleme 21/21 TAMAM ve parmak izi birebir aynı çıktı. İş akışı bu nedenle düzeltildi.

### Fotoğraflar ve marka görselleri (Storage)
```bash
npm run restore:storage -- --from=./yedek/storage                     # KURU ÇALIŞTIRMA: yüklenecek adayları gösterir
npm run restore:storage -- --from=./yedek/storage --apply             # eksik dosyaları yükler (var olanlara dokunmaz)
npm run restore:storage -- --from=... --buckets=media-originals --apply --overwrite   # yalnızca gerekiyorsa üzerine yazar
```
GitHub iş akışının yedeği S3 deposundadır: önce `rclone copy dest:BACKUP_BUCKET/storage/current ./yedek/storage` ile indirin.

### Tek bir ofisin / kaydın geri getirilmesi (kısmi kurtarma)
| Durum | Yapılacak |
| --- | --- |
| Ofis sitesinde yanlış yayın (tasarım, marka, SEO, menü) | Panel › Site yönetimi › **Geçmiş** › önceki sürümü "geri al" (veritabanında `site_config_revisions`; yedek gerekmez) |
| Silinen ilan | İlan silinince çöp kutusuna taşınır (`deleted_at`); ofis panelinden geri yüklenir (yedek gerekmez). Fotoğraf dosyası da silinmişse Storage geri yüklemesi (`--buckets=media,media-originals`) |
| Yanlışlıkla kaldırılan alan adı | Panel › Alan adı › yeniden ekle → TXT doğrulama → bağla (DNS kayıtları müşteride durduğu için dakikalar içinde aktif olur) |
| Bir ofisin verisinin (ör. ayarlar, sayfa metinleri, talepler) eski hâli gerekiyor | Yedeği **ayrı, boş** bir veritabanına geri yükleyin (Tam geri yükleme 1–3), ilgili satırları `organization_id` ile seçip kontrollü SQL ile canlıya aktarın. Canlıya toplu `pg_restore` yapılmaz. |
| Tüm platform | Tam geri yükleme + Storage geri yükleme + Vercel değişkenleri |

### Migration geri dönüş stratejisi
- Her migration tek işlemdir: hata verirse otomatik geri alınır; sonraki dosyaya geçilmez.
- Her dosyanın başında **geri dönüş SQL'i** vardır (yalnızca fonksiyon/sütun ekleyen dosyalar için güvenlidir).
- Veri dönüştüren bir geçişten sonra kritik sorun çıkarsa: önceki Vercel dağıtımına "Promote" + geçiş öncesi alınan yedekten **yeni** projeye tam geri yükleme (docs/PRODUCTION_MIGRATION.md › Geri dönüş planı). Geçiş öncesi yedek, geçişin ilk adımıdır.

## Doğrulama kaydı (FAZ 0, yerel, 05.10.2026)

| Deneme | Sonuç |
| --- | --- |
| Güncel şema (25 migration) + 2 ofis (biri aktif alan adlı, bekleyen davetli, taslaklı) → `pg_dump -Fc --no-owner` → boş veritabanına `pg_restore --no-owner` | 2 sn, 0 hata; **parmak izi 17/17 tablo birebir aynı**; son kontrol 21/21 TAMAM; taslak, alan adı ve davet geri geldi |
| Aynısı `--no-privileges` ile | parmak izi aynı **ama** 81 sunucu fonksiyonu anonim istemciye açıldı → son kontrol 4 HATA (iş akışı düzeltildi) |
| Storage: 4 kova, 1971 dosya (36 MB) → `backup:storage` | 71 sn, 0 hata, `manifest.json` (SHA-256) |
| Storage: bir marka dosyası silindi → `restore:storage --apply` | yalnızca eksik dosya yüklendi (1 yüklendi, 180 atlandı); SHA-256 birebir aynı |
| V1 canlı kopyası → 25 migration (docs/PRODUCTION_MIGRATION.md) | 25/25 başarılı, son kontrol 21/21 TAMAM (25 satır; 4'ü önceki sayılarla KARŞILAŞTIRMA satırı) |

Yerel prova Supabase'e benzeyen yerel bir PostgreSQL 16 yığınında yapıldı. **Gerçek Supabase projesinde geri yükleme provası henüz yapılmadı** (canlı/sağlayıcıya dokunulmadı) → "Açılış kapısı"nın son iki maddesi.

**Geri yükleme tatbikatı:** 3 ayda bir son gece yedeğini test projesine geri yükleyip "Tam geri yükleme" 3–5'i uygulayın; sonucu bu tabloya ekleyin.
