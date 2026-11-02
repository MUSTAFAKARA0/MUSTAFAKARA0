-- =============================================================================
-- Medya sütun yetkileri (20261027000002_media_column_privileges.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.prosrc, p.prosecdef, p.proconfig from pg_proc p where p.oid = to_regprocedure('public.media_assets_pending_shape()')
),
c as (
  select (select string_agg(a.attname::text, ', ' order by a.attname::text) from pg_attribute a
           where a.attrelid = to_regclass('public.media_assets') and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', to_regclass('public.media_assets'), a.attnum, 'update')) as guncel,
         (select string_agg(a.attname::text, ', ' order by a.attname::text) from pg_attribute a
           where a.attrelid = to_regclass('public.media_assets') and a.attnum > 0 and not a.attisdropped
             and has_column_privilege('authenticated', to_regclass('public.media_assets'), a.attnum, 'insert')) as ekle
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'media_assets_pending_shape — media_assets (tam bir kez)' as kontrol,
         (select count(*)::text from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')) as deger,
         case when (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')) = 1
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_assets_pending_shape tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets') limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER media_assets_pending_shape BEFORE INSERT ON public.media_assets FOR EACH ROW EXECUTE FUNCTION %media_assets_pending_shape()')
              then 'TAMAM' else 'HATA: BEFORE INSERT / FOR EACH ROW beklenir' end
  union all
  select 3, 'media_assets_pending_shape(): güvenlik modu ve search_path (security invoker, boş search_path)',
         coalesce((select case when prosecdef then 'security definer' else 'security invoker' end || ' · ' || coalesce(array_to_string(proconfig, ','), 'ayar yok') from f), 'yok'),
         case when exists (select 1 from f where not prosecdef and proconfig @> array['search_path=""']) then 'TAMAM' else 'HATA' end
  union all
  select 4, 'media_assets_pending_shape() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = '3f0710e3347fe19f679c153df5575342'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 5, 'authenticated UPDATE sütunları (yalnız alt_text, is_cover, sort_order)',
         coalesce((select guncel from c), 'hiçbiri'),
         case when (select guncel from c) = 'alt_text, is_cover, sort_order' then 'TAMAM' else 'HATA' end
  union all
  select 6, 'authenticated INSERT sütunları (12 sütun; variants_byte_size, public_base, is_cover yok)',
         coalesce((select ekle from c), 'hiçbiri'),
         case when (select ekle from c) = 'alt_text, byte_size, created_by, id, kind, mime_type, organization_id, original_filename, original_path, property_id, sort_order, status'
              then 'TAMAM' else 'HATA' end
  union all
  select 7, 'authenticated tablo düzeyi yetkiler (update / insert / truncate / references / trigger yok; delete var)',
         has_table_privilege('authenticated', 'public.media_assets', 'update')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'insert')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'truncate')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'references')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'trigger')::text || ' / delete ' || has_table_privilege('authenticated', 'public.media_assets', 'delete')::text,
         case when not has_table_privilege('authenticated', 'public.media_assets', 'update') and not has_table_privilege('authenticated', 'public.media_assets', 'insert')
                and not has_table_privilege('authenticated', 'public.media_assets', 'truncate') and not has_table_privilege('authenticated', 'public.media_assets', 'references')
                and not has_table_privilege('authenticated', 'public.media_assets', 'trigger') and has_table_privilege('authenticated', 'public.media_assets', 'delete')
              then 'TAMAM' else 'HATA' end
  union all
  select 8, 'A hâlâ kurulu (media_finalize, media_mark_failed)',
         (to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null)::text || ' / ' || (to_regprocedure('public.media_mark_failed(uuid,text)') is not null)::text,
         case when to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null
                and to_regprocedure('public.media_mark_failed(uuid,text)') is not null then 'TAMAM' else 'HATA' end
  union all
  select 9, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
