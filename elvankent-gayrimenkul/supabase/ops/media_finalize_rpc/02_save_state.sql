-- =============================================================================
-- Medya sonlandırma RPC'si (20261027000001_media_finalize_rpc.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- A yalnızca yeni nesne ekler (fonksiyonlar, kuyruk tablosu, silme tetikleyicisi); önceki veri/tanım kaybolmaz.
-- Geri dönüş sabittir (05_rollback.sql). Bu kayıt, geri dönüşten sonra durumun uygulama öncesiyle aynı olduğunu
-- karşılaştırmak içindir.
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET A fonksiyonları (ad ve bağımsız değişkenler)' as ad,
         coalesce((select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', E'\n' order by p.proname)
                     from pg_proc p where p.pronamespace = 'public'::regnamespace
                      and p.proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files')), 'yok') as deger
  union all
  select 2, 'KAYDET media_file_queue tablosu',
         case when to_regclass('public.media_file_queue') is null then 'yok' else 'var' end
  union all
  select 3, 'KAYDET media_assets üzerindeki tetikleyici tanımları',
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid = to_regclass('public.media_assets') and not g.tgisinternal), 'yok')
  union all
  select 4, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
