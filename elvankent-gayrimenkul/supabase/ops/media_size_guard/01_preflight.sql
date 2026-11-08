-- =============================================================================
-- Orijinal boyut koruması (supabase/pending/20261108000001_media_size_guard.sql, KI-42, E) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın. "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Kapı: C (media_storage_slots) uygulanmamışsa, çalıştıran rolün storage.objects üzerinde TRIGGER hakkı yoksa ya da tetikleyici
-- 05 ile geri alınamayacaksa (sahip üyeliği ya da supautils drop_trigger_grants) DUR.
-- Çıktıda kurum adı, kimlik, dosya yolu ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
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
  select 4, 'C uygulanmış mı — media_storage_slot_guard tetikleyicisi ve bakım penceresi tablosu',
         (select count(*)::text from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects'))
           || ' / ' || (to_regclass('public.media_overwrite_window') is not null)::text,
         case when (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
                and to_regclass('public.media_overwrite_window') is not null
              then 'TAMAM' else 'DUR: apply C first — media_storage_slots/03_apply.sql uygulanmamış' end
  union all
  select 5, 'Çalıştıran rolün storage.objects üzerinde TRIGGER hakkı  [KAYDET]',
         current_user || ' · ' || has_table_privilege(current_user, 'storage.objects', 'trigger')::text,
         case when has_table_privilege(current_user, 'storage.objects', 'trigger') then 'TAMAM'
              else 'DUR: tetikleyici kurulamaz — sağlayıcı storage şemasını kısıtlıyor olabilir' end
  union all
  select 6, 'Geri alınabilirlik: storage.objects sahibi rolüne üyelik ya da supautils drop_trigger_grants  [KAYDET]',
         current_user || ' · ' || (pg_has_role(current_user, (select c.relowner from pg_class c where c.oid = to_regclass('storage.objects')), 'member')
            or coalesce(current_setting('supautils.drop_trigger_grants', true), '') like '%"' || current_user || '":[%"storage.objects"%')::text,
         case when pg_has_role(current_user, (select c.relowner from pg_class c where c.oid = to_regclass('storage.objects')), 'member')
                or coalesce(current_setting('supautils.drop_trigger_grants', true), '') like '%"' || current_user || '":[%"storage.objects"%'
              then 'TAMAM (05 mümkün)'
              else 'DUR: tetikleyici kurulabilir ama 05 ile KALDIRILAMAZ (must be owner); sağlayıcı ayarı doğrulanmadan uygulanmaz' end
  union all
  select 7, 'E uygulanmış mı — media_storage_size_guard tetikleyicisi  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')),
         case when (select count(*) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 0
              then 'TAMAM (henüz yok; 05 sonrası da 0 olmalı)'
              when (select count(*) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) = 1
              then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 8, 'storage.objects üzerindeki tetikleyici sayısı (E dışı)  [KAYDET]',
         (select count(*)::text from pg_trigger where tgrelid = to_regclass('storage.objects') and not tgisinternal and tgname <> 'media_storage_size_guard'),
         'BİLGİ: 05 sonrası aynı olmalı'
  union all
  select 9, 'Bildirilenden büyük orijinali olan bekleyen satır sayısı (yalnızca sayı)',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml(
           'select count(*) as n from public.media_assets m join storage.objects o on o.bucket_id = ''media-originals'' and o.name = m.original_path
             where m.status = ''pending'' and (o.metadata ->> ''size'') ~ ''^[0-9]{1,18}$'' and (o.metadata ->> ''size'')::bigint > m.byte_size',
           false, false, '') columns n text path 'n') x limit 1), 'yok'),
         'BİLGİ: E mevcut nesneleri değiştirmez; 0 değilse bu satırlar sonlandırmada gerçek boyutla sayılır'
  union all
  select 10, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem storage.objects kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 11, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
) kontroller
order by sira;
