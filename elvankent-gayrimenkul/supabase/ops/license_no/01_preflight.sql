-- =============================================================================
-- Yetki belgesi numarası (supabase/pending/20261108000003_license_no.sql, P0-8, G) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
-- Çıktının TAMAMINI saklayın. "durum" sütununda DUR varsa 03 UYGULANMAZ. Kişi verisi yok.
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
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
  select 4, 'G uygulanmış mı — license_no sütunu / biçim kısıtı  [KAYDET]',
         (exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no'))::text || ' / ' || (exists (select 1 from pg_constraint where conname = 'organization_settings_license_no_format' and conrelid = to_regclass('public.organization_settings')))::text,
         case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no') then 'TAMAM (henüz yok; 05 sonrası da yok olmalı)'
              when exists (select 1 from pg_constraint where conname = 'organization_settings_license_no_format' and conrelid = to_regclass('public.organization_settings')) then 'BİLGİ: zaten var; 03 zararsız'
              else 'DUR: sütun var ama kısıt yok (elle eklenmiş); önce incelenir' end
  union all
  select 5, 'organization_settings satır sayısı (yalnızca sayı)',
         (select count(*)::text from public.organization_settings), 'BİLGİ: değişmez; yeni sütun tümünde NULL'
  union all
  select 6, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
) kontroller
order by sira;
