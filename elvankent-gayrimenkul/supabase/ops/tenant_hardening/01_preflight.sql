-- =============================================================================
-- Kiracı izolasyonu kalanları (supabase/pending/20261124000001_tenant_hardening.sql, KI-46, J) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT.  psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f <dosya>
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
  select 4, 'Gerekli: get_public_collection, leads, appointments, organization_members, neighborhoods',
         (to_regprocedure('public.get_public_collection(text)') is not null and to_regclass('public.leads') is not null
            and to_regclass('public.appointments') is not null and to_regclass('public.organization_members') is not null
            and to_regclass('public.neighborhoods') is not null)::text,
         case when to_regprocedure('public.get_public_collection(text)') is not null and to_regclass('public.leads') is not null
                and to_regclass('public.appointments') is not null and to_regclass('public.organization_members') is not null
                and to_regclass('public.neighborhoods') is not null then 'TAMAM' else 'DUR: gerekli nesne yok' end
  union all
  select 5, 'J uygulanmış mı — atama tetikleyicileri  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not tgisinternal),
         case when (select count(*) from pg_trigger where tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not tgisinternal) = 0
              then 'TAMAM (henüz yok; 05 sonrası da 0 olmalı)' else 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)' end
  union all
  select 6, 'anon SELECT: organization_settings / organization_domains  [KAYDET]',
         has_table_privilege('anon', 'public.organization_settings', 'select')::text || ' / ' || has_table_privilege('anon', 'public.organization_domains', 'select')::text,
         'BİLGİ: 03 sonrası false / false; 05 sonrası buradaki değerler'
  union all
  select 7, 'neighborhoods_insert_members politikası  [KAYDET]',
         exists (select 1 from pg_policy where polname = 'neighborhoods_insert_members' and polrelid = to_regclass('public.neighborhoods'))::text,
         'BİLGİ: 03 sonrası false; 05 sonrası buradaki değer'
  union all
  select 8, 'Kurumunun aktif üyesi olmayan kişiye atanmış talep / randevu (yalnızca sayı)',
         (select count(*)::text from public.leads l where l.assigned_to is not null and not exists (
            select 1 from public.organization_members m where m.organization_id = l.organization_id and m.user_id = l.assigned_to and m.status = 'active'))
         || ' / ' ||
         (select count(*)::text from public.appointments a where a.assigned_to is not null and not exists (
            select 1 from public.organization_members m where m.organization_id = a.organization_id and m.user_id = a.assigned_to and m.status = 'active')),
         'BİLGİ: J mevcut kayıtları değiştirmez; yalnız yeni atamayı denetler'
  union all
  select 9, 'Başka kurumun ilanını içeren seçki öğesi (yalnızca sayı)',
         (select count(*)::text from public.collection_items i join public.collections c on c.id = i.collection_id
            join public.properties p on p.id = i.property_id where p.organization_id <> c.organization_id),
         case when (select count(*) from public.collection_items i join public.collections c on c.id = i.collection_id
            join public.properties p on p.id = i.property_id where p.organization_id <> c.organization_id) = 0
              then 'TAMAM' else 'BİLGİ: bu öğeler J sonrası paylaşılan seçkide görünmez' end
  union all
  select 10, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
) kontroller
order by sira;
