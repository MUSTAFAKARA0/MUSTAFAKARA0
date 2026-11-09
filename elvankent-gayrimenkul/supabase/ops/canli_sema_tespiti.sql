-- =============================================================================
-- KI-23 · CANLI ŞEMA TESPİTİ — hangi migration'lar uygulanmış, hangileri eksik (YALNIZCA OKUR)
--
-- Tek bir SELECT; hiçbir tabloya, fonksiyona, ayara yazmaz; DDL/DML yoktur.
--   Supabase › SQL Editor › New query › yapıştır › Run   (proje adını kontrol edin)
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f canli_sema_tespiti.sql
--
-- Her migration dosyası için YALNIZ o dosyanın oluşturduğu bir nesneye bakılır (tablo, fonksiyon, sütun, tür,
-- kova, kısıt ya da fonksiyon gövdesindeki ayırt edici ifade). Nesne yoksa sorgu hata vermez (to_regclass,
-- pg_proc, information_schema, query_to_xml ile dolaylı okuma). Kayıt içeriği, e-posta, ad ya da sayı YAZMAZ;
-- yalnız VAR/YOK ve sürüm bilgisi döner (çıktı paylaşılabilir).
--
-- Son satırlar: karay_schema_version(), supabase_migrations.schema_migrations özeti, ilk eksik migration ve
-- TUTARLILIK (eksikler listenin son kısmı mı; arada eksik varsa elle uygulanmış/kısmi şema olabilir).
-- Yerelde sınandı: tüm migration'lar + bekleyenler uygulanmış veritabanı ve canlı benzeri yığın (KI-23 belgesi).
-- =============================================================================
with checks(sira, dosya, kosul) as (
  values
  (1,  '20260922000001_schema.sql',                    to_regclass('public.districts') is not null and to_regclass('public.profiles') is not null),
  (2,  '20260922000002_security.sql',                  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'submit_lead')),
  (3,  '20260922000003_storage.sql',                   exists (select 1 from storage.buckets where id = 'property-images')),
  (4,  '20260922000004_reference_data.sql',            to_regclass('public.cities') is not null
                                                       and (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.cities', false, true, '')))[1]::text::int > 0),
  (5,  '20260926000001_v2_enums.sql',                  to_regtype('public.listing_status') is not null),
  (6,  '20260926000002_v2_tenancy.sql',                to_regclass('public.organizations') is not null and to_regclass('public.subscriptions') is not null),
  (7,  '20260926000003_v2_properties.sql',             exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'properties_after_write')),
  (8,  '20260926000004_v2_crm.sql',                    to_regclass('public.leads') is not null),
  (9,  '20260926000005_v2_content.sql',                to_regclass('public.posts') is not null),
  (10, '20260926000006_v2_audit.sql',                  to_regclass('public.audit_logs') is not null),
  (11, '20260926000007_v2_security.sql',               exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'submit_lead')),
  (12, '20260926000008_v2_storage.sql',                exists (select 1 from storage.buckets where id = 'media-originals')),
  (13, '20260926000009_v2_reference_data.sql',         to_regclass('public.property_types') is not null
                                                       and (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.property_types', false, true, '')))[1]::text::int > 0),
  (14, '20260927000001_v2_platform_fixes.sql',         exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'organization_members_guard' and prosrc like '%v_super%')),
  (15, '20260928000001_stage3_notifications.sql',      to_regclass('public.notification_deliveries') is not null),
  (16, '20260928000002_stage3_mfa.sql',                exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'session_aal')),
  (17, '20260928000003_stage3_location_codes.sql',     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cities' and column_name = 'code')),
  (18, '20260929000001_platform_owner_isolation.sql',  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'public_tenant')),
  (19, '20260930000001_session_context_and_indexes.sql', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'session_context')),
  (20, '20260930000002_site_builder.sql',              to_regclass('public.site_configs') is not null and to_regclass('public.site_config_revisions') is not null),
  (21, '20261001000001_site_brand_publish.sql',        exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_apply_brand')),
  (22, '20261002000001_karay_platform.sql',            to_regclass('public.platform_settings') is not null),
  (23, '20261004000001_design_family_access.sql',      to_regclass('public.design_family_settings') is not null),
  (24, '20261005000001_office_site_management.sql',    exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'assert_site_editor')),
  (25, '20261006000001_brand_content_draft.sql',       exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_brand_columns')
                                                       and (xpath('/row/n/text()', query_to_xml('select (''service_area'' = any (public.site_brand_columns()))::int as n', false, true, '')))[1]::text = '1'),
  (26, '20261007000001_seo_draft.sql',                 exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_seo_brand_columns')),
  (27, '20261008000001_owner_invitations.sql',         to_regclass('public.organization_invitations') is not null),
  (28, '20261009000001_custom_domains.sql',            exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'domain_add')),
  (29, '20261010000001_password_reset_requests.sql',   exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'auth_password_reset_allowed')),
  (30, '20261011000001_customer_operations.sql',       to_regclass('public.platform_org_notes') is not null),
  (31, '20261018000001_karays_brand.sql',              exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'platform_settings'
                                                                  and column_name = 'company_name' and column_default = '''KARAYS''::text')),
  -- Bekleyen (supabase/pending): canlıda OLMAMASI beklenir
  (32, 'pending/20261025000001_quota_lock.sql',        exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'quota_lock')),
  (33, 'pending/20261025000002_ops02_subscription_limits.sql', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits')),
  (34, 'pending/20261026000001_media_quota_lock.sql',  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'media_quota_check')),
  (35, 'pending/20261026000002_company_name_check.sql', exists (select 1 from pg_constraint where conname = 'platform_settings_company_name_plain')),
  (36, 'pending/20261027000001_media_finalize_rpc.sql', to_regclass('public.media_file_queue') is not null),
  (37, 'pending/20261027000002_media_column_privileges.sql', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'media_assets_pending_shape')),
  (38, 'pending/20261027000003_media_storage_slots.sql', to_regclass('public.media_overwrite_window') is not null),
  (39, 'pending/20261031000001_media_stray_sweep.sql', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'media_stray_objects')),
  (40, 'pending/20261108000001_media_size_guard.sql', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'media_storage_size_guard')
                                                       and exists (select 1 from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects'))),
  (41, 'pending/20261108000002_tenant_member_guard.sql', exists (select 1 from pg_trigger where tgname = 'organization_members_target_guard' and not tgisinternal)),
  (42, 'pending/20261108000003_license_no.sql', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no')),
  (43, 'pending/20261108000004_pilot_trial_end.sql', exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'platform_set_trial_end')),
  (44, 'pending/20261108000005_org_setup.sql', to_regclass('public.organization_setup') is not null)
),
mig as (select * from checks where sira <= 31),
first_missing as (select min(sira) as s from mig where not kosul),
summary as (
  select
    (select s from first_missing) as ilk_eksik,
    (select count(*) from mig where not kosul) as eksik_sayisi,
    (select count(*) from mig where kosul and sira > coalesce((select s from first_missing), 999)) as eksikten_sonra_var
)
select sira, dosya, case when kosul then 'VAR' else 'YOK' end as durum,
       case when sira > 31 then 'bekleyen (canlıda olmaması beklenir)'
            when sira = 2 then 'nesneleri 20260926000007 ile tamamen değiştirildi; o dosyaya göre değerlendirilir'
            else '' end as not_
  from checks
union all
select 100, 'karay_schema_version()',
       case when to_regprocedure('public.karay_schema_version()') is null then 'fonksiyon yok'
            else (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text end, ''
union all
select 101, 'supabase_migrations.schema_migrations (kayıtlı sürüm sayısı · en yeni)',
       case when to_regclass('supabase_migrations.schema_migrations') is null then 'tablo yok (migration''lar SQL Editor ile uygulanmış olabilir)'
            else (xpath('/row/n/text()', query_to_xml('select count(*) || '' · '' || coalesce(max(version), ''boş'') as n from supabase_migrations.schema_migrations', false, true, '')))[1]::text end, ''
union all
select 102, 'İLK EKSİK migration',
       coalesce((select dosya from mig where sira = (select ilk_eksik from summary)), 'yok — 31 migration''ın hepsi var'), ''
union all
select 103, 'TUTARLILIK',
       case when (select eksik_sayisi from summary) = 0 then 'TAMAM: eksik yok'
            when (select eksikten_sonra_var from summary) = 0 then 'TAMAM: eksikler listenin son kısmı (' || (select eksik_sayisi from summary) || ' dosya); sırayla uygulanabilir'
            else 'DİKKAT: ilk eksikten sonra ' || (select eksikten_sonra_var from summary) || ' dosya VAR — kısmi/elle uygulanmış şema; sıra elle incelenmeli' end, ''
order by 1;
