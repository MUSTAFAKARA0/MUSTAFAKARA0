-- =============================================================================
-- OPS-02 abonelik limitleri (supabase/pending/20261025000002_ops02_subscription_limits.sql) — 1/5 ÖN KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- ÖN KOŞUL SIRASI: önce ../quota_lock/ uygulanmış olmalı (7. ve 8. satır). Çıktının TAMAMINI saklayın;
-- "durum" sütununda DUR varsa 03 UYGULANMAZ. KAYDET satırı geri dönüşte kullanılır.
-- Çıktıda kurum adı, kimlik ya da kişi verisi yoktur; yalnızca sayılar. Bayrak bu betikle AÇILMAZ.
-- Tablo yoksa sorgu hata vermez; satır "yok" der (query_to_xml + xmltable ile dolaylı okuma).
-- Adımlar ve gerekçe: README.md
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum,
         to_regclass('public.platform_settings') is not null as ps_var,
         to_regclass('public.subscriptions') is not null and to_regclass('public.plans') is not null
           and to_regclass('public.organizations') is not null and to_regprocedure('public.org_plan(uuid)') is not null as plan_var,
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') as bayrak_var
),
c as (
  select (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
             and tgrelid = to_regclass('public.properties')) as ilan,
         (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
             and tgrelid = to_regclass('public.organization_members')) as uyelik,
         case when not (select bayrak_var from v) then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.platform_settings where enforce_subscription_limits', false, false, '') columns n int path 'n') x limit 1) end as bayrak_acik,
         case when not (select plan_var from v) then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.organizations o where not exists (select 1 from public.subscriptions s where s.organization_id = o.id and s.status in (''trialing'', ''active'', ''past_due''))', false, false, '') columns n int path 'n') x limit 1) end as aboneliksiz,
         case when not (select plan_var from v) or to_regclass('public.properties') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from (select organization_id, count(*) as c from public.properties group by organization_id) x where x.c > (select max_properties from public.org_plan(x.organization_id))', false, false, '') columns n int path 'n') x limit 1) end as ilan_asan,
         case when not (select plan_var from v) or to_regclass('public.organization_members') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from (select organization_id, count(*) as c from public.organization_members where status = ''active'' group by organization_id) x where x.c > (select max_users from public.org_plan(x.organization_id))', false, false, '') columns n int path 'n') x limit 1) end as uye_asan
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
  select 4, 'Gerekli nesneler (platform_settings, subscriptions, plans, organizations, org_plan)',
         (select ps_var from v)::text || ' / ' || (select plan_var from v)::text,
         case when (select ps_var from v) and (select plan_var from v) then 'TAMAM' else 'DUR: nesne yok' end
  union all
  select 5, 'enforce_subscription_limits sütunu  [KAYDET]',
         case when (select bayrak_var from v) then 'var · AÇIK satır sayısı ' || coalesce((select bayrak_acik from c)::text, '-') else 'yok' end,
         case when not (select bayrak_var from v) then 'TAMAM (henüz yok)'
              when (select bayrak_acik from c) = 0 then 'BİLGİ: sütun var, bayrak KAPALI; 03 yeniden kurar (zararsız)'
              else 'DUR: bayrak AÇIK görünüyor — bu betik bayrağı yönetmez; sahibiyle konuşun' end
  union all
  select 6, 'org_plan(uuid) tanımı  [KAYDET — geri dönüş 05 bunu yeniden kurar]',
         case when to_regprocedure('public.org_plan(uuid)') is null then 'yok'
              else pg_get_functiondef(to_regprocedure('public.org_plan(uuid)')) end,
         case when to_regprocedure('public.org_plan(uuid)') is null then 'DUR: org_plan yok'
              when pg_get_functiondef(to_regprocedure('public.org_plan(uuid)')) like '%enforce_subscription_limits%'
                then 'BİLGİ: tanım zaten yeni (bayrağı okuyor)'
              else 'TAMAM (eski tanım; 05 bunu 20260930000002_site_builder.sql''den geri kurar)' end
  union all
  select 7, 'aa_quota_lock — properties  (önce quota_lock uygulanmalı)', (select ilan from c)::text,
         case when (select ilan from c) = 1 then 'TAMAM' else 'DUR: quota_lock/03_apply.sql henüz uygulanmamış' end
  union all
  select 8, 'aa_quota_lock — organization_members', (select uyelik from c)::text,
         case when (select uyelik from c) = 1 then 'TAMAM' else 'DUR: quota_lock/03_apply.sql henüz uygulanmamış' end
  union all
  select 9, 'Etkin aboneliği olmayan kurum sayısı (bayrak açılırsa limitleri 0 olur)',
         coalesce((select aboneliksiz from c)::text, '-'), 'BİLGİ: bayrağı AÇMADAN önce bu sayı değerlendirilir'
  union all
  select 10, 'Plan ilan limitini aşan kurum sayısı',
         coalesce((select ilan_asan from c)::text, '-'), 'BİLGİ: mevcut kayıtlar silinmez, yalnızca yeni ekleme reddedilir'
  union all
  select 11, 'Plan kullanıcı limitini aşan kurum sayısı',
         coalesce((select uye_asan from c)::text, '-'), 'BİLGİ: mevcut üyeler korunur, yalnızca yeni üye etkinleştirme reddedilir'
  union all
  select 12, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem platform_settings kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 13, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
) kontroller
order by sira;
