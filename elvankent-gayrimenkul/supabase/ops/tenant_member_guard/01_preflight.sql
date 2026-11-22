-- =============================================================================
-- Kiracı üyelik koruması (supabase/pending/20261108000002_tenant_member_guard.sql, P0-3, F) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
-- Çıktının TAMAMINI saklayın. "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Çıktıda kurum adı, kimlik ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
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
  select 4, 'Gerekli nesneler: organization_members, properties, media_assets, profiles.is_super_admin, is_super_admin()',
         (to_regclass('public.organization_members') is not null and to_regclass('public.properties') is not null
            and to_regclass('public.media_assets') is not null and to_regprocedure('public.is_super_admin()') is not null
            and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin')
            and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'og_media_id'))::text,
         case when to_regclass('public.organization_members') is not null and to_regclass('public.properties') is not null
                and to_regclass('public.media_assets') is not null and to_regprocedure('public.is_super_admin()') is not null
                and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin')
                and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'properties' and column_name = 'og_media_id')
              then 'TAMAM' else 'DUR: beklenen tablo/sütun/fonksiyon yok' end
  union all
  select 5, 'F uygulanmış mı — iki tetikleyici  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal),
         case when (select count(*) from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal) = 0
              then 'TAMAM (henüz yok; 05 sonrası da 0 olmalı)'
              when (select count(*) from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal) = 2
              then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 6, 'organization_members ve properties üzerindeki tetikleyici sayısı (F dışı)  [KAYDET]',
         (select count(*)::text from pg_trigger where tgrelid in (to_regclass('public.organization_members'), to_regclass('public.properties'))
             and not tgisinternal and tgname not in ('organization_members_target_guard', 'properties_og_media_guard')),
         'BİLGİ: 05 sonrası aynı olmalı'
  union all
  select 7, 'Birden çok ofise bağlı hesap sayısı (yalnızca sayı)',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml(
           'select count(*) as n from (select user_id from public.organization_members group by user_id having count(distinct organization_id) > 1) t',
           false, false, '') columns n text path 'n') x limit 1), 'yok'),
         'BİLGİ: F mevcut üyelikleri değiştirmez; 0 değilse bu hesaplar KARAYS ile gözden geçirilir (izinsiz eklenmiş olabilir)'
  union all
  select 8, 'Başka ofisin medyasını gösteren og_media_id sayısı (yalnızca sayı)',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml(
           'select count(*) as n from public.properties p join public.media_assets m on m.id = p.og_media_id where m.organization_id <> p.organization_id',
           false, false, '') columns n text path 'n') x limit 1), 'yok'),
         'BİLGİ: 0 beklenir; değilse ilgili ilanın paylaşım görseli elle temizlenir'
  union all
  select 9, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
) kontroller
order by sira;
