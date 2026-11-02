-- =============================================================================
-- Medya sütun yetkileri (20261027000002_media_column_privileges.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- B yetkileri DEĞİŞTİRİR (veri değil). Geri dönüş sabittir (05_rollback.sql): tablo düzeyi UPDATE/INSERT/TRUNCATE/
-- REFERENCES/TRIGGER geri verilir. Bu kayıt, geri dönüşten sonra durumun uygulama öncesiyle aynı olduğunu
-- karşılaştırmak içindir (özellikle varsayılan olmayan bir yetki varsa).
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET media_assets ACL (tablo)' as ad,
         coalesce((select c.relacl::text from pg_class c where c.oid = to_regclass('public.media_assets')), 'varsayılan') as deger
  union all
  select 2, 'KAYDET media_assets sütun ACL''leri (varsa)',
         coalesce((select string_agg(a.attname::text || '=' || a.attacl::text, E'\n' order by a.attname::text)
                     from pg_attribute a where a.attrelid = to_regclass('public.media_assets') and a.attnum > 0 and not a.attisdropped and a.attacl is not null), 'yok')
  union all
  select 3, 'KAYDET authenticated tablo yetkileri (update / insert / truncate / references / trigger / delete)',
         has_table_privilege('authenticated', 'public.media_assets', 'update')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'insert')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'truncate')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'references')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'trigger')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'delete')::text
  union all
  select 4, 'KAYDET media_assets üzerindeki tetikleyici tanımları',
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid = to_regclass('public.media_assets') and not g.tgisinternal), 'yok')
  union all
  select 5, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
