-- =============================================================================
-- Pilot deneme bitişi (supabase/pending/20261108000004_pilot_trial_end.sql, PILOT, H) — 1/5 ÖN KONTROL (KAPI)
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
  select 4, 'Gerekli: assert_super_admin(), log_security_event(8), subscriptions',
         (to_regprocedure('public.assert_super_admin()') is not null and to_regprocedure('public.log_security_event(uuid,text,uuid,text,text,text,jsonb,text)') is not null
            and to_regclass('public.subscriptions') is not null)::text,
         case when to_regprocedure('public.assert_super_admin()') is not null and to_regprocedure('public.log_security_event(uuid,text,uuid,text,text,text,jsonb,text)') is not null
                and to_regclass('public.subscriptions') is not null then 'TAMAM' else 'DUR: gerekli nesne yok' end
  union all
  select 5, 'H uygulanmış mı — platform_set_trial_end  [KAYDET]',
         (to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is not null)::text,
         case when to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is null then 'TAMAM (henüz yok; 05 sonrası da yok olmalı)' else 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)' end
  union all
  select 6, 'Deneme (trialing) aboneliği olan kurum sayısı (yalnızca sayı)',
         (select count(distinct organization_id)::text from public.subscriptions where status = 'trialing'), 'BİLGİ: değişmez'
) kontroller
order by sira;
