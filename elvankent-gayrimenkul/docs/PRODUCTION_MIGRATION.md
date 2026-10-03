# Production veritabanı geçişi (V1 → V2 + Stage 3)

> **Bu işlem sizin açık onayınız olmadan yapılmaz ve geri dönüşü zor bir işlemdir.** Önce demo projesinde prova edin (docs/DEMO_SETUP.md). Geliştirme ortamından canlı veritabanına hiçbir işlem yapılmadı.

## Prova sonucu (yerel, 27.09.2026)

V1 şeması + V1 demo verisi + gerçekçi canlı kayıtlar (yönetici, gerçek ilan ve fotoğrafı, iletişim talepleri, yönlendirme, şirket bilgileri) üzerinde tam prova yapıldı:

| Adım | Sonuç |
| --- | --- |
| Ön kontrol (`supabase/ops/preflight_v1.sql`) | tüm kontroller TAMAM |
| Yedek (`pg_dump -Fc`) + okunabilirlik (`pg_restore --list`) | TAMAM |
| 13 migration dosyası, her biri tek işlemde | hepsi başarılı (toplam < 1 sn) |
| 14. dosya (`platform_owner_isolation`, 29.09.2026) — iki kez çalıştırıldı | sorunsuz; son kontrol #14 TAMAM |
| 15–16. dosyalar (`session_context_and_indexes`, `site_builder`, 30.09.2026) — yerelde tekrar tekrar çalıştırıldı | sorunsuz; son kontrol #15–16 TAMAM |
| 17. dosya (`site_brand_publish`, 01.10.2026) — yerelde iki kez çalıştırıldı; demo dosyası (06) işlem içinde iki kez çalıştırılıp geri alındı | sorunsuz; kayıt sayıları değişmedi; son kontrol #17 TAMAM |
| 18. dosya (`karay_platform`, 02.10.2026) — yerelde üç kez çalıştırıldı (yetki düzeltmesi dahil); demo dosyası (06) yeniden üretildi | sorunsuz; mevcut kayıtlar değişmedi; son kontrol #18 TAMAM |
| Son kontrol (`supabase/ops/postflight_v2.sql`) | 13/13 TAMAM (14. dosyadan sonra 14/14; 18 dosyanın tamamından sonra 18/18) |
| Veri eşlemesi | ilan 9→9, fotoğraf 25→25, talep 2→2, V1 yöneticisi → sahip (owner), şirket bilgileri taşındı |
| Eski ilan adresi | `/ilan/…-100009` → `/ilan/…` kalıcı yönlendirme (308) |
| Stage 3 dosyalarını ikinci kez çalıştırma | sorunsuz (tekrar çalıştırılabilir) |
| Yedekten yeni veritabanına geri yükleme | V1 sayıları birebir aynı |

Prova Supabase'e benzeyen yerel bir PostgreSQL 16 üzerinde yapıldı. Ayrıca aynı migration'lar gerçek Supabase'te **boş** demo projesine (`elvankent-demo`, SQL Editor, `supabase/demo/01–04`) sorunsuz uygulandı. Henüz yapılmayan: gerçek Supabase'te **V1 verisi bulunan** bir veritabanında yükseltme provası → aşağıdaki "Canlıdan önce son prova" adımı.

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
20260929000001_platform_owner_isolation.sql
20260930000001_session_context_and_indexes.sql
20260930000002_site_builder.sql
20261001000001_site_brand_publish.sql
20261002000001_karay_platform.sql
```

`20260929000001_platform_owner_isolation.sql` (platform sahibi KARAY ↔ kiracı yalıtımı): kiracı listesinin, ayarlarının ve alan adlarının herkese açık anahtarla **toplu** çekilmesini kapatır; site ofisini yalnızca adresiyle/alan adıyla tek tek bulur (`public_tenant*` fonksiyonları). Veri değiştirmez, tekrar çalıştırılabilir. Uygulama kodu bu dosya uygulanmadan önce de sonra da çalışır. Geri dönüş SQL'i dosyanın sonundadır.

`20260930000001_session_context_and_indexes.sql` (performans): panelin oturum bilgisini (profil, üyelik, ofis, rol, yetki, plan, marka) tek çağrıda döndüren `session_context` fonksiyonu (SECURITY INVOKER — RLS aynen uygulanır) ve eksik yabancı anahtar indeksleri. Veri değiştirmez, tekrar çalıştırılabilir; uygulama fonksiyon yoksa eski sorgulara döner. Geri dönüş dosyanın sonundadır.

`20260930000002_site_builder.sql` (KARAY Web Sitesi Yönetimi): `site_configs` (taslak / yayındaki görünüm, site durumu, özellik bayrakları) ve `site_config_revisions` (yayın sürümleri) tabloları, her mevcut ofis için boş (varsayılan görünümlü) kayıt, `organization_settings`'e üç yeni boş sütun (`short_name`, `logo_mobile_url`, `maps_url`), yalnızca süper adminin çağırabildiği `site_*` fonksiyonları ve herkese açık `public_site_config` (yalnızca yayındaki sürüm). Mevcut veri değişmez; kayıtlar boş olduğu için siteler bugünkü görünümüyle açılır. `org_plan` özellik bayraklarını dikkate alacak şekilde güncellenir (bayrak yoksa plan değerleri aynen geçerlidir). Tekrar çalıştırılabilir; uygulama tablo yoksa varsayılan görünümle çalışır. Geri dönüş SQL'i dosyanın sonundadır.

`20261001000001_site_brand_publish.sql` (marka da taslak → önizleme → yayın → geri alma akışında): yalnızca fonksiyonlar (`site_save_draft`, `site_publish`, `site_rollback` güncellenir; `site_brand_columns`, `site_brand_snapshot`, `site_apply_brand` eklenir). Tablo yapısı ve veri değişmez. KARAY › Marka değişiklikleri taslağa yazılır; yayında `organization_settings`'e uygulanır, sürüm kaydına markanın anlık görüntüsü yazılır. Tekrar çalıştırılabilir; geri dönüş dosyanın sonunda.

`20261002000001_karay_platform.sql` (KARAY şirket sayfası `/karay`): iki **yeni** tablo — `platform_settings` (KARAY'ın kendi şirket/iletişim/SEO bilgileri; tek satır, iletişim alanları boş başlar — gerçek bilgiler Platform › KARAY ayarları'ndan girilir) ve `platform_leads` (KARAY sayfasındaki "Bilgi al / Demo talep et" formundan gelen emlak ofisi adayları). Kiracıların `leads`/`customers` tablolarına dokunmaz; KARAY talepleri hiçbir kiracının CRM'ine düşmez. Her iki tabloyu yalnızca süper admin okur/günceller. `submit_platform_lead` yalnızca sunucu (service role) tarafından çağrılabilir: IP özeti zorunlu, IP başına 10 dakikada 3 / günde 10, genel saatte 300 sınırı. `public_platform_profile` herkese açıktır ama bildirim adreslerini döndürmez. Mevcut veri değişmez; tekrar çalıştırılabilir; geri dönüş dosyanın sonunda. Uygulama tablo yoksa KARAY sayfasını iletişim bilgisi olmadan açar; form "şu anda kullanılamıyor" der.

- `supabase db push` hangi dosyaların uygulandığını `supabase_migrations.schema_migrations` tablosundan takip eder. V1 SQL Editor ile uygulandıysa bu tabloda kayıt yoktur ve CLI V1 dosyalarını da çalıştırmaya çalışır — bu durumda **SQL Editor ile dosya dosya** ilerleyin veya önce V1 sürümlerini `supabase migration repair --status applied 20260922000001 20260922000002 20260922000003 20260922000004` ile işaretleyin.
- SQL Editor'de her dosyanın tamamını **ayrı bir sorgu** olarak tek seferde çalıştırın; hata verirse **sonraki dosyaya geçmeyin** (her dosya kendi içinde bütündür). `v2_enums` dosyası mutlaka tek başına çalıştırılmalıdır (yeni enum değerleri ancak o sorgu bittikten sonra kullanılabilir).
- SQL Editor "Potential issue detected … without enabling Row Level Security" uyarısı gösterirse **Run without RLS** seçin: migration'lar her public tabloda RLS'i kendileri açar (son kontrol bunu doğrular); "Run and enable RLS" sorguyu değiştirir.
- SQL Editor'de metin **seçili** iken Run yalnızca seçili kısmı çalıştırır; çalıştırmadan önce seçimi kaldırın.

## Canlıdan önce son prova (zorunlu önerilir)

Canlı veritabanının bir kopyası üzerinde, canlıya dokunmadan tam prova:
1. Supabase › **canlı proje** › Database › **Backups** › son yedeğin yanında **Restore to a new project** (Pro planı gerekir). Pro yoksa: bilgisayarınızda `pg_dump` ile yedek alın (aşağıda 2. adım) ve Supabase'te yeni boş bir proje açıp `pg_restore --no-owner` ile yükleyin.
2. Yeni (kopya) projede aşağıdaki "Adım adım" 3–5'i uygulayın (ön kontrol, 18 dosya, son kontrol).
3. Demo Vercel projesinin ortam değişkenlerini geçici olarak bu kopya projeye çevirip siteyi ve paneli kontrol edin; sonra demo değerlerine geri alın.
4. Her şey TAMAM ise kopya projeyi silin ve canlı geçiş için bakım penceresi belirleyin.

## Adım adım

1. **Bakım penceresi seçin** (düşük trafik; tahmini veritabanı süresi dakikalar, toplam 30–45 dk).
2. **Yedek:**
   - Supabase › Database › Backups: son günlük yedeğin tarihini not edin (Pro planında Point-in-Time Recovery tercih edilir).
   - Ek olarak kendi bilgisayarınızda: `pg_dump "postgresql://postgres:SIFRE@db.PROJE.supabase.co:5432/postgres" -Fc -f yedek-v1-$(date +%F).dump`
   - Doğrulama: `pg_restore --list yedek-v1-….dump | head` (hata vermemeli) ve dosya boyutu > 0.
   - Fotoğraflar: `npm run backup:storage -- --out=./yedek/storage-v1` (docs/BACKUP_RESTORE.md).
3. **Ön kontrol:** SQL Editor'de `supabase/ops/preflight_v1.sql` → çıktıyı saklayın. HATA varsa durun.
4. **Migration:** yukarıdaki 18 dosya, sırayla.
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
