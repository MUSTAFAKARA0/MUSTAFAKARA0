-- =============================================================================
-- Kiracı izolasyonu kalanları (supabase/pending/20261124000001_tenant_hardening.sql, KI-46, J) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
-- =============================================================================
with
g as (select p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.get_public_collection(text)')),
a as (select p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.crm_assignee_guard()'))
select sira, kontrol, deger, durum from (
  select 1 as sira, 'Atama tetikleyicileri (leads, appointments)' as kontrol,
         (select string_agg(pg_get_triggerdef(t.oid), E'\n' order by t.tgname) from pg_trigger t
           where t.tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not t.tgisinternal) as deger,
         case when (select count(*) from pg_trigger where tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not tgisinternal) = 2
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'crm_assignee_guard(): security definer, boş search_path',
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from a), 'yok'),
         case when exists (select 1 from a where prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end
  union all
  select 3, 'crm_assignee_guard() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from a), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from a) = 'f8a0b78f8263af44a73d55f7615e6787' then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 4, 'get_public_collection() gövde özeti (md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from g), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from g) = '44f057caf6a185d39963ba58dc515608' then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 5, 'get_public_collection(): security definer, boş search_path; anon çalıştırabilir',
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from g), 'yok')
           || ' · anon=' || has_function_privilege('anon', 'public.get_public_collection(text)', 'execute')::text,
         case when exists (select 1 from g where prosecdef and proconfig @> array['search_path=""'])
                and has_function_privilege('anon', 'public.get_public_collection(text)', 'execute') then 'TAMAM' else 'HATA' end
  union all
  select 6, 'Yetkiler: tetikleyici fonksiyonu anon / authenticated / service_role için kapalı',
         'anon=' || has_function_privilege('anon', 'public.crm_assignee_guard()', 'execute')::text
           || ' authenticated=' || has_function_privilege('authenticated', 'public.crm_assignee_guard()', 'execute')::text
           || ' service_role=' || has_function_privilege('service_role', 'public.crm_assignee_guard()', 'execute')::text,
         case when not has_function_privilege('anon', 'public.crm_assignee_guard()', 'execute')
                and not has_function_privilege('authenticated', 'public.crm_assignee_guard()', 'execute')
                and not has_function_privilege('service_role', 'public.crm_assignee_guard()', 'execute') then 'TAMAM' else 'HATA' end
  union all
  select 7, 'anon SELECT: organization_settings / organization_domains kapalı; organizations açık (sağlık sorgusu)',
         has_table_privilege('anon', 'public.organization_settings', 'select')::text || ' / ' || has_table_privilege('anon', 'public.organization_domains', 'select')::text
           || ' · organizations=' || has_table_privilege('anon', 'public.organizations', 'select')::text,
         case when not has_table_privilege('anon', 'public.organization_settings', 'select') and not has_table_privilege('anon', 'public.organization_domains', 'select')
                and has_table_privilege('anon', 'public.organizations', 'select') then 'TAMAM' else 'HATA' end
  union all
  select 8, 'neighborhoods: ekleme politikası yok, okuma politikası duruyor',
         'insert=' || exists (select 1 from pg_policy where polname = 'neighborhoods_insert_members' and polrelid = to_regclass('public.neighborhoods'))::text
           || ' read=' || exists (select 1 from pg_policy where polname = 'neighborhoods_read' and polrelid = to_regclass('public.neighborhoods'))::text,
         case when not exists (select 1 from pg_policy where polname = 'neighborhoods_insert_members' and polrelid = to_regclass('public.neighborhoods'))
                and exists (select 1 from pg_policy where polname = 'neighborhoods_read' and polrelid = to_regclass('public.neighborhoods')) then 'TAMAM' else 'HATA' end
  union all
  select 9, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
