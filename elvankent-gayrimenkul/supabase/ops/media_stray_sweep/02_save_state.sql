-- =============================================================================
-- Başıboş medya dosyaları (20261031000001_media_stray_sweep.sql) — 2/5 DURUM KAYDI (geri dönüş için)
--
-- YALNIZCA OKUR: tek bir SELECT. Uygulamadan ÖNCE çalıştırın; çıktının TAMAMINI saklayın.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 02_save_state.sql
-- D yalnız bir fonksiyon ekler (veri ve yetki değişmez). Geri dönüş sabittir (05: fonksiyon silinir).
-- =============================================================================
select sira, ad, deger from (
  select 1 as sira, 'KAYDET media_stray_objects var mı' as ad, (to_regprocedure('public.media_stray_objects(integer)') is not null)::text as deger
  union all
  select 2, 'KAYDET şema sürümü',
         case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end
) durum
order by sira;
