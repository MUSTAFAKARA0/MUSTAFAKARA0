-- =============================================================================
-- Pilot deneme bitişi (supabase/pending/20261108000004_pilot_trial_end.sql, PILOT, H) — 2/5 DURUM KAYDI
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET platform_set_trial_end var mı' as ad, (to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is not null)::text as deger
  union all
  select 2, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
