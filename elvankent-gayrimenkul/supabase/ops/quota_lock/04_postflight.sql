-- =============================================================================
-- Ekleme kilidi (20261025000001_quota_lock.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.proacl, p.proowner from pg_proc p where p.oid = to_regprocedure('public.quota_lock()')
),
t as (
  select to_regclass('public.properties') as ilan, to_regclass('public.organization_members') as uyelik
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'aa_quota_lock — properties (tam bir kez)' as kontrol,
         (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select ilan from t)) as deger,
         case when (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select ilan from t)) = 1
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'aa_quota_lock — organization_members (tam bir kez)',
         (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select uyelik from t)),
         case when (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select uyelik from t)) = 1
              then 'TAMAM' else 'HATA' end
  union all
  select 3, 'properties tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select ilan from t) limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select ilan from t)
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER aa_quota_lock BEFORE INSERT ON public.properties FOR EACH ROW EXECUTE FUNCTION %quota_lock()')
              then 'TAMAM' else 'HATA: BEFORE INSERT / FOR EACH ROW beklenir' end
  union all
  select 4, 'organization_members tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select uyelik from t) limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = (select uyelik from t)
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER aa_quota_lock BEFORE INSERT OR UPDATE OF status ON public.organization_members FOR EACH ROW EXECUTE FUNCTION %quota_lock()')
              then 'TAMAM' else 'HATA: BEFORE INSERT OR UPDATE OF status beklenir' end
  union all
  select 5, 'quota_lock() yürütme yetkisi olan roller (anon / authenticated / PUBLIC olmamalı)',
         case when to_regprocedure('public.quota_lock()') is null then 'yok'
              else coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname end, ', ' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname end)
                               from f cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where a.privilege_type = 'EXECUTE'), 'hiçbir rol') end,
         case when to_regprocedure('public.quota_lock()') is not null
                and not exists (select 1 from f cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated')))
              then 'TAMAM' else 'HATA: yetkiler beklenen değil' end
  union all
  select 6, 'quota_lock() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = 'ed216519be43af7763ef8b03f55b6841'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 7, 'quota_lock() güvenlik modu ve search_path',
         case when to_regprocedure('public.quota_lock()') is null then 'yok'
              else (select case when p.prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(p.proconfig, ','), 'ayar yok')
                      from pg_proc p where p.oid = to_regprocedure('public.quota_lock()')) end,
         case when exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.quota_lock()') and not p.prosecdef
                              and p.proconfig @> array['search_path=""'])
              then 'TAMAM' else 'HATA' end
  union all
  select 8, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
