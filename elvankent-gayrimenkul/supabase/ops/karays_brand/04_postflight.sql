-- =============================================================================
-- KARAYS marka geçişi (20261018000001_karays_brand.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Ardından tam son kontrol: supabase/ops/postflight_v2.sql (27 satır; 27. satır "KARAYS marka
-- geçişi" TAMAM, hiçbir satırda HATA yok; KARŞILAŞTIRIN satırlarını ön kontrol sayılarıyla karşılaştırın).
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text end as surum,
         (select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name') as varsayilan,
         case when to_regclass('public.platform_settings') is null then null
              else (xpath('/row/n/text()', query_to_xml('select company_name as n from public.platform_settings', false, true, '')))[1]::text end as ad,
         case when to_regclass('public.platform_settings') is null then null
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_settings', false, true, '')))[1]::text::int end as satir
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'karay_schema_version()' as kontrol, coalesce((select surum from v), 'yok') as deger,
         case when (select surum from v) = '20261018000001' then 'TAMAM' else 'HATA: migration uygulanmamış' end as durum
  union all
  select 2, 'company_name sütun varsayılanı', coalesce((select varsayilan from v), 'yok'),
         case when (select varsayilan from v) = '''KARAYS''::text' then 'TAMAM' else 'HATA' end
  union all
  select 3, 'company_name', coalesce((select ad from v), 'yok'),
         case when (select ad from v) = 'KARAY' then 'HATA: hâlâ KARAY'
              when (select ad from v) is null then 'HATA: satır yok'
              when (select ad from v) = 'KARAYS' then 'TAMAM'
              else 'TAMAM (elle girilmiş ad korunmuş; ön kontroldeki değerle aynı olmalı)' end
  union all
  select 4, 'platform_settings satır sayısı', coalesce((select satir from v)::text, 'yok'),
         case when (select satir from v) = 1 then 'TAMAM' else 'HATA' end
  union all
  select 5, 'karay_schema_version() yetkileri (anon/authenticated/service_role yürütür, public yürütmez)',
         coalesce((select proacl::text from pg_proc where oid = to_regprocedure('public.karay_schema_version()')), 'yok'),
         case when to_regprocedure('public.karay_schema_version()') is not null
                and has_function_privilege('anon', 'public.karay_schema_version()', 'execute')
                and has_function_privilege('authenticated', 'public.karay_schema_version()', 'execute')
                and has_function_privilege('service_role', 'public.karay_schema_version()', 'execute')
                and not exists (select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
                                 where p.oid = to_regprocedure('public.karay_schema_version()') and a.grantee = 0)
              then 'TAMAM' else 'HATA: yetkiler beklenen değil' end
  union all
  select 6, 'public_platform_profile() hâlâ okunuyor (sayfa alt bilgisi / JSON-LD kaynağı)',
         case when to_regprocedure('public.public_platform_profile()') is null then 'yok'
              else (xpath('/row/n/text()', query_to_xml('select company_name as n from public.public_platform_profile()', false, true, '')))[1]::text end,
         case when to_regprocedure('public.public_platform_profile()') is null then 'HATA: fonksiyon yok'
              when (xpath('/row/n/text()', query_to_xml('select company_name as n from public.public_platform_profile()', false, true, '')))[1]::text = (select ad from v) then 'TAMAM'
              else 'HATA: profil ile tablo farklı' end
) kontroller
order by sira;
