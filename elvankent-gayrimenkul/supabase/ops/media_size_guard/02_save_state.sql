-- =============================================================================
-- Orijinal boyut koruması (20261108000001_media_size_guard.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- E yalnız bir tetikleyici ve fonksiyon ekler (veri ve politika değiştirmez). Geri dönüş sabittir (05_rollback.sql). Bu kayıt,
-- geri dönüşten sonra storage.objects tetikleyicilerinin uygulama öncesiyle birebir aynı olduğunu karşılaştırmak içindir.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET storage.objects üzerindeki tetikleyici tanımları' as ad,
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid = to_regclass('storage.objects') and not g.tgisinternal), 'yok') as deger
  union all
  select 2, 'KAYDET media_storage_size_guard() var mı',
         (to_regprocedure('public.media_storage_size_guard()') is not null)::text
  union all
  select 3, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
