-- =============================================================================
-- Medya depolama yuvaları (supabase/pending/20261027000003_media_storage_slots.sql, WP-A2/C, KI-37) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın (metin olarak). "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Bu betik C'nin kapısıdır: A ya da B uygulanmamışsa, çalıştıran rolün storage.objects üzerinde TRIGGER hakkı yoksa DUR.
-- Çıktıda kurum adı, kimlik, dosya yolu ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
),
pol as (
  select count(*) filter (where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'media_(original|variant)_slot_open') as yuvali,
         count(*) as toplam
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('media_originals_insert', 'media_originals_update', 'media_insert', 'media_update')
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
  select 4, 'A uygulanmış mı — media_finalize',
         (to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null)::text,
         case when to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null
              then 'TAMAM' else 'DUR: apply A first — media_finalize_rpc/03_apply.sql uygulanmamış' end
  union all
  select 5, 'B uygulanmış mı — media_assets_pending_shape',
         (select count(*)::text from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')),
         case when (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')) = 1
              then 'TAMAM' else 'DUR: apply B first — media_privileges/03_apply.sql uygulanmamış' end
  union all
  select 6, 'Çalıştıran rolün storage.objects üzerinde TRIGGER hakkı  [KAYDET]',
         current_user || ' · ' || has_table_privilege(current_user, 'storage.objects', 'trigger')::text,
         case when has_table_privilege(current_user, 'storage.objects', 'trigger') then 'TAMAM'
              else 'DUR: tetikleyici kurulamaz — sağlayıcı storage şemasını kısıtlıyor olabilir; README "Sağlayıcı kısıtı"' end
  union all
  select 7, 'C uygulanmış mı — media_storage_slot_guard tetikleyicisi  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')),
         case when (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 0
              then 'TAMAM (henüz yok)'
              when (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
              then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 8, 'Dört yazma politikası (media_originals_insert/update, media_insert/update): toplam / yuva şartlı  [KAYDET]',
         (select toplam::text || ' / ' || yuvali::text from pol),
         case when (select toplam from pol) = 4 and (select yuvali from pol) = 0 then 'TAMAM (C öncesi beklenen; 05 sonrası aynı olmalı)'
              when (select toplam from pol) = 4 and (select yuvali from pol) = 4 then 'BİLGİ: C zaten uygulanmış'
              else 'DUR: politikalar beklenen hâlde değil (20260926000008_v2_storage.sql ile karşılaştırın)' end
  union all
  select 9, 'storage.objects üzerindeki tetikleyici sayısı (C dışı)  [KAYDET]',
         (select count(*)::text from pg_trigger where tgrelid = to_regclass('storage.objects') and not tgisinternal and tgname <> 'media_storage_slot_guard'),
         'BİLGİ: 05 sonrası aynı olmalı'
  union all
  select 10, 'Bekleyen (pending) medya satırı sayısı (yalnızca sayı)',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.media_assets where status = ''pending''', false, false, '') columns n text path 'n') x limit 1), 'yok'),
         'BİLGİ: süren yüklemeler bekleyen satırla devam eder; C onları etkilemez'
  union all
  select 11, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem storage.objects kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 12, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
) kontroller
order by sira;
