-- =============================================================================
-- Ekleme kilidi (supabase/pending/20261025000001_quota_lock.sql) — 1/5 ÖN KONTROL
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
             and tgrelid = to_regclass('public.organization_members')) as uyelik
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
  select 4, 'Gerekli tablolar (properties, organization_members)',
         (to_regclass('public.properties') is not null)::text || ' / ' || (to_regclass('public.organization_members') is not null)::text,
         case when to_regclass('public.properties') is not null and to_regclass('public.organization_members') is not null
              then 'TAMAM' else 'DUR: tablo yok' end
  union all
  select 5, 'aa_quota_lock tetikleyicisi — properties  [KAYDET]', (select ilan from t)::text,
         case when (select ilan from t) = 0 then 'TAMAM (henüz yok)'
              when (select ilan from t) = 1 then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 6, 'aa_quota_lock tetikleyicisi — organization_members  [KAYDET]', (select uyelik from t)::text,
         case when (select uyelik from t) = 0 then 'TAMAM (henüz yok)'
              when (select uyelik from t) = 1 then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 7, 'quota_lock() tanımı  [KAYDET]',
         case when to_regprocedure('public.quota_lock()') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.quota_lock()')) end, 'BİLGİ'
  union all
  select 8, 'Bu tablolardaki diğer BEFORE tetikleyicileri (yalnız ad)',
         coalesce((select string_agg(c.relname || '.' || g.tgname, ', ' order by c.relname, g.tgname)
                     from pg_trigger g join pg_class c on c.oid = g.tgrelid
                    where not g.tgisinternal and g.tgname <> 'aa_quota_lock' and (g.tgtype & 2) = 2
                      and g.tgrelid in (to_regclass('public.properties'), to_regclass('public.organization_members'))), 'yok'),
         'BİLGİ: aa_quota_lock ada göre bunlardan önce çalışır (aa_ öneki)'
  union all
  select 9, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tetikleyici kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 10, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
) kontroller
order by sira;
