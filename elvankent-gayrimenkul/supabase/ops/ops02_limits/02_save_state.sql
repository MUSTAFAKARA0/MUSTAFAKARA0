-- =============================================================================
-- OPS-02 (20261025000002_ops02_subscription_limits.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- Geri dönüş (05_rollback.sql) org_plan() tanımını depodaki 20260930000002_site_builder.sql'den kurar.
-- Bu kayıt, canlıdaki tanımın gerçekten o olduğunu ve geri dönüşten sonra aynı olduğunu karşılaştırmak içindir:
-- 2. satırdaki özet (md5), 05 sonrası yeniden alınan özetle AYNI olmalıdır.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET org_plan(uuid) tanımı' as ad,
         case when to_regprocedure('public.org_plan(uuid)') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.org_plan(uuid)')) end as deger
  union all
  select 2, 'KAYDET org_plan(uuid) gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g'))) from pg_proc p where p.oid = to_regprocedure('public.org_plan(uuid)')), 'yok')
  union all
  select 3, 'KAYDET org_plan(uuid) yürütme yetkisi olan roller',
         case when to_regprocedure('public.org_plan(uuid)') is null then 'yok'
              else coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname end, ', ' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname end)
                               from pg_proc p
                               cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where p.oid = to_regprocedure('public.org_plan(uuid)') and a.privilege_type = 'EXECUTE'), 'hiçbir rol') end
  union all
  select 4, 'KAYDET enforce_subscription_limits sütunu (varsa tür / varsayılan)',
         coalesce((select data_type || ' · varsayılan ' || coalesce(column_default, 'yok') from information_schema.columns
                    where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits'), 'yok')
  union all
  select 5, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
