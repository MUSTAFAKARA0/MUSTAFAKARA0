-- =============================================================================
-- Kiracı üyelik koruması (20261108000002_tenant_member_guard.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
-- F yalnız iki tetikleyici ve iki fonksiyon ekler (veri ve politika değiştirmez). Geri dönüş sabittir (05_rollback.sql).
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET organization_members ve properties tetikleyici tanımları' as ad,
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid in (to_regclass('public.organization_members'), to_regclass('public.properties')) and not g.tgisinternal), 'yok') as deger
  union all
  select 2, 'KAYDET F fonksiyonları var mı',
         (to_regprocedure('public.organization_members_target_guard()') is not null)::text || ' / ' || (to_regprocedure('public.properties_og_media_guard()') is not null)::text
  union all
  select 3, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
