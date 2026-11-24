-- =============================================================================
-- Kiracı izolasyonu kalanları (supabase/pending/20261124000001_tenant_hardening.sql, KI-46, J) — 2/5 DURUM KAYDI
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET get_public_collection gövde özeti (md5)' as ad,
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from pg_proc where oid = to_regprocedure('public.get_public_collection(text)')), 'yok') as deger
  union all
  select 2, 'KAYDET atama tetikleyici sayısı',
         (select count(*)::text from pg_trigger where tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not tgisinternal)
  union all
  select 3, 'KAYDET anon SELECT organization_settings / organization_domains',
         has_table_privilege('anon', 'public.organization_settings', 'select')::text || ' / ' || has_table_privilege('anon', 'public.organization_domains', 'select')::text
  union all
  select 4, 'KAYDET neighborhoods_insert_members politikası var mı',
         exists (select 1 from pg_policy where polname = 'neighborhoods_insert_members' and polrelid = to_regclass('public.neighborhoods'))::text
  union all
  select 5, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
