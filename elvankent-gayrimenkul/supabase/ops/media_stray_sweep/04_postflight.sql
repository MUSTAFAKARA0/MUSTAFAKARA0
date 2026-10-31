-- =============================================================================
-- Başıboş medya dosyaları (20261031000001_media_stray_sweep.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.media_stray_objects(integer)')
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'media_stray_objects: güvenlik modu ve search_path (security definer, boş search_path)' as kontrol,
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from f), 'yok') as deger,
         case when exists (select 1 from f where prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_stray_objects gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = 'a87754bc2cb4da9ffc4040c06bc3e4bf' then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 3, 'Yetki: anon / authenticated / service_role',
         coalesce((select string_agg(r.rolname::text || '=' || has_function_privilege(r.oid, f.oid, 'execute')::text, ' ' order by r.rolname::text)
                     from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when exists (select 1 from f)
                and not exists (select 1 from f cross join pg_roles r where r.rolname in ('anon', 'authenticated') and has_function_privilege(r.oid, f.oid, 'execute'))
                and exists (select 1 from f cross join pg_roles r where r.rolname = 'service_role' and has_function_privilege(r.oid, f.oid, 'execute'))
              then 'TAMAM' else 'HATA' end
  union all
  select 4, 'A hâlâ kurulu (media_queue_claim)', (to_regprocedure('public.media_queue_claim(integer)') is not null)::text,
         case when to_regprocedure('public.media_queue_claim(integer)') is not null then 'TAMAM' else 'HATA' end
  union all
  select 5, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok' else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
