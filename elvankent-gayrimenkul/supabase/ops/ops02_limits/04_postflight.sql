-- =============================================================================
-- OPS-02 (20261025000002_ops02_subscription_limits.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı. Bayrak bu aşamada KAPALI kalır.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- =============================================================================
with
v as (
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') as bayrak_var,
         (select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') as varsayilan,
         (select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') as bos_olur,
         (select p.prosrc from pg_proc p where p.oid = to_regprocedure('public.org_plan(uuid)')) as plan_gov
),
c as (
  select case when not (select bayrak_var from v) then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.platform_settings where enforce_subscription_limits', false, false, '') columns n int path 'n') x limit 1) end as acik,
         case when not (select bayrak_var from v) then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.platform_settings', false, false, '') columns n int path 'n') x limit 1) end as satir
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'enforce_subscription_limits sütunu (varsayılan false, NOT NULL)' as kontrol,
         case when (select bayrak_var from v) then 'var · varsayılan ' || coalesce((select varsayilan from v), 'yok') || ' · null olabilir: ' || (select bos_olur from v)
              else 'yok' end as deger,
         case when (select bayrak_var from v) and (select varsayilan from v) = 'false' and (select bos_olur from v) = 'NO'
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'Bayrak AÇIK satır sayısı (OPS-02 KAPALI kalmalı)',
         coalesce((select acik from c)::text, '-'),
         case when (select acik from c) = 0 then 'TAMAM' else 'HATA: bayrak açık ya da sütun yok' end
  union all
  select 3, 'platform_settings satır sayısı', coalesce((select satir from c)::text, '-'),
         case when (select satir from c) = 1 then 'TAMAM' else 'HATA: tek satır bekleniyordu' end
  union all
  select 4, 'org_plan(uuid) gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(plan_gov, '\s+', ' ', 'g'))) from v), 'yok'),
         case when (select md5(btrim(regexp_replace(plan_gov, '\s+', ' ', 'g'))) from v) = '2c003a00cf1dcb95257ba9addf5e994f'
              then 'TAMAM (bekleyen dosyadaki tanımla aynı)' else 'HATA: org_plan bekleyen dosyadaki tanımla aynı değil' end
  union all
  select 5, 'org_plan(uuid) özellikleri (security definer · stable · search_path boş)',
         case when to_regprocedure('public.org_plan(uuid)') is null then 'yok'
              else (select case when p.prosecdef then 'security definer' else 'security invoker' end || ' · ' || p.provolatile::text || ' · ' || coalesce(array_to_string(p.proconfig, ','), 'ayar yok')
                      from pg_proc p where p.oid = to_regprocedure('public.org_plan(uuid)')) end,
         case when exists (select 1 from pg_proc p where p.oid = to_regprocedure('public.org_plan(uuid)') and p.prosecdef
                              and p.provolatile = 's' and p.proconfig @> array['search_path=""'])
              then 'TAMAM' else 'HATA' end
  union all
  select 6, 'org_plan(uuid) yürütme yetkisi (anon ve authenticated korunmalı; site bayrakları anonim okunur)',
         case when to_regprocedure('public.org_plan(uuid)') is null then 'yok'
              else coalesce((select string_agg(case when a.grantee = 0 then 'PUBLIC' else r.rolname end, ', ' order by case when a.grantee = 0 then 'PUBLIC' else r.rolname end)
                               from pg_proc p
                               cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where p.oid = to_regprocedure('public.org_plan(uuid)') and a.privilege_type = 'EXECUTE'), 'hiçbir rol') end,
         case when to_regprocedure('public.org_plan(uuid)') is not null
                and has_function_privilege('anon', 'public.org_plan(uuid)', 'execute')
                and has_function_privilege('authenticated', 'public.org_plan(uuid)', 'execute')
              then 'TAMAM (02 çıktısıyla aynı olmalı)' else 'HATA: yetkiler beklenen değil' end
  union all
  select 7, 'aa_quota_lock tetikleyicileri (properties + organization_members, önkoşul)',
         (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
             and tgrelid in (to_regclass('public.properties'), to_regclass('public.organization_members'))),
         case when (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
                       and tgrelid in (to_regclass('public.properties'), to_regclass('public.organization_members'))) = 2
              then 'TAMAM' else 'HATA' end
  union all
  select 8, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
