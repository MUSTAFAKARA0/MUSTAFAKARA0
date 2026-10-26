-- =============================================================================
-- Medya sonlandırma RPC'si (supabase/pending/20261027000001_media_finalize_rpc.sql, WP-A2/A) — 1/5 ÖN KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın (metin olarak). "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Çıktıda kurum adı, kimlik ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
-- Adımlar ve gerekçe: README.md
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
),
a as (
  select (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
             and p.proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files')) as fonksiyon,
         (select count(*) from pg_trigger where tgname = 'media_assets_enqueue_files' and not tgisinternal
             and tgrelid = to_regclass('public.media_assets')) as tetikleyici,
         (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal
             and tgrelid = to_regclass('public.media_assets')) as sekil,
         case when to_regclass('public.media_file_queue') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.media_file_queue', false, false, '') columns n text path 'n') x limit 1)
         end as kuyruk
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
  select 4, 'Gerekli nesneler (media_assets, org_plan, has_org_permission, is_super_admin, storage.objects)',
         (to_regclass('public.media_assets') is not null)::text || ' / ' || (to_regprocedure('public.org_plan(uuid)') is not null)::text || ' / '
           || (to_regprocedure('public.has_org_permission(uuid,text)') is not null)::text || ' / ' || (to_regprocedure('public.is_super_admin()') is not null)::text
           || ' / ' || (to_regclass('storage.objects') is not null)::text,
         case when to_regclass('public.media_assets') is not null and to_regprocedure('public.org_plan(uuid)') is not null
                and to_regprocedure('public.has_org_permission(uuid,text)') is not null and to_regprocedure('public.is_super_admin()') is not null
                and to_regclass('storage.objects') is not null
              then 'TAMAM' else 'DUR: nesne yok' end
  union all
  select 5, 'Depolama erişimi: fonksiyonları kuracak rol (storage.objects SELECT hakkı / RLS atlama)',
         case when to_regclass('storage.objects') is null then 'storage.objects yok'
              else current_user || ' · select ' || has_table_privilege(current_user, 'storage.objects', 'select')::text
                   || ' · rolbypassrls ' || (select r.rolbypassrls::text from pg_roles r where r.rolname = current_user) end,
         case when to_regclass('storage.objects') is not null and has_table_privilege(current_user, 'storage.objects', 'select')
                and (select r.rolbypassrls from pg_roles r where r.rolname = current_user)
              then 'TAMAM' else 'DUR: sahibin storage.objects üzerinde SELECT hakkı ve RLS atlaması yok; her sonlandırma media_not_uploaded olur' end
  union all
  select 6, 'A nesneleri: fonksiyon (6 beklenir) / kuyruk tablosu / silme tetikleyicisi  [KAYDET]',
         (select fonksiyon from a)::text || ' / ' || (to_regclass('public.media_file_queue') is not null)::text || ' / ' || (select tetikleyici from a)::text,
         case when (select fonksiyon from a) = 0 and to_regclass('public.media_file_queue') is null and (select tetikleyici from a) = 0 then 'TAMAM (henüz yok)'
              when (select fonksiyon from a) = 6 and to_regclass('public.media_file_queue') is not null and (select tetikleyici from a) = 1 then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: kısmi kurulum — beklenmeyen durum, sahibine bildirin' end
  union all
  select 7, 'B (media_assets_pending_shape) uygulanmış mı',
         (select sekil from a)::text,
         case when (select sekil from a) = 0 then 'TAMAM (A, B''den önce uygulanır)'
              else 'BİLGİ: B zaten uygulanmış; A''yı geri almak için ÖNCE media_privileges/05' end
  union all
  select 8, 'Dosya silme kuyruğundaki satır sayısı (yalnızca sayı)  [KAYDET]', coalesce((select kuyruk from a), 'yok'),
         case when (select kuyruk from a) is null or (select kuyruk from a) = '0' then 'TAMAM'
              else 'BİLGİ: kuyrukta satır var; 05 (geri dönüş) önce boşaltılmasını ister' end
  union all
  select 9, 'media_finalize() tanımı  [KAYDET]',
         case when to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)')) end, 'BİLGİ'
  union all
  select 10, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tetikleyici kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 11, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
  union all
  select 12, 'Kurum önekinin (organizations/<kurum>/) dışında ya da ".." içeren yol taşıyan satır sayısı (demo ve boş değerler hariç; yalnızca sayı)  [KAYDET]',
         (select count(*) from public.media_assets m
            where (m.original_path is not null and (not starts_with(m.original_path, 'organizations/' || m.organization_id::text || '/') or position('..' in m.original_path) > 0))
               or (m.public_base is not null and left(m.public_base, 1) <> '/' and (not starts_with(m.public_base, 'organizations/' || m.organization_id::text || '/') or position('..' in m.public_base) > 0)))::text,
         case when (select count(*) from public.media_assets m
            where (m.original_path is not null and (not starts_with(m.original_path, 'organizations/' || m.organization_id::text || '/') or position('..' in m.original_path) > 0))
               or (m.public_base is not null and left(m.public_base, 1) <> '/' and (not starts_with(m.public_base, 'organizations/' || m.organization_id::text || '/') or position('..' in m.public_base) > 0)))::int = 0 then 'TAMAM' else 'BİLGİ: kurum dışı yollu satırlar var; A bunların dosyalarını kuyruğa ALMAZ, B''den önce temizlenmelidir' end
) kontroller
order by sira;
