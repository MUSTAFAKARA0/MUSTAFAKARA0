-- =============================================================================
-- Yetki belgesi numarası (20261108000003_license_no.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE ve geri dönüşten ÖNCE çalıştırın; çıktıyı saklayın.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
-- 05 sütunu siler: girilmiş numaralar kaybolur. Geri dönüşten önce alınan bu çıktı, numaraları elle geri girmek içindir.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET license_no sütunu var mı' as ad, (exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no'))::text as deger
  union all
  select 2, 'KAYDET girilmiş yetki belgesi numaraları (kurum kimliği = numara)',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no')
              then coalesce((select string_agg(x.v, E'\n') from xmltable('/table/row' passing query_to_xml(
                     'select organization_id::text || '' = '' || license_no as v from public.organization_settings where license_no is not null order by 1',
                     false, false, '') columns v text path 'v') x), 'yok')
              else 'sütun yok' end
  union all
  select 3, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
