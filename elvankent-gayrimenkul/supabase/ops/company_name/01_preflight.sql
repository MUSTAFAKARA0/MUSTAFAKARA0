-- =============================================================================
-- Şirket adı kısıtı (supabase/pending/20261026000002_company_name_check.sql) — 1/5 ÖN KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın (metin olarak). "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Çıktıda şirket adı, kurum adı ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
-- 5. satır önemlidir: NOT VALID kısıt, geçersiz company_name değeri olan satırın HERHANGİ bir sütununun
-- güncellenmesini de reddeder. Bu yüzden 5. satır 0 olmadan 03 uygulanmaz. Adımlar ve gerekçe: README.md
-- (platform_settings tablosu yoksa bu sorgu hata verir; o durumda şema eksiktir, 03 uygulanmaz.)
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
),
c as (
  select count(*) as adet,
         coalesce(bool_and(convalidated), false) as dogrulandi
    from pg_constraint
   where conname = 'platform_settings_company_name_plain' and conrelid = to_regclass('public.platform_settings')
),
ihlal as (
  select count(*) as adet from public.platform_settings
   where company_name ~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]'
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'Ortam işareti' as kontrol,
         case when to_regclass('elvankent_demo.environment') is not null then 'DEMO veritabanı (elvankent_demo işareti var)'
              else 'demo işareti yok' end as deger,
         'BİLGİ: uygulamanın kullandığı proje bu mu? Vercel''deki NEXT_PUBLIC_SUPABASE_URL ile panelden karşılaştırın' as durum
  union all
  select 2, 'Sunucu / rol', current_database() || ' · PostgreSQL ' || current_setting('server_version') || ' · rol ' || current_user, 'BİLGİ'
  union all
  select 3, 'Şema sürümü — karay_schema_version()  [KAYDET]', coalesce((select surum from v), 'fonksiyon yok'),
         case when (select surum from v) is null then 'DUR: fonksiyon yok — önceki migration''lar eksik (PRODUCTION_MIGRATION.md)'
              when (select surum from v) < '20261018000001' then 'DUR: şema eski — önce 20261018000001''e kadar migration''lar'
              when (select surum from v) = '20261018000001' then 'TAMAM (beklenen sürüm; bu betik sürümü DEĞİŞTİRMEZ)'
              else 'BİLGİ: şema daha yeni; bu betik sürümü değiştirmez' end
  union all
  select 4, 'platform_settings.company_name sütunu',
         (select count(*)::text from pg_attribute where attrelid = to_regclass('public.platform_settings') and attname = 'company_name' and not attisdropped),
         case when exists (select 1 from pg_attribute where attrelid = to_regclass('public.platform_settings') and attname = 'company_name' and not attisdropped)
              then 'TAMAM' else 'DUR: sütun yok' end
  union all
  select 5, 'Yasak karakter içeren company_name satır sayısı (yalnızca sayı)  [KAYDET]',
         (select adet from ihlal)::text,
         case when (select adet from ihlal) = 0 then 'TAMAM'
              else 'DUR: önce değeri uygulamadaki Ayarlar ekranından kaydederek temizleyin; NOT VALID kısıt bu satırın her güncellemesini reddeder' end
  union all
  select 6, 'platform_settings_company_name_plain kısıtı (adet / doğrulandı)  [KAYDET]',
         (select adet from c)::text || ' / ' || (select dogrulandi from c)::text,
         case when (select adet from c) = 0 then 'TAMAM (henüz yok)'
              when (select adet from c) = 1 then 'BİLGİ: zaten var; 03 silip NOT VALID olarak yeniden ekler (03b ile yeniden doğrulanır)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 7, 'platform_settings kısıt tanımları  [KAYDET]',
         coalesce((select string_agg(conname::text || ': ' || pg_get_constraintdef(oid), E'\n' order by conname::text)
                     from pg_constraint where conrelid = to_regclass('public.platform_settings') and contype = 'c'), 'yok'),
         'BİLGİ'
  union all
  select 8, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 9, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
) kontroller
order by sira;
