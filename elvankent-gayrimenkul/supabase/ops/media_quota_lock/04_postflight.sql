-- =============================================================================
-- Medya kota kilidi (20261026000001_media_quota_lock.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.proacl, p.proowner from pg_proc p where p.oid = to_regprocedure('public.media_quota_check()')
),
m as (
  select to_regclass('public.media_assets') as medya
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'media_assets_quota — media_assets (tam bir kez)' as kontrol,
         (select count(*)::text from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal and tgrelid = (select medya from m)) as deger,
         case when (select count(*) from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal and tgrelid = (select medya from m)) = 1
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_assets_quota tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal and tgrelid = (select medya from m) limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal and tgrelid = (select medya from m)
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER media_assets_quota BEFORE INSERT ON public.media_assets FOR EACH ROW EXECUTE FUNCTION %media_quota_check()')
              then 'TAMAM' else 'HATA: BEFORE INSERT / FOR EACH ROW beklenir' end
  union all
  select 3, 'media_assets_quota, media_assets_org''dan sonra sıralanır (ada göre, C sıralaması)',
         coalesce((select string_agg(g.tgname::text, ' > ' order by g.tgname::text collate "C" desc)
                     from pg_trigger g where g.tgrelid = (select medya from m) and not g.tgisinternal
                      and g.tgname in ('media_assets_org', 'media_assets_quota')), 'yok'),
         case when exists (select 1 from pg_trigger o, pg_trigger q
                            where o.tgrelid = (select medya from m) and o.tgname = 'media_assets_org' and not o.tgisinternal
                              and q.tgrelid = o.tgrelid and q.tgname = 'media_assets_quota' and not q.tgisinternal
                              and q.tgname::text collate "C" > o.tgname::text collate "C")
              then 'TAMAM' else 'HATA: sıra yanlış ya da tetikleyici eksik' end
  union all
  select 4, 'aa_quota_lock (properties / organization_members) hâlâ kurulu',
         (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.properties'))
           || ' / ' || (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.organization_members')),
         case when (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
                      and tgrelid in (to_regclass('public.properties'), to_regclass('public.organization_members'))) = 2
              then 'TAMAM' else 'HATA' end
  union all
  select 5, 'media_quota_check() yürütme yetkisi olan roller (anon / authenticated / service_role / PUBLIC olmamalı)',
         case when to_regprocedure('public.media_quota_check()') is null then 'yok'
              else coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end)
                               from f cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where a.privilege_type = 'EXECUTE'), 'hiçbir rol') end,
         case when to_regprocedure('public.media_quota_check()') is not null
                and not exists (select 1 from f cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role')))
              then 'TAMAM' else 'HATA: yetkiler beklenen değil' end
  union all
  select 6, 'media_quota_check() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = 'cbdb591185ab2551ffa72eb0d16c907f'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 7, 'media_quota_check() güvenlik modu ve search_path',
         case when to_regprocedure('public.media_quota_check()') is null then 'yok'
              else (select case when p.prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(p.proconfig, ','), 'ayar yok')
                      from pg_proc p where p.oid = to_regprocedure('public.media_quota_check()')) end,
         case when exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.media_quota_check()') and p.prosecdef
                              and p.proconfig @> array['search_path=""'])
              then 'TAMAM' else 'HATA: security definer ve boş search_path beklenir' end
  union all
  select 8, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
