-- =============================================================================
-- Pilot deneme bitişi (supabase/pending/20261108000004_pilot_trial_end.sql, PILOT, H) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
-- =============================================================================
with f as (select p.oid, p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)'))
select sira, kontrol, deger, durum from (
  select 1 as sira, 'platform_set_trial_end: security definer, boş search_path' as kontrol,
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from f), 'yok') as deger,
         case when exists (select 1 from f where prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'Gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = 'ae6897228d4b0151f4b88f3fafdcf595' then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 3, 'Yetkiler: anon / service_role kapalı, authenticated açık (süper yönetici denetimi içeride)',
         coalesce((select string_agg(r.rolname::text || '=' || has_function_privilege(r.oid, f.oid, 'execute')::text, ' ' order by r.rolname::text)
                     from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when exists (select 1 from f)
                and not exists (select 1 from f cross join pg_roles r where r.rolname in ('anon', 'service_role') and has_function_privilege(r.oid, f.oid, 'execute'))
                and exists (select 1 from f cross join pg_roles r where r.rolname = 'authenticated' and has_function_privilege(r.oid, f.oid, 'execute'))
              then 'TAMAM' else 'HATA' end
  union all
  select 4, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
