# Production veritabanı geçişi (V1 → V2 + Stage 3)

> **Bu işlem sizin açık onayınız olmadan yapılmaz ve geri dönüşü zor bir işlemdir.** Önce demo projesinde prova edin (docs/DEMO_SETUP.md). Geliştirme ortamından canlı veritabanına hiçbir işlem yapılmadı.

## Prova sonucu (yerel, 27.09.2026)

V1 şeması + V1 demo verisi + gerçekçi canlı kayıtlar (yönetici, gerçek ilan ve fotoğrafı, iletişim talepleri, yönlendirme, şirket bilgileri) üzerinde tam prova yapıldı:

| Adım | Sonuç |
| --- | --- |
| Ön kontrol (`supabase/ops/preflight_v1.sql`) | tüm kontroller TAMAM |
| Yedek (`pg_dump -Fc`) + okunabilirlik (`pg_restore --list`) | TAMAM |
| 13 migration dosyası, her biri tek işlemde | hepsi başarılı (toplam < 1 sn) |
| Son kontrol (`supabase/ops/postflight_v2.sql`) | 13/13 TAMAM |
| Veri eşlemesi | ilan 9→9, fotoğraf 25→25, talep 2→2, V1 yöneticisi → sahip (owner), şirket bilgileri taşındı |
| Eski ilan adresi | `/ilan/…-100009` → `/ilan/…` kalıcı yönlendirme (308) |
| Stage 3 dosyalarını ikinci kez çalıştırma | sorunsuz (tekrar çalıştırılabilir) |
| Yedekten yeni veritabanına geri yükleme | V1 sayıları birebir aynı |

Prova Supabase'e benzeyen yerel bir PostgreSQL 16 üzerinde yapıldı; gerçek Supabase'deki farklılıkları yakalamak için demo projesinde (`supabase db push`) aynı sıra tekrar denenmelidir.

## Uygulanacak dosyalar ve sıra

V1'de `20260922000001…04` zaten uygulanmıştır — **tekrar çalıştırmayın.** Yalnızca şunlar, bu sırayla:

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
20260928000001_stage3_notifications.sql
20260928000002_stage3_mfa.sql
20260928000003_stage3_location_codes.sql
```

- `supabase db push` hangi dosyaların uygulandığını `supabase_migrations.schema_migrations` tablosundan takip eder. V1 SQL Editor ile uygulandıysa bu tabloda kayıt yoktur ve CLI V1 dosyalarını da çalıştırmaya çalışır — bu durumda **SQL Editor ile dosya dosya** ilerleyin veya önce V1 sürümlerini `supabase migration repair --status applied 20260922000001 20260922000002 20260922000003 20260922000004` ile işaretleyin.
- SQL Editor'de her dosyanın tamamını tek seferde çalıştırın; hata verirse **sonraki dosyaya geçmeyin** (her dosya kendi içinde bütündür).

## Adım adım

1. **Bakım penceresi seçin** (düşük trafik; tahmini veritabanı süresi dakikalar, toplam 30–45 dk).
2. **Yedek:**
   - Supabase › Database › Backups: son günlük yedeğin tarihini not edin (Pro planında Point-in-Time Recovery tercih edilir).
   - Ek olarak kendi bilgisayarınızda: `pg_dump "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" -Fc -f yedek-v1-$(date +%F).dump`
   - Doğrulama: `pg_restore --list yedek-v1-….dump | head` (hata vermemeli) ve dosya boyutu > 0.
   - Fotoğraflar: `npm run backup:storage -- --out=./yedek/storage-v1` (docs/BACKUP_RESTORE.md).
3. **Ön kontrol:** SQL Editor'de `supabase/ops/preflight_v1.sql` → çıktıyı saklayın. HATA varsa durun.
4. **Migration:** yukarıdaki 13 dosya, sırayla.
5. **Son kontrol:** `supabase/ops/postflight_v2.sql` → tüm "durum"lar TAMAM olmalı; sayıları ön kontrolle karşılaştırın (ilan, fotoğraf = media_assets, talep = leads).
6. Uygulamayı yayına alın (docs/DEPLOYMENT_RUNBOOK.md, adım 8+).

## RLS / FK / indeks / depolama / auth kontrolleri

`postflight_v2.sql` şunları doğrular: tüm public tablolarda RLS açık, politika sayıları (public ≥ 60, storage ≥ 4), güvenlik fonksiyonları (kiracı yetkisi, MFA, talep kaydı), varsayılan ofis + ayar + abonelik, kiracısız ilan olmaması, dört depolama kovası (orijinaller özel), sahip üyeliği, rol-yetki tablosu. Yabancı anahtar ve kısıtlar migration'lar içinde tanımlıdır; ihlal olsaydı ilgili dosya hata verip geri alınırdı (tek işlem).

## Geri dönüş planı

| Durum | Yapılacak |
| --- | --- |
| Bir migration dosyası hata verdi | O dosya otomatik geri alınmıştır. Sonraki dosyalara geçmeyin; hata mesajını iletin. Uygulama V1'de kalır (V2 kodu yayına alınmamıştır). |
| Tüm dosyalar uygulandı ama son kontrolde HATA | V2 kodunu yayına ALMAYIN. Supabase › Backups / PITR ile geçiş öncesi ana dönün **veya** `pg_restore` ile yedeği yeni bir projeye/veritabanına yükleyin. |
| Yayına alındı, kritik sorun çıktı | Vercel'de önceki (V1) dağıtımı **Promote** edin **ve** veritabanını yedekten geri yükleyin (V1 kodu V2 şemasıyla çalışmaz). Geçişten sonra girilen veriler kaybolur; bu yüzden yayın sonrası ilk 30 dk yoğun kontrol yapın. |

Geri yükleme komutu (yeni/boş veritabanına):
```bash
pg_restore --no-owner --dbname "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" yedek-v1-TARIH.dump
```
Supabase projesine tam geri yükleme için Supabase'in "Restore to a new project" / PITR özelliği önerilir (roller ve auth şeması dahil).
