-- =============================================================================
-- Orijinal boyut koruması (20261108000001_media_size_guard.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- Davranış kanıtı (bildirilenden büyük yüklemenin reddi) bu betikle değil, README "Canlı deneme" ile görülür.
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.media_storage_size_guard()')
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'media_storage_size_guard — storage.objects (tam bir kez)' as kontrol,
         (select count(*)::text from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) as deger,
         case when (select count(*) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_storage_size_guard tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects') limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER media_storage_size_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION %media_storage_size_guard()')
              then 'TAMAM' else 'HATA: BEFORE INSERT OR UPDATE / FOR EACH ROW beklenir' end
  union all
  select 3, 'media_storage_size_guard(): güvenlik modu ve search_path (security definer, boş search_path)',
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from f), 'yok'),
         case when exists (select 1 from f where prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end
  union all
  select 4, 'media_storage_size_guard() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = '7fada704d559c3a3fc9b334ad186db43'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 5, 'Yetkiler: tetikleyici fonksiyonu anon / authenticated / service_role için kapalı',
         coalesce((select string_agg(r.rolname::text || '=' || has_function_privilege(r.oid, f.oid, 'execute')::text, ' ' order by r.rolname::text)
                     from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')), 'yok'),
         case when exists (select 1 from f)
                and not exists (select 1 from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') and has_function_privilege(r.oid, f.oid, 'execute'))
              then 'TAMAM' else 'HATA' end
  union all
  select 6, 'C hâlâ kurulu (media_storage_slot_guard)',
         (select count(*)::text from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')),
         case when (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
              then 'TAMAM' else 'HATA' end
  union all
  select 7, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
