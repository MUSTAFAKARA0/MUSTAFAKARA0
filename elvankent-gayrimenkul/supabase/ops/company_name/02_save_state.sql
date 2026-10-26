-- =============================================================================
-- Şirket adı kısıtı (20261026000002_company_name_check.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- Bu migration yalnızca bir kontrol kısıtı ekler; veri değişmez. Geri dönüş sabittir (05_rollback.sql).
-- Bu kayıt, geri dönüşten sonra kısıt kümesinin uygulama öncesiyle aynı olduğunu karşılaştırmak içindir.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET platform_settings kısıtları (ad: tanım, doğrulandı)' as ad,
         coalesce((select string_agg(conname::text || ': ' || pg_get_constraintdef(oid) || ' · doğrulandı=' || convalidated::text, E'\n' order by conname::text)
                     from pg_constraint where conrelid = to_regclass('public.platform_settings') and contype = 'c'), 'yok') as deger
  union all
  select 2, 'KAYDET platform_settings_company_name_plain kısıtı sayısı',
         (select count(*)::text from pg_constraint
           where conname = 'platform_settings_company_name_plain' and conrelid = to_regclass('public.platform_settings'))
  union all
  select 3, 'KAYDET company_name sütun varsayılanı',
         coalesce((select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d
                    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
                   where d.adrelid = to_regclass('public.platform_settings') and a.attname = 'company_name'), 'yok')
  union all
  select 4, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
