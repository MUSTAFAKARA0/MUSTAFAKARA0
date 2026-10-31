-- =============================================================================
-- Başıboş medya dosyaları (supabase/pending/20261031000001_media_stray_sweep.sql, WP-A2/D, KI-38) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın. "durum" sütununda DUR varsa 03 UYGULANMAZ. A (media_finalize_rpc) uygulanmamışsa DUR.
-- Çıktıda kurum adı, kimlik ya da dosya yolu yoktur; yalnızca sayı ve nesne durumu.
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'Ortam işareti' as kontrol,
         case when to_regclass('elvankent_demo.environment') is not null then 'DEMO veritabanı (elvankent_demo işareti var)'
              else 'demo işareti yok' end as deger,
         'BİLGİ: uygulamanın kullandığı proje bu mu? Vercel''deki NEXT_PUBLIC_SUPABASE_URL ile panelden karşılaştırın' as durum
  union all
  select 2, 'Sunucu / rol', current_database() || ' · PostgreSQL ' || current_setting('server_version') || ' · rol ' || current_user, 'BİLGİ'
  union all
  select 3, 'Şema sürümü — karay_schema_version()  [KAYDET]', coalesce((select surum from v), 'fonksiyon yok'),
         case when (select surum from v) is null then 'DUR: fonksiyon yok — önceki migration''lar eksik (PRODUCTION_MIGRATION.md)'
              when (select surum from v) < '20261018000001' then 'DUR: şema eski — önce 20261018000001''e kadar migration''lar'
              when (select surum from v) = '20261018000001' then 'TAMAM (beklenen sürüm; bu betik sürümü DEĞİŞTİRMEZ)'
              else 'BİLGİ: şema daha yeni; bu betik sürümü değiştirmez' end
  union all
  select 4, 'A uygulanmış mı — media_queue_claim / media_finalize',
         (to_regprocedure('public.media_queue_claim(integer)') is not null)::text,
         case when to_regprocedure('public.media_queue_claim(integer)') is not null
                and to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null
              then 'TAMAM' else 'DUR: apply A first — media_finalize_rpc/03_apply.sql uygulanmamış' end
  union all
  select 5, 'D uygulanmış mı — media_stray_objects  [KAYDET]',
         (to_regprocedure('public.media_stray_objects(integer)') is not null)::text,
         case when to_regprocedure('public.media_stray_objects(integer)') is null then 'TAMAM (henüz yok)' else 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)' end
  union all
  select 6, 'media / media-originals kovalarındaki nesne sayısı (yalnızca sayı)  [KAYDET]',
         (select count(*)::text from storage.objects where bucket_id in ('media', 'media-originals')),
         'BİLGİ: D yalnız okur; silmeyi günlük cron yapar (yeni kodla)'
  union all
  select 7, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem bekletebilir; bitmesini bekleyin' end
) kontroller
order by sira;
