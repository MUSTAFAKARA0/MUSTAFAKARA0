-- =============================================================================
-- Medya kota kilidi (20261026000001_media_quota_lock.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- Bu migration yalnızca yeni nesne ekler (tetikleyici + fonksiyon); önceki veri/tanım kaybolmaz.
-- Geri dönüş sabittir (05_rollback.sql). Bu kayıt, geri dönüşten sonra durumun uygulama öncesiyle
-- aynı olduğunu karşılaştırmak içindir.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET media_quota_check() tanımı' as ad,
         case when to_regprocedure('public.media_quota_check()') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.media_quota_check()')) end as deger
  union all
  select 2, 'KAYDET media_quota_check() yürütme yetkisi olan roller',
         case when to_regprocedure('public.media_quota_check()') is null then 'yok'
              else coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end)
                               from pg_proc p
                               cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where p.oid = to_regprocedure('public.media_quota_check()') and a.privilege_type = 'EXECUTE'), 'hiçbir rol') end
  union all
  select 3, 'KAYDET media_assets üzerindeki tetikleyici tanımları',
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid = to_regclass('public.media_assets') and not g.tgisinternal), 'yok')
  union all
  select 4, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
