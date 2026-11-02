-- =============================================================================
-- Medya kota kilidi (supabase/pending/20261026000001_media_quota_lock.sql) — 1/5 ÖN KONTROL
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
t as (
  select (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
             and tgrelid = to_regclass('public.properties')) as ilan,
         (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
             and tgrelid = to_regclass('public.organization_members')) as uyelik,
         (select count(*) from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal
             and tgrelid = to_regclass('public.media_assets')) as medya,
         (select count(*) from pg_trigger where tgname = 'media_assets_org' and not tgisinternal
             and tgrelid = to_regclass('public.media_assets')) as medya_org
),
k as (
  select case when to_regprocedure('public.org_plan(uuid)') is null or to_regclass('public.media_assets') is null
                or to_regclass('public.organizations') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml(
                      'select count(*) as n from public.organizations o cross join lateral public.org_plan(o.id) p where p.max_storage_mb is not null and (select coalesce(sum(coalesce(m.byte_size, 0) + m.variants_byte_size), 0) from public.media_assets m where m.organization_id = o.id) > p.max_storage_mb::bigint * 1024 * 1024',
                      false, false, '') columns n text path 'n') x limit 1)
         end as asan
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
  select 4, 'Gerekli nesneler (media_assets, organizations, org_plan, user_org_ids, is_super_admin)',
         (to_regclass('public.media_assets') is not null)::text || ' / ' || (to_regclass('public.organizations') is not null)::text || ' / '
           || (to_regprocedure('public.org_plan(uuid)') is not null)::text || ' / ' || (to_regprocedure('public.user_org_ids(text)') is not null)::text || ' / '
           || (to_regprocedure('public.is_super_admin()') is not null)::text,
         case when to_regclass('public.media_assets') is not null and to_regclass('public.organizations') is not null
                and to_regprocedure('public.org_plan(uuid)') is not null and to_regprocedure('public.user_org_ids(text)') is not null
                and to_regprocedure('public.is_super_admin()') is not null
              then 'TAMAM' else 'DUR: nesne yok' end
  union all
  select 5, 'quota_lock uygulandı mı — aa_quota_lock (properties / organization_members)  [KAYDET]',
         (select ilan from t)::text || ' / ' || (select uyelik from t)::text,
         case when (select ilan from t) = 1 and (select uyelik from t) = 1 then 'TAMAM'
              else 'DUR: quota_lock/03_apply.sql henüz uygulanmamış (K-19 sırası: önce quota_lock, sonra medya kilidi)' end
  union all
  select 6, 'media_assets_org tetikleyicisi (organization_id''yi ilandan doldurur)',
         (select medya_org from t)::text,
         case when (select medya_org from t) = 1 then 'TAMAM (media_assets_quota ada göre bundan sonra çalışır)'
              else 'DUR: media_assets_org yok ya da birden fazla' end
  union all
  select 7, 'media_assets_quota tetikleyicisi  [KAYDET]', (select medya from t)::text,
         case when (select medya from t) = 0 then 'TAMAM (henüz yok)'
              when (select medya from t) = 1 then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 8, 'Depolama kotasını ZATEN aşmış kurum sayısı (yalnızca sayı)  [KAYDET]',
         coalesce((select asan from k), 'hesaplanamadı'),
         case when (select asan from k) is null then 'DUR: hesaplanamadı (nesneler eksik)'
              when (select asan from k) = '0' then 'TAMAM'
              else 'BİLGİ: bu kurumların uygulamadan SONRAKİ ilk yüklemesi reddedilir (plan_limit_storage); müşteri bildirimi gerekebilir (README)' end
  union all
  select 9, 'media_quota_check() tanımı  [KAYDET]',
         case when to_regprocedure('public.media_quota_check()') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.media_quota_check()')) end, 'BİLGİ'
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
) kontroller
order by sira;
