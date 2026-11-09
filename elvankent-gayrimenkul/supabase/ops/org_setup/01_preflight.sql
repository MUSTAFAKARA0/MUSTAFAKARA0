-- =============================================================================
-- İlk kurulum ve tasarım kilidi (supabase/pending/20261108000005_org_setup.sql, PILOT, I) — 1/5 ÖN KONTROL (KAPI)
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
  select 4, 'Gerekli: site_configs, site_apply_design, org_design_family_access, has_org_permission, assert_super_admin, write_audit, member_org_ids',
         (to_regclass('public.site_configs') is not null and to_regclass('public.organizations') is not null
            and to_regprocedure('public.site_apply_design(uuid,text,jsonb)') is not null
            and to_regprocedure('public.org_design_family_access(uuid)') is not null
            and to_regprocedure('public.has_org_permission(uuid,text)') is not null
            and to_regprocedure('public.assert_super_admin()') is not null
            and to_regprocedure('public.is_super_admin()') is not null
            and to_regprocedure('public.member_org_ids()') is not null
            and to_regprocedure('public.write_audit(uuid,text,text,text,text,jsonb)') is not null)::text,
         case when to_regclass('public.site_configs') is not null and to_regclass('public.organizations') is not null
                and to_regprocedure('public.site_apply_design(uuid,text,jsonb)') is not null
                and to_regprocedure('public.org_design_family_access(uuid)') is not null
                and to_regprocedure('public.has_org_permission(uuid,text)') is not null
                and to_regprocedure('public.assert_super_admin()') is not null
                and to_regprocedure('public.is_super_admin()') is not null
                and to_regprocedure('public.member_org_ids()') is not null
                and to_regprocedure('public.write_audit(uuid,text,text,text,text,jsonb)') is not null
              then 'TAMAM' else 'DUR: gerekli nesne yok' end
  union all
  select 5, 'I uygulanmış mı — organization_setup tablosu  [KAYDET]',
         (to_regclass('public.organization_setup') is not null)::text,
         case when to_regclass('public.organization_setup') is null then 'TAMAM (henüz yok; 05 sonrası da yok olmalı)'
              else 'BİLGİ: zaten var; 03 eksikleri kurar, var olan satırlara dokunmaz (zararsız)' end
  union all
  select 6, 'I tetikleyicileri (organization_setup_init, site_configs_design_lock)  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname in ('organization_setup_init', 'site_configs_design_lock') and not tgisinternal),
         case when (select count(*) from pg_trigger where tgname in ('organization_setup_init', 'site_configs_design_lock') and not tgisinternal) in (0, 2)
              then 'BİLGİ: 05 sonrası 0 olmalı' else 'DUR: beklenmeyen sayı' end
  union all
  select 7, 'organizations ve site_configs üzerindeki tetikleyici sayısı (I dışı)  [KAYDET]',
         (select count(*)::text from pg_trigger where tgrelid in (to_regclass('public.organizations'), to_regclass('public.site_configs'))
             and not tgisinternal and tgname not in ('organization_setup_init', 'site_configs_design_lock')),
         'BİLGİ: 05 sonrası aynı olmalı'
  union all
  select 8, 'Ofis sayısı (yalnızca sayı; 03 hepsini "kurulum tamamlandı, eski ofis" olarak işaretler)',
         (select count(*)::text from public.organizations), 'BİLGİ: hiçbir ofis kurulum akışına yönlenmez'
  union all
  select 9, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where backend_type = 'client backend' and xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
) kontroller
order by sira;
