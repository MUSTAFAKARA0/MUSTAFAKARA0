-- =============================================================================
-- Medya depolama yuvaları (20261027000003_media_storage_slots.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- Davranış kanıtı (satırsız / sonlandırma sonrası yazım reddi) bu betikle değil, README "Canlı deneme" ile görülür.
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.media_storage_slot_guard()')
),
h as (
  select p.oid, p.proname::text as ad, p.prosecdef, p.proconfig
    from pg_proc p
   where p.oid in (to_regprocedure('public.media_original_slot_org(text)'), to_regprocedure('public.media_variant_slot_org(text)'),
                   to_regprocedure('public.media_original_slot_open(text)'), to_regprocedure('public.media_variant_slot_open(text)'))
),
pol as (
  select count(*) filter (where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'media_(original|variant)_slot_open') as yuvali,
         count(*) filter (where cmd = 'UPDATE' and coalesce(with_check, '') ~ 'media_(original|variant)_slot_open') as guncelleme_kontrol,
         count(*) as toplam
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('media_originals_insert', 'media_originals_update', 'media_insert', 'media_update')
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'media_storage_slot_guard — storage.objects (tam bir kez)' as kontrol,
         (select count(*)::text from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) as deger,
         case when (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_storage_slot_guard tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects') limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER media_storage_slot_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION %media_storage_slot_guard()')
              then 'TAMAM' else 'HATA: BEFORE INSERT OR UPDATE / FOR EACH ROW beklenir' end
  union all
  select 3, 'media_storage_slot_guard(): güvenlik modu ve search_path (security definer, boş search_path)',
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from f), 'yok'),
         case when exists (select 1 from f where prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end
  union all
  select 4, 'media_storage_slot_guard() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = '69075479c5ae1122d2caa3a4192b19f7'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 5, 'Yuva fonksiyonları (4): security definer ve boş search_path',
         (select count(*)::text from h where prosecdef and proconfig @> array['search_path=""']),
         case when (select count(*) from h where prosecdef and proconfig @> array['search_path=""']) = 4 then 'TAMAM' else 'HATA' end
  union all
  select 6, 'Yetkiler: *_slot_open authenticated açık, anon/PUBLIC kapalı; *_slot_org ve guard hiçbir istemciye açık değil',
         (select string_agg(r.rolname::text || ':' || h.ad || '=' || has_function_privilege(r.oid, h.oid, 'execute')::text, ' ' order by r.rolname::text, h.ad)
            from h cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')),
         case when (select bool_and(case when r.rolname = 'authenticated' and h.ad like '%_slot_open' then has_function_privilege(r.oid, h.oid, 'execute')
                                         else not has_function_privilege(r.oid, h.oid, 'execute') end)
                      from h cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role'))
                and not exists (select 1 from f cross join pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') and has_function_privilege(r.oid, f.oid, 'execute'))
                and (select count(*) from h) = 4
              then 'TAMAM' else 'HATA' end
  union all
  select 7, 'Dört yazma politikası: toplam / yuva şartlı / UPDATE with check yuva şartlı',
         (select toplam::text || ' / ' || yuvali::text || ' / ' || guncelleme_kontrol::text from pol),
         case when (select toplam from pol) = 4 and (select yuvali from pol) = 4 and (select guncelleme_kontrol from pol) = 2 then 'TAMAM' else 'HATA' end
  union all
  select 8, 'Bakım penceresi tablosu: RLS açık, anon/authenticated/service_role erişimi yok',
         coalesce((select c.relrowsecurity::text from pg_class c where c.oid = to_regclass('public.media_overwrite_window')), 'yok'),
         case when exists (select 1 from pg_class c where c.oid = to_regclass('public.media_overwrite_window') and c.relrowsecurity)
                and not exists (select 1 from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role')
                                  and (has_table_privilege(r.oid, 'public.media_overwrite_window', 'select')
                                       or has_table_privilege(r.oid, 'public.media_overwrite_window', 'insert')
                                       or has_table_privilege(r.oid, 'public.media_overwrite_window', 'update')))
              then 'TAMAM' else 'HATA' end
  union all
  select 9, 'Bakım penceresi açık mı (açık kalmamalı)',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.media_overwrite_window where open_until > now()', false, false, '') columns n text path 'n') x limit 1), 'tablo yok'),
         case when coalesce((select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.media_overwrite_window where open_until > now()', false, false, '') columns n text path 'n') x limit 1), 'tablo yok') = '0'
              then 'TAMAM' else 'HATA: pencere açık ya da tablo yok' end
  union all
  select 10, 'A ve B hâlâ kurulu (media_finalize, media_assets_pending_shape)',
         (to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null)::text || ' / '
           || (select count(*)::text from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal),
         case when to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null
                and (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal) = 1 then 'TAMAM' else 'HATA' end
  union all
  select 11, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
