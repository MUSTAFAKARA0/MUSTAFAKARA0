-- =============================================================================
-- İlk kurulum ve tasarım kilidi (supabase/pending/20261108000005_org_setup.sql, PILOT, I) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.proname::text as ad, p.prosrc, p.prosecdef, p.proconfig from pg_proc p
   where p.oid in (to_regprocedure('public.org_setup_complete(uuid,text,jsonb)'), to_regprocedure('public.org_setup_progress(uuid,integer,text)'),
                   to_regprocedure('public.platform_reopen_org_setup(uuid,text)'), to_regprocedure('public.site_configs_design_lock()'),
                   to_regprocedure('public.organization_setup_init()'))
),
rpc as (select * from f where ad in ('org_setup_complete', 'org_setup_progress', 'platform_reopen_org_setup')),
trg as (select * from f where ad in ('site_configs_design_lock', 'organization_setup_init')),
satir as (
  select x.organization_id from xmltable('/table/row' passing query_to_xml(
    case when to_regclass('public.organization_setup') is null then 'select null::uuid as organization_id where false'
         else 'select organization_id from public.organization_setup' end, false, false, '')
    columns organization_id uuid path 'organization_id') x
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'organization_setup tablosu ve RLS' as kontrol,
         coalesce((select c.relrowsecurity::text from pg_class c where c.oid = to_regclass('public.organization_setup')), 'yok') as deger,
         case when exists (select 1 from pg_class c where c.oid = to_regclass('public.organization_setup') and c.relrowsecurity) then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'Kurulum satırı olmayan ofis sayısı (03 hepsini işaretler; sonradan konsol dışı açılanlar satırsız)',
         (select count(*)::text from public.organizations o where not exists (select 1 from satir s where s.organization_id = o.id)),
         case when to_regclass('public.organization_setup') is null then 'HATA: organization_setup yok'
              when (select count(*) from public.organizations o where not exists (select 1 from satir s where s.organization_id = o.id)) = 0
              then 'BİLGİ: 03 sonrası 0; sonra service_role ile açılan ofisler satırsız kalır (eski davranış)'
              else 'BİLGİ: satırsız ofisler kurulum akışına girmez, kilitlenmez (konsol dışı açılış)' end
  union all
  select 3, 'site_configs_design_lock tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'site_configs_design_lock' and not tgisinternal limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'site_configs_design_lock' and not tgisinternal
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER site_configs_design_lock BEFORE UPDATE OF draft, published ON public.site_configs FOR EACH ROW EXECUTE FUNCTION %site_configs_design_lock()')
              then 'TAMAM' else 'HATA' end
  union all
  select 4, 'organization_setup_init tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'organization_setup_init' and not tgisinternal limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'organization_setup_init' and not tgisinternal
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER organization_setup_init AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION %organization_setup_init()')
              then 'TAMAM' else 'HATA' end
  union all
  select 5, 'Beş fonksiyon: security definer ve boş search_path',
         (select count(*)::text from f where prosecdef and proconfig @> array['search_path=""']),
         case when (select count(*) from f where prosecdef and proconfig @> array['search_path=""']) = 5 then 'TAMAM' else 'HATA' end
  union all
  select 6, 'org_setup_complete() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'org_setup_complete'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'org_setup_complete') = '7a742d3472f3e550b9822ecfebadf708'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 7, 'site_configs_design_lock() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'site_configs_design_lock'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'site_configs_design_lock') = '0f911d49868b165f81b0debb4cb3b867'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 12, 'org_setup_progress() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'org_setup_progress'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'org_setup_progress') = '3a7eec5f80ccb91bd03f1e30c592b8b5'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 13, 'platform_reopen_org_setup() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'platform_reopen_org_setup'), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f where ad = 'platform_reopen_org_setup') = 'c776170ffc0aad37f945431ec3a0ad63'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 8, 'Yetkiler: üç RPC anon / service_role kapalı, authenticated açık (yetki içeride)',
         coalesce((select string_agg(r.rolname::text || ':' || rpc.ad || '=' || has_function_privilege(r.oid, rpc.oid, 'execute')::text, ' ' order by r.rolname::text, rpc.ad)
                     from rpc cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when (select count(*) from rpc) = 3
                and not exists (select 1 from rpc cross join pg_roles r where r.rolname in ('anon', 'service_role') and has_function_privilege(r.oid, rpc.oid, 'execute'))
                and (select count(*) from rpc cross join pg_roles r where r.rolname = 'authenticated' and has_function_privilege(r.oid, rpc.oid, 'execute')) = 3
              then 'TAMAM' else 'HATA' end
  union all
  select 9, 'Yetkiler: iki tetikleyici fonksiyonu anon / authenticated / service_role için kapalı',
         coalesce((select string_agg(r.rolname::text || ':' || trg.ad || '=' || has_function_privilege(r.oid, trg.oid, 'execute')::text, ' ' order by r.rolname::text, trg.ad)
                     from trg cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when (select count(*) from trg) = 2
                and not exists (select 1 from trg cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') and has_function_privilege(r.oid, trg.oid, 'execute'))
              then 'TAMAM' else 'HATA' end
  union all
  select 10, 'Tablo yetkisi: authenticated yalnız okur, anon okuyamaz',
         case when to_regclass('public.organization_setup') is null then 'yok'
              else 'select=' || has_table_privilege('authenticated', 'public.organization_setup', 'select')::text
                   || ' insert=' || has_table_privilege('authenticated', 'public.organization_setup', 'insert')::text
                   || ' update=' || has_table_privilege('authenticated', 'public.organization_setup', 'update')::text
                   || ' delete=' || has_table_privilege('authenticated', 'public.organization_setup', 'delete')::text
                   || ' anon=' || has_table_privilege('anon', 'public.organization_setup', 'select')::text end,
         case when to_regclass('public.organization_setup') is not null
                and has_table_privilege('authenticated', 'public.organization_setup', 'select')
                and not has_table_privilege('authenticated', 'public.organization_setup', 'insert')
                and not has_table_privilege('authenticated', 'public.organization_setup', 'update')
                and not has_table_privilege('authenticated', 'public.organization_setup', 'delete')
                and not has_table_privilege('anon', 'public.organization_setup', 'select')
              then 'TAMAM' else 'HATA' end
  union all
  select 11, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
