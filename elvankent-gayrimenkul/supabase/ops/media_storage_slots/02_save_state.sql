-- =============================================================================
-- Medya depolama yuvaları (20261027000003_media_storage_slots.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
--
-- C dört storage.objects politikasını DEĞİŞTİRİR ve bir tetikleyici ekler (veri değil). Geri dönüş sabittir (05_rollback.sql):
-- politikalar 20260926000008_v2_storage.sql'deki hâliyle yeniden kurulur. Bu kayıt, geri dönüşten sonra tanımların uygulama
-- öncesiyle birebir aynı olduğunu karşılaştırmak içindir (canlıda elle değiştirilmiş bir politika varsa 05 onu GERİ GETİRMEZ;
-- bu çıktıdaki tanım elle kurulur).
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET dört yazma politikasının tanımı (komut · roller · using · with check)' as ad,
         coalesce((select string_agg(p.policyname::text || ' · ' || p.cmd || ' · ' || array_to_string(p.roles, ',') || ' · '
                                     || coalesce(p.qual, '-') || ' · ' || coalesce(p.with_check, '-'), E'\n' order by p.policyname::text)
                     from pg_policies p
                    where p.schemaname = 'storage' and p.tablename = 'objects'
                      and p.policyname in ('media_originals_insert', 'media_originals_update', 'media_insert', 'media_update')), 'yok') as deger
  union all
  select 2, 'KAYDET storage.objects üzerindeki tetikleyici tanımları',
         coalesce((select string_agg(pg_get_triggerdef(g.oid), E'\n' order by g.tgname::text)
                     from pg_trigger g where g.tgrelid = to_regclass('storage.objects') and not g.tgisinternal), 'yok')
  union all
  select 3, 'KAYDET yuva fonksiyonları ve bakım penceresi tablosu (var mı)',
         (to_regprocedure('public.media_storage_slot_guard()') is not null)::text || ' / '
           || (to_regprocedure('public.media_original_slot_open(text)') is not null)::text || ' / '
           || (to_regprocedure('public.media_variant_slot_open(text)') is not null)::text || ' / '
           || (to_regclass('public.media_overwrite_window') is not null)::text
  union all
  select 4, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
