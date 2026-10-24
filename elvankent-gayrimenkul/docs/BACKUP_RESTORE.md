# Yedekleme ve geri yükleme

> **FAZ 3 (11.10.2026) durumu:** Yedek mekanizması kodda hazır ve yerelde uçtan uca doğrulandı (aşağıda "Doğrulama kaydı"). Canlıda **çalışmıyor**: 28.09–11.10 arasındaki 14 zamanlanmış çalışmanın 14'ü de `ELVANKENT_BACKUP_ENABLED` değişkeni `true` olmadığı için **atlandı**; hiç yedek alınmadı. Faz 3'ten sonra yedek kapalıyken her çalışmada görünür bir **"Yedek alınmadı"** uyarısı çıkar (sessiz atlama yok). İlk müşteri alınmadan önce aşağıdaki "Açılış kapısı" adımları tamamlanmalıdır.

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

`.github/workflows/elvankent-backup.yml` her gece 04:23 (TR) — veritabanı adımı `scripts/backup-db.sh` betiğini çalıştırır (yerel tatbikat da aynı betiği kullanır):
1. `pg_dump --format=custom --no-owner` → `BACKUP_BUCKET/db/db-TARIH.dump` (okunabilirlik `pg_restore --list` ile doğrulanır). **Yetkiler (GRANT/REVOKE) yedekte kalır** — bkz. "Neden `--no-privileges` YOK".
2. Kritik veri parmak izi (`supabase/ops/backup_fingerprint.sql`) → `db-TARIH.fingerprint.txt` ve tablo başına satır sayıları (`supabase/ops/backup_table_counts.sql`) → `db-TARIH.tables.txt`. **Dump ile aynı anlık görüntüden** alınır (`pg_export_snapshot` + `pg_dump --snapshot`): yedek sırasında yazılan veri karşılaştırmayı bozmaz. Anlık görüntü paylaşılamazsa (bağlantı havuzu işlem kipindeyse) yedek yine alınır, uyarı yazılır.
3. `db-TARIH.sha256`: üç dosyanın SHA-256 özeti. Dört dosya depoya yüklendikten sonra `rclone check` ile depodakilerle karşılaştırılır.
4. Storage kovaları (`media-originals`, `media`, `branding`, `property-images`) → `BACKUP_BUCKET/storage/current/…` (rclone sync; silinen/değişen dosyalar `storage/deleted/TARIH/…` altına taşınır).
5. Saklama: veritabanı yedekleri (dört dosya birlikte) `BACKUP_RETENTION_DAYS` gün, silinen dosyaların kopyaları 90 gün.

Güvenlik ve görünürlük:
- `ELVANKENT_BACKUP_ENABLED` `true` değilken **"Yedek alınmadı"** uyarısı ve iş özeti yazılır (`backup-disabled` işi); eksik değişken/sır varsa yedek işi yalnızca eksiklerin **adlarını** yazıp durur.
- Log'a kayıt sayısı, dosya boyutu, bağlantı adresi, kullanıcı adı veya dosya içeriği yazılmaz (depo herkese açık olduğu sürece Actions logları da herkese açıktır). Hata mesajlarında bağlantı adresi, sunucu, kullanıcı, rol ve veritabanı adı `<gizlendi>` olarak yazılır.
- Storage adımında rclone varsayılan `NOTICE` log düzeyinde çalışır; aktarım istatistikleri `INFO` düzeyinde olduğu için yazılmaz ([rclone: `--stats-log-level`](https://rclone.org/docs/#stats-log-level)). Hata olursa yalnızca nesne yolu yazılır; yollar sistem üretimidir (kimlik/UUID, rastgele ek, özet), dosya adı veya kişisel veri içermez.
- İzin: yalnızca `contents: read`. Yedek kovası **özel** olmalıdır (orijinal fotoğraflar `media-originals` dahil).

Zamanlama kuralları (GitHub): zamanlanmış iş akışı yalnızca varsayılan dalda çalışır; yoğunlukta gecikebilir veya düşürülebilir (gözlenen: 01:23 UTC yerine 06:37–07:38 UTC, yani 5–6 saat gecikme); herkese açık depoda 60 gün hiç etkinlik olmazsa GitHub zamanlanmış iş akışlarını kendiliğinden kapatır. Gece yedeğinin alınıp alınmadığı bu yüzden ayrıca izlenmelidir (ör. dışarıdan "yedek geldi mi" denetimi).

### Açılış kapısı (sizin yapmanız gerekenler — anahtarlar uydurulmadı)
- [ ] Yedek deposu: Cloudflare R2, Backblaze B2 veya AWS S3'te bir kova ("versioning" açık önerilir) ve yalnızca bu kovaya yazabilen erişim anahtarı.
- [ ] Supabase › Project Settings › Storage › **S3 Connection**: S3 erişimini açın, uç nokta, bölge ve erişim anahtarı oluşturun.
- [ ] Supabase › Project Settings › Database › Connection string (Session pooler, IPv4): `SUPABASE_DB_URL`.
- [ ] GitHub › Settings › Secrets and variables › Actions:
  - Secrets: `SUPABASE_DB_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
  - Variables: `ELVANKENT_BACKUP_ENABLED=true`, `BACKUP_BUCKET`, (isteğe bağlı) `BACKUP_S3_PROVIDER` (ör. `Cloudflare`, `AWS`), `BACKUP_RETENTION_DAYS`
- [ ] Actions › elvankent-backup › **Run workflow** ile elle çalıştırın; yeşil bitmeli ("Yedek alınmadı" uyarısı görünmemeli), depoda `db-TARIH.dump` + `.fingerprint.txt` + `.tables.txt` + `.sha256` ve `storage/current/…` oluşmalı. Log'da "Ortak anlık görüntü alınamadı" uyarısı varsa `SUPABASE_DB_URL` oturum (session) kipindeki bağlantı olmalıdır.
- [ ] Bu yedeği indirip bir **test** sunucusunda `scripts/restore-drill.sh` ile geri yükleyin (aşağıdaki "Geri yükleme tatbikatı"); tatbikat "başarılı" bitmeli.
- [ ] Supabase › Database › Backups: planın sunduğu yedek/PITR durumunu bu belgenin tablosuna yazın.

## Elle yedek (bilgisayarınızdan)

```bash
# Gece yedeğiyle aynı betik: dump + parmak izi + tablo sayıları (aynı anlık görüntü) + SHA-256
SUPABASE_DB_URL="postgresql://…" OUT_DIR=./yedek bash scripts/backup-db.sh
(cd yedek && sha256sum -c db-*.sha256)                     # dosyalar bozulmamış mı
npm run backup:storage -- --out=./yedek/storage            # artımlı: değişmeyen dosyalar atlanır; manifest.json (her dosyanın SHA-256'sı)
npm run restore:storage -- --from=./yedek/storage --verify # yedek klasörü manifest'le birebir mi (Supabase'e bağlanmaz)
```
Bağlantı adresini komut geçmişine yazmamak için değişkeni bir dosyadan okuyun (`set -a; . ./.env.yedek; set +a`); dosyayı depoya eklemeyin.

## Geri yükleme

### Tam geri yükleme (veritabanı)
0. **Önce bütünlük:** `sha256sum -c db-TARIH.sha256` → üç dosya da "OK" olmalı. Uyuşmuyorsa bu yedeği kullanmayın; bir önceki geceninkine geçin.
1. **Hedef boş olmalı**: yeni bir Supabase projesi (aynı bölge) veya boş bir veritabanı. Canlının üzerine doğrudan geri yükleme yapılmaz.
   > **Faz 3 uyarısı (prova edilmedi):** Yeni bir Supabase projesi boş değildir; `auth`, `storage` ve eklenti şemaları hazır gelir. KARAY'ın tam dump'ı yalnızca **boş PostgreSQL'e** geri yüklenerek doğrulandı (`scripts/restore-drill.sh`). Supabase'in yeni projeye geri yükleme için resmi yöntemi farklıdır: rol, şema ve veri ayrı dökülür (`supabase db dump --role-only` / şema / `--data-only`), `psql --single-transaction` ile `SET session_replication_role = replica` altında yüklenir; `auth` / `storage` şemalarına eklenen politika ve tetikleyiciler ayrıca yeniden kurulur ([Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)). Gerçek bir test projesinde prova yapılmadan aşağıdaki 2. adımın yeni Supabase projesinde hatasız çalışacağı **varsayılmamalıdır** (Açılış kapısı).
2. `pg_restore --no-owner --single-transaction --dbname "postgresql://…HEDEF…" db-TARIH.dump` — **`--no-privileges` KULLANMAYIN.** Tek işlem: hata olursa hedefte yarım geri yükleme kalmaz.
3. Son kontrol: `psql "…HEDEF…" -f supabase/ops/postflight_v2.sql` → tüm "durum"lar TAMAM (KARŞILAŞTIRIN satırları hariç). Özellikle 18, 23, 24, 25: yalnızca sunucuya açık fonksiyonların istemciye kapalı olduğunu doğrular.
4. Parmak izi: `psql "…HEDEF…" -X -q -At -f supabase/ops/backup_fingerprint.sql | diff db-TARIH.fingerprint.txt -` → çıktı boş olmalı. Tablo sayıları: aynı şekilde `backup_table_counts.sql` ile `db-TARIH.tables.txt` (yedeği alan rolün göremediği tablolar listede yoktur; `scripts/restore-drill.sh` bunu kendisi süzer).
5. Uygulamanın ortam değişkenlerini (Vercel) hedef projeye çevirin, `/api/health` ve bir ilan sayfasıyla smoke test yapın.

Sağlayıcı yedeğiyle (Supabase › Database › Backups / PITR › Restore) geri yüklendiğinde de 3–5. adımlar aynen uygulanır. Parmak izi ve tablo sayıları sunucu dilinden ve saat diliminden bağımsızdır (Faz 3); farklı bir sunucuya yüklemede de birebir karşılaştırılır.

### Neden `--no-privileges` YOK
FAZ 0 provasında `--no-privileges` ile alınan bir yedek boş veritabanına geri yüklendi: veritabanının yetki kısıtlamaları (REVOKE) kayboldu ve **yalnızca sunucu anahtarıyla çağrılması gereken 81 güvenlik fonksiyonu** (davet kabulü, alan adı işlemleri, şifre sıfırlama sınırı, KARAY talep kaydı…) anonim istemciye açıldı (11 → 92). Son kontrol bunu 18, 23, 24 ve 25. satırlarda HATA olarak yakaladı. Yetkiler korunarak alınan yedekte aynı geri yükleme 21/21 TAMAM ve parmak izi birebir aynı çıktı. İş akışı bu nedenle düzeltildi.

### Fotoğraflar ve marka görselleri (Storage)
```bash
npm run restore:storage -- --from=./yedek/storage --verify            # yalnızca SHA-256 denetimi (Supabase'e bağlanmaz)
npm run restore:storage -- --from=./yedek/storage                     # KURU ÇALIŞTIRMA: yüklenecek adayları gösterir
npm run restore:storage -- --from=./yedek/storage --apply --target=<proje>.supabase.co   # eksik dosyaları yükler (var olanlara dokunmaz); --target hedefi teyit eder
npm run restore:storage -- --from=... --buckets=media-originals --apply --overwrite --target=<proje>.supabase.co   # yalnızca gerekiyorsa üzerine yazar
```
Her dosya yüklenmeden önce `manifest.json`'daki SHA-256 ile karşılaştırılır; uyuşmayan (bozuk) dosya **yüklenmez** ve hatalı sayılır (çıkış kodu 2). Manifest yoksa uyarı verilir ve doğrulamasız yüklenir.
GitHub iş akışının yedeği S3 deposundadır: önce `rclone copy dest:BACKUP_BUCKET/storage/current ./yedek/storage` ile indirin. **Bu yedekte `manifest.json` yoktur** (gece işi rclone ile kovadan kovaya kopyalar): `--verify` "manifest yok" diyerek 1 ile çıkar, `--apply` doğrulamasız yükler. Bütünlük burada rclone'un aktarım denetimine dayanır; SHA-256 manifest'i yalnızca `npm run backup:storage` ile alınan yedekte vardır.

**Tam geri yüklemeden sonra `--overwrite` zorunludur.** Veritabanı geri yüklenince `storage.objects` kayıtları zaten vardır; Storage API `--apply` (üzerine yazmadan) yüklemeyi "zaten var" diye reddeder ve dosya **eksik kalır**. Bu durumda `--apply --overwrite` kullanın (Faz 3 tatbikatında doğrulandı; Supabase'in resmi taşıma betiği de `upsert: true` kullanır). Dosya türü uzantıdan belirlenir; uzantısız `media-originals/…/original` dosyaları `application/octet-stream` olarak yüklenir. Uygulama bu dosyaları yalnızca sunucuda indirip işlediği için bu bir sorun değildir.

### Tek bir ofisin / kaydın geri getirilmesi (kısmi kurtarma)
| Durum | Yapılacak |
| --- | --- |
| Ofis sitesinde yanlış yayın (tasarım, marka, SEO, menü) | Panel › Site yönetimi › **Geçmiş** › önceki sürümü "geri al" (veritabanında `site_config_revisions`; yedek gerekmez) |
| Silinen ilan | İlan silinince çöp kutusuna taşınır (`deleted_at`); ofis panelinden geri yüklenir (yedek gerekmez). Fotoğraf dosyası da silinmişse Storage geri yüklemesi (`--buckets=media,media-originals`) |
| Yanlışlıkla kaldırılan alan adı | Panel › Alan adı › yeniden ekle → TXT doğrulama → bağla (DNS kayıtları müşteride durduğu için dakikalar içinde aktif olur) |
| Bir ofisin verisinin (ör. ayarlar, sayfa metinleri, talepler) eski hâli gerekiyor | Yedeği **ayrı, boş** bir veritabanına geri yükleyin (Tam geri yükleme 1–3), ilgili satırları `organization_id` ile seçip kontrollü SQL ile canlıya aktarın. Canlıya toplu `pg_restore` yapılmaz. |
| Tüm platform | Tam geri yükleme + Storage geri yükleme (`--apply --overwrite`; nesne kayıtları veritabanıyla birlikte gelir) + Vercel değişkenleri |

### Migration geri dönüş stratejisi
- Her migration tek işlemdir: hata verirse otomatik geri alınır; sonraki dosyaya geçilmez.
- Her dosyanın başında **geri dönüş SQL'i** vardır (yalnızca fonksiyon/sütun ekleyen dosyalar için güvenlidir).
- Veri dönüştüren bir geçişten sonra kritik sorun çıkarsa: önceki Vercel dağıtımına "Promote" + geçiş öncesi alınan yedekten **yeni** projeye tam geri yükleme (docs/PRODUCTION_MIGRATION.md › Geri dönüş planı). Geçiş öncesi yedek, geçişin ilk adımıdır.

### Geri yükleme tatbikatı (`scripts/restore-drill.sh`)
```bash
ADMIN_DB_URL="postgresql://kullanici@test-sunucusu:5432/postgres" bash scripts/restore-drill.sh ./yedek 2026-10-11T0123Z
```
- Yalnızca **yerel / test** sunucusunda çalıştırın (`CREATE DATABASE` yetkisi ve Supabase rolleri gerekir). Betik bu sunucuda yalnızca `karay_restore_drill_<zaman>` adlı **yeni** bir veritabanı oluşturur (`template0`); var olan hiçbir veritabanına yazmaz.
- Sıra: SHA-256 → dump okunabilir mi → geçici veritabanı → **tek işlemde** geri yükleme → parmak izi birebir → yedekteki her tablonun satır sayısı birebir → postflight'ta HATA yok → geçici veritabanı silinir (başarılı ya da başarısız). `KEEP_DB=1` incelemek için bırakır.
- Çıktı yalnızca adım durumlarını ve eşleşen satır/tablo sayısını yazar; kayıt içeriği veya kayıt sayısı yazmaz.

### Tatbikat (veya test geri yüklemesi) başarısız olursa: temizleme ve geri alma
| Ne oldu | Durum | Yapılacak |
| --- | --- | --- |
| SHA-256 uyuşmadı (1. adım) | Veritabanı oluşturulmadı | Bu yedeği kullanmayın. Depodan yeniden indirin (indirme bozulmuş olabilir) ve tekrar deneyin; yine uyuşmuyorsa bir önceki gecenin yedeğine geçin ve olay notu düşün. |
| Dump okunamadı (2. adım) | Veritabanı oluşturulmadı | Aynı. |
| Geri yükleme hatası (4. adım) | Tek işlem: geçici veritabanı boş kalır ve otomatik silinir | Hata ilk 20 satırda yazılır (bağlantı adresi gizli). Sık nedenler: hedefte Supabase rolleri yok, `pg_restore` dump'tan eski sürüm, eklenti eksik. Düzeltip tekrarlayın. |
| Parmak izi veya tablo sayısı farkı (5–6) | Geçici veritabanı otomatik silinir | Farklı tabloların yalnızca adları yazılır. Bir önceki yedekle tekrarlayın; iki yedekte de fark varsa yedek betiği / şema sorununu araştırın. Canlıya geri yükleme **yapılmaz**. |
| Son kontrolde HATA (7) | Geçici veritabanı silinir | HATA satırları yazılır. 18, 23–25 yetki kaybı demektir: yedek `--no-privileges` ile alınmış olabilir. |
| Betik yarıda kesildi (Ctrl+C, makine kapandı) | Geçici veritabanı kalmış olabilir | `select datname from pg_database where datname like 'karay_restore_drill_%';` → her biri için `drop database "<ad>" with (force);` |
| Temizlik başarısız ("SİLİNEMEDİ") | Geçici veritabanı duruyor | Aynı komutla elle silin (`with (force)` açık bağlantıları kapatır). |

Tatbikat kaynak veritabanında hiçbir şeyi değiştirmez (yedek alma yalnızca okur). Production veritabanı tatbikat hedefi **olmaz**; production yedeği yalnızca test sunucusunda denenir.

## Doğrulama kaydı (FAZ 3, yerel, 11.10.2026)

Yerel PostgreSQL 16.13 (pg_dump 16.13) ve Supabase benzeri yerel Storage. Production veritabanına, gerçek Supabase projesine ve gerçek müşteri verisine **dokunulmadı**; yazma gerektiren denemeler `karay_p3_*` adlı geçici veritabanlarında ve geçici bir kovada yapıldı, sonda silindi. Ayrıntı: [PHASE3_SECURITY_BACKUP.md](PHASE3_SECURITY_BACKUP.md) › Yedekleme ve geri yükleme.

| Deneme | Sonuç |
| --- | --- |
| D1: `scripts/backup-db.sh` (yerel ana veritabanı, ortak anlık görüntü) → `sha256sum -c` → `scripts/restore-drill.sh` | 3/3 dosya OK. Geçici veritabanına tek işlemde geri yükleme. Parmak izi **17/17**, tablo sayıları **71/71** (public + auth + storage tablolarının tamamı), son kontrol 22 TAMAM + 4 karşılaştırma satırı, **0 HATA**. Geçici veritabanı silindi; kaynağın parmak izi ve sayıları değişmedi |
| C1: yedek sürerken sürekli yazma (yedek başına ≈150 satır) — ortak anlık görüntü | Tatbikat başarılı (17/17, 72/72) |
| C2: aynı koşul, `BACKUP_SHARED_SNAPSHOT=off` (eski yöntem: dump ve sayım ayrı anlarda) | Tatbikat 5. adımda durdu: `fark: organization_settings` — tutarsız yedek yakalandı |
| F3: anlık görüntü dışa aktarılamıyor (benzetim) | `::warning` yazıldı, yedek yine alındı, tatbikat başarılı. **İlk denemede betik bu yolda çöküyordu** (coproc değişkeni silindi, `set -u`) → adlandırılmış boruyla düzeltildi |
| N1: kaynakta RLS'si kapalı tablo | 7. adım `HATA: RLS kapalı tablo var` → başarısız, geçici veritabanı silindi. (Tatbikat betiğinin ilk hâli `HATA: …` biçimli satırları saymıyordu → düzeltildi, birim testi eklendi) |
| I1: dump bozuk, özet eski | 1. adımda durdu; veritabanı **oluşturulmadı** |
| I2: parmak izinde bir karakter değişti, özet yenilendi | 5. adımda durdu: `fark: organizations` |
| I3: bir tablo sayısı değişti, özet yenilendi | 6. adımda durdu: `fark: auth.audit_log_entries` |
| I4: dump'ın veri bloğu bozuk, özet yenilendi | İçerik listesi okundu; 4. adım `could not uncompress data`; tek işlem → yarım veri yok, veritabanı silindi |
| F1 / F2: yanlış parola, erişilemeyen sunucu | Log'da sunucu ve kullanıcı `<gizlendi>`; parola ve adres yok |
| Aynı yedek C.UTF-8 ve ICU `en-US` veritabanında | Eski parmak izi `storage.objects` satırında **farklı**; yeni sürüm birebir aynı |
| Aynı veritabanı `PGTZ=UTC` ve `PGTZ=Europe/Istanbul` | Eski parmak izi 3 satırda **farklı** (organization_settings, properties, pages); yeni sürüm birebir aynı |
| Storage: `backup:storage` → `restore:storage --verify` | 2292 dosya, 0 hata; 2292/2292 SHA-256 doğrulandı |
| Storage: artımlı ikinci çalıştırma | 2292 dosya atlandı; hepsinin özeti manifest'te ve ilk manifestle 2292/2292 aynı; `--verify` geçti |
| Storage → ayrı geçici kova (238 dosya) | Kuru çalıştırma, sonra `--apply`: 238 yüklendi; kovadan geri indirilen 238/238 SHA-256 aynı |
| Bozuk dosya | Yüklenmedi (çıkış 2); kovada yok |
| Nesne kaydı var, dosya yok (tam geri yükleme sonrası durum) | `--apply`: "zaten var", dosya **hâlâ yok**; `--apply --overwrite`: 238/238 geri geldi, SHA-256 aynı |

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
