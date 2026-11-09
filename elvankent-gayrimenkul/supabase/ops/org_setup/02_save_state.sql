-- =============================================================================
-- İlk kurulum ve tasarım kilidi (supabase/pending/20261108000005_org_setup.sql, PILOT, I) — 2/5 DURUM KAYDI
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET organization_setup var mı' as ad, (to_regclass('public.organization_setup') is not null)::text as deger
  union all
  select 2, 'KAYDET I tetikleyici sayısı', (select count(*)::text from pg_trigger where tgname in ('organization_setup_init', 'site_configs_design_lock') and not tgisinternal)
  union all
  select 3, 'KAYDET ofis sayısı', (select count(*)::text from public.organizations)
  union all
  select 4, 'KAYDET yayın sürümü toplamı (site_configs; 03 ve 05 değiştirmez)', (select coalesce(sum(published_version), 0)::text from public.site_configs)
  union all
  select 5, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
