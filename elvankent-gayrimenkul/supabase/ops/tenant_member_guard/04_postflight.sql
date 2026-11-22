-- =============================================================================
-- Kiracı üyelik koruması (20261108000002_tenant_member_guard.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.proname::text as ad, p.prosrc, p.prosecdef, p.proconfig from pg_proc p
   where p.oid in (to_regprocedure('public.organization_members_target_guard()'), to_regprocedure('public.properties_og_media_guard()'))
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'organization_members_target_guard tetikleyici tanımı' as kontrol,
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'organization_members_target_guard' and not tgisinternal limit 1), 'yok') as deger,
         case when exists (select 1 from pg_trigger where tgname = 'organization_members_target_guard' and not tgisinternal
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER organization_members_target_guard BEFORE INSERT OR UPDATE OF user_id ON public.organization_members FOR EACH ROW EXECUTE FUNCTION %organization_members_target_guard()')
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'properties_og_media_guard tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'properties_og_media_guard' and not tgisinternal limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'properties_og_media_guard' and not tgisinternal
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER properties_og_media_guard BEFORE INSERT OR UPDATE OF og_media_id, organization_id ON public.properties FOR EACH ROW EXECUTE FUNCTION %properties_og_media_guard()')
              then 'TAMAM' else 'HATA' end
  union all
  select 3, 'İki fonksiyon: security definer ve boş search_path',
         (select count(*)::text from f where prosecdef and proconfig @> array['search_path=""']),
         case when (select count(*) from f where prosecdef and proconfig @> array['search_path=""']) = 2 then 'TAMAM' else 'HATA' end
  union all
  select 4, 'organization_members_target_guard() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'organization_members_target_guard'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'organization_members_target_guard') = '25e0889890a805e1fdd52bb5ed8d1cbb'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 5, 'properties_og_media_guard() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'properties_og_media_guard'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'properties_og_media_guard') = 'f307d632ade225f98eb0350f91098cee'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 6, 'Yetkiler: iki fonksiyon anon / authenticated / service_role için kapalı',
         coalesce((select string_agg(r.rolname::text || ':' || f.ad || '=' || has_function_privilege(r.oid, f.oid, 'execute')::text, ' ' order by r.rolname::text, f.ad)
                     from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when (select count(*) from f) = 2
                and not exists (select 1 from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') and has_function_privilege(r.oid, f.oid, 'execute'))
              then 'TAMAM' else 'HATA' end
  union all
  select 7, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
