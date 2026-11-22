-- =============================================================================
-- Yetki belgesi numarası (20261108000003_license_no.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- =============================================================================
select sira, kontrol, deger, durum from (
  select 1 as sira, 'license_no sütunu (text, nullable)' as kontrol,
         coalesce((select data_type || ' · ' || is_nullable from information_schema.columns
                    where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no'), 'yok') as deger,
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings'
                             and column_name = 'license_no' and data_type = 'text' and is_nullable = 'YES') then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'Biçim kısıtı organization_settings_license_no_format',
         coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'organization_settings_license_no_format' and conrelid = to_regclass('public.organization_settings')), 'yok'),
         case when exists (select 1 from pg_constraint where conname = 'organization_settings_license_no_format' and conrelid = to_regclass('public.organization_settings')) then 'TAMAM' else 'HATA' end
  union all
  select 3, 'license_no marka taslağı sütunlarında değil (doğrudan kaydedilir)',
         (not ('license_no' = any (public.site_brand_columns())))::text,
         case when not ('license_no' = any (public.site_brand_columns())) then 'TAMAM' else 'HATA' end
  union all
  select 4, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
