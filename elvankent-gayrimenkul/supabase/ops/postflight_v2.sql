-- =============================================================================
-- CANLI GEÇİŞ SONRASI DOĞRULAMA (salt okunur)
--
-- Migration'lardan hemen sonra, siteyi yayına almadan ÖNCE çalıştırın.
-- "durum" sütununda HATA varsa yayına almayın; geri dönüş planını uygulayın
-- (docs/PRODUCTION_MIGRATION.md). Sayıları preflight_v1.sql çıktısıyla karşılaştırın.
-- Sonradan eklenen tablolara (site_configs, platform_*) yalnızca dinamik sorguyla
-- (query_to_xml) erişilir: migration uygulanmamışsa betik durmaz, ilgili satır HATA yazar.
-- =============================================================================
with expected_tables(name) as (
  values ('organizations'), ('organization_members'), ('organization_settings'), ('organization_domains'), ('plans'),
         ('subscriptions'), ('role_permissions'), ('properties'), ('media_assets'), ('leads'), ('customers'),
         ('appointments'), ('collections'), ('posts'), ('pages'), ('region_pages'), ('redirects'), ('audit_logs'),
         ('organization_notification_settings'), ('notification_deliveries')
),
expected_functions(name) as (
  values ('user_org_ids'), ('is_super_admin'), ('submit_lead'), ('track_event'), ('org_plan'), ('write_audit'),
         ('session_aal'), ('user_has_mfa'), ('set_require_admin_mfa'), ('org_member_mfa_status')
),
checks as (
  select 1 as sira, 'V2 + Stage 3 tabloları' as kontrol,
         (select count(*) from expected_tables e where to_regclass('public.' || e.name) is not null) || ' / ' || (select count(*) from expected_tables) as deger,
         case when (select count(*) from expected_tables e where to_regclass('public.' || e.name) is null) = 0 then 'TAMAM'
              else 'HATA: eksik: ' || (select string_agg(name, ', ') from expected_tables e where to_regclass('public.' || e.name) is null) end as durum
  union all
  select 2, 'RLS kapalı tablo (public şeması)',
         coalesce((select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity), 'yok'),
         case when exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity) then 'HATA: RLS kapalı tablo var' else 'TAMAM' end
  union all
  select 3, 'RLS politika sayısı (public / storage)',
         (select count(*) from pg_policies where schemaname = 'public') || ' / ' || (select count(*) from pg_policies where schemaname = 'storage'),
         case when (select count(*) from pg_policies where schemaname = 'public') >= 60 and (select count(*) from pg_policies where schemaname = 'storage') >= 4 then 'TAMAM' else 'HATA: politika eksik' end
  union all
  select 4, 'Güvenlik fonksiyonları',
         (select count(*) from expected_functions e where exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.name)) || ' / ' || (select count(*) from expected_functions),
         case when (select count(*) from expected_functions e where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.name)) = 0 then 'TAMAM'
              else 'HATA: eksik: ' || (select string_agg(name, ', ') from expected_functions e where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = e.name)) end
  union all
  select 5, 'Varsayılan ofis (aktif, ayarlı, abonelikli)',
         coalesce((select o.slug || ' / ' || o.status from public.organizations o where o.is_default), 'YOK'),
         case when exists (select 1 from public.organizations o
                             join public.organization_settings s on s.organization_id = o.id
                             join public.subscriptions sub on sub.organization_id = o.id and sub.status in ('trialing', 'active')
                            where o.is_default and o.status = 'active') then 'TAMAM' else 'HATA' end
  union all
  select 6, 'İlan sayısı (toplam / demo / demo olmayan)',
         (select count(*) || ' / ' || count(*) filter (where is_demo) || ' / ' || count(*) filter (where not is_demo) from public.properties),
         'preflight ile KARŞILAŞTIRIN'
  union all
  select 7, 'Kiracısız ilan', (select count(*)::text from public.properties where organization_id is null),
         case when (select count(*) from public.properties where organization_id is null) = 0 then 'TAMAM' else 'HATA' end
  union all
  select 8, 'Görsel kaydı (media_assets, ilan fotoğrafı)', (select count(*)::text from public.media_assets where kind = 'property_photo'),
         'preflight property_images ile KARŞILAŞTIRIN'
  union all
  select 9, 'Talepler (V1 iletişim talepleri dahil)', (select count(*)::text from public.leads), 'preflight contact_requests ile KARŞILAŞTIRIN'
  union all
  select 10, 'Yönlendirme', (select count(*)::text from public.redirects), 'preflight ile KARŞILAŞTIRIN'
  union all
  select 11, 'Varsayılan ofiste aktif sahip (owner)',
         (select count(*)::text from public.organization_members m join public.organizations o on o.id = m.organization_id and o.is_default
           where m.role = 'owner' and m.status = 'active'),
         case when exists (select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id and o.is_default
                            where m.role = 'owner' and m.status = 'active') then 'TAMAM' else 'DİKKAT: sahip yok — npm run create-admin' end
  union all
  select 12, 'Depolama kovaları',
         coalesce((select string_agg(id || case when public then ' (açık)' else ' (özel)' end, ', ' order by id) from storage.buckets
                    where id in ('media-originals', 'media', 'branding', 'property-images')), 'YOK'),
         case when (select count(*) from storage.buckets where id in ('media-originals', 'media', 'branding', 'property-images')) = 4
               and exists (select 1 from storage.buckets where id = 'media-originals' and not public) then 'TAMAM' else 'HATA' end
  union all
  select 13, 'Yetki tablosu (rol × yetki satırı)', (select count(*)::text from public.role_permissions),
         case when (select count(*) from public.role_permissions) > 0 then 'TAMAM' else 'HATA' end
  union all
  select 14, 'Kiracı listesi herkese kapalı (platform_owner_isolation)',
         (select count(*)::text from pg_policies where schemaname = 'public'
            and policyname in ('organizations_public_read', 'settings_public_read', 'domains_public_read')) || ' açık politika',
         case when not exists (select 1 from pg_policies where schemaname = 'public'
                                 and policyname in ('organizations_public_read', 'settings_public_read', 'domains_public_read'))
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'public_tenant')
              then 'TAMAM' else 'HATA: 20260929000001_platform_owner_isolation.sql uygulanmamış' end
  union all
  select 15, 'Oturum bağlamı + indeksler (session_context)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'session_context') then 'var' else 'yok' end,
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'session_context')
              then 'TAMAM' else 'HATA: 20260930000001_session_context_and_indexes.sql uygulanmamış' end
  union all
  select 16, 'Web sitesi yapılandırması (her ofis için site kaydı)',
         case when to_regclass('public.site_configs') is null then 'tablo yok'
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.organizations o where not exists (select 1 from public.site_configs c where c.organization_id = o.id)', false, true, '')))[1]::text::int::text || ' kayıtsız ofis' end,
         case when to_regclass('public.site_configs') is null then 'HATA: 20260930000002_site_builder.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = to_regclass('public.site_configs'))
               and (select relrowsecurity from pg_class where oid = to_regclass('public.site_config_revisions'))
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'public_site_config')
               and (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.organizations o where not exists (select 1 from public.site_configs c where c.organization_id = o.id)', false, true, '')))[1]::text::int = 0
              then 'TAMAM' else 'HATA' end
  union all
  select 17, 'Marka taslak → yayın akışı (site_apply_brand)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_apply_brand') then 'var' else 'yok' end,
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_apply_brand')
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_brand_snapshot')
              then 'TAMAM' else 'HATA: 20261001000001_site_brand_publish.sql uygulanmamış' end
  union all
  select 18, 'KARAY şirket bilgileri ve KARAY talepleri (platform_settings, platform_leads)',
         case when to_regclass('public.platform_leads') is null then 'tablo yok'
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_settings', false, true, '')))[1]::text::int::text || ' ayar satırı' end,
         case when to_regclass('public.platform_settings') is null or to_regclass('public.platform_leads') is null
              then 'HATA: 20261002000001_karay_platform.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = to_regclass('public.platform_settings'))
               and (select relrowsecurity from pg_class where oid = to_regclass('public.platform_leads'))
               and (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_settings', false, true, '')))[1]::text::int = 1
               and not has_function_privilege('anon', 'public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text)', 'execute')
               and has_function_privilege('anon', 'public.public_platform_profile()', 'execute')
              then 'TAMAM' else 'HATA' end
  union all
  select 19, 'Tasarım ailesi yetkileri (design_family_settings, organization_design_families)',
         case when to_regclass('public.organization_design_families') is null then 'tablo yok' else 'var' end,
         case when to_regclass('public.design_family_settings') is null or to_regclass('public.organization_design_families') is null
              then 'HATA: 20261004000001_design_family_access.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = to_regclass('public.design_family_settings'))
               and (select relrowsecurity from pg_class where oid = to_regclass('public.organization_design_families'))
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'org_design_family_access')
              then 'TAMAM' else 'HATA' end
  union all
  select 20, 'Ofis site yönetimi (site_discard_draft, assert_site_editor)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'assert_site_editor') then 'var' else 'yok' end,
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_discard_draft')
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'assert_site_editor')
              then 'TAMAM' else 'HATA: 20261005000001_office_site_management.sql uygulanmamış' end
  union all
  select 21, 'Marka ve içerik taslağı (hizmet alanı, çalışma saatleri, ana sayfa metni taslakta)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_brand_columns') then 'var' else 'yok' end,
         case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_brand_columns')
                or not exists (select 1 from pg_trigger where tgrelid = 'public.organization_settings'::regclass and not tgisinternal
                                 and tgfoid = (select oid from pg_proc where pronamespace = 'public'::regnamespace and proname = 'organization_settings_guard' limit 1))
              then 'HATA: 20261006000001_brand_content_draft.sql uygulanmamış'
              when (xpath('/row/n/text()', query_to_xml('select (''service_area'' = any (public.site_brand_columns()) and ''hero_title'' = any (public.site_brand_columns()))::int as n', false, true, '')))[1]::text = '1'
              then 'TAMAM' else 'HATA: 20261006000001_brand_content_draft.sql uygulanmamış' end
  union all
  select 22, 'SEO taslağı (doğrulama kodu marka taslağında)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_seo_brand_columns') then 'var' else 'yok' end,
         case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_seo_brand_columns')
                or not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'site_brand_columns')
              then 'HATA: 20261007000001_seo_draft.sql uygulanmamış'
              when (xpath('/row/n/text()', query_to_xml('select (''google_site_verification'' = any (public.site_brand_columns()))::int as n', false, true, '')))[1]::text = '1'
              then 'TAMAM' else 'HATA: 20261007000001_seo_draft.sql uygulanmamış' end
  union all
  select 23, 'Sahip daveti (organization_invitations; fonksiyonlar yalnızca sunucu anahtarıyla)',
         case when to_regclass('public.organization_invitations') is null then 'tablo yok'
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.organization_invitations where status = ''pending''', false, true, '')))[1]::text || ' bekleyen davet' end,
         case when to_regclass('public.organization_invitations') is null then 'HATA: 20261008000001_owner_invitations.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = to_regclass('public.organization_invitations'))
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'invitation_accept')
               and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
                                 and p.proname in ('invitation_accept', 'invitation_lookup', 'invitation_release')
                                 and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
              then 'TAMAM' else 'HATA: davet fonksiyonları istemciye açık veya eksik' end
  union all
  select 24, 'Özel alan adı (bekliyor / doğrulandı / aktif; birincil yalnızca aktif)',
         case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_domains' and column_name = 'status')
              then 'durum sütunu yok'
              else (xpath('/row/n/text()', query_to_xml('select coalesce(string_agg(status || '': '' || n, '', '' order by status), ''alan adı yok'') as n from (select status, count(*) n from public.organization_domains group by status) s', false, true, '')))[1]::text end,
         case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_domains' and column_name = 'status')
              then 'HATA: 20261009000001_custom_domains.sql uygulanmamış'
              when to_regclass('public.organization_domains_bound_idx') is not null
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'domain_add')
               and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
                                 and p.proname in ('domain_add', 'domain_mark_verified', 'domain_mark_active', 'domain_remove', 'domain_set_primary')
                                 and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
               and (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.organization_domains where is_primary and status <> ''active''', false, true, '')))[1]::text::int = 0
              then 'TAMAM' else 'HATA: alan adı fonksiyonları istemciye açık, eksik veya aktif olmayan birincil alan adı var' end
  union all
  select 25, 'Şema sürümü + şifre sıfırlama hız sınırı (yalnızca sunucu anahtarıyla)',
         case when exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'karay_schema_version')
              then (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text else 'sürüm yok' end,
         case when not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'karay_schema_version')
                or not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'auth_password_reset_allowed')
              then 'HATA: 20261010000001_password_reset_requests.sql uygulanmamış'
              when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'auth_password_reset_allowed'
                             and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
              then 'HATA: auth_password_reset_allowed istemciye açık'
              when (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text >= '20261010000001'
              then 'TAMAM' else 'HATA: şema sürümü eski' end

  union all
  select 26, 'Müşteri operasyonları (ekip daveti, kurulum durumu, KARAY notları)',
         case when to_regclass('public.platform_org_notes') is null then 'not tablosu yok'
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_org_notes', false, true, '')))[1]::text || ' not' end,
         case when to_regclass('public.platform_org_notes') is null
                or not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'org_send_member_invitation')
                or not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'platform_customer_overview')
              then 'HATA: 20261011000001_customer_operations.sql uygulanmamış'
              when exists (select 1 from pg_constraint where conname = 'organization_invitations_role_check')
              then 'HATA: davet rol kısıtı kaldırılmamış'
              -- to_regclass: tablo yoksa (migration uygulanmamış) sorgu çökmez; yukarıdaki satır HATA verir
              when not coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.platform_org_notes')), false)
                or has_table_privilege('anon', to_regclass('public.platform_org_notes'), 'select')
                or has_table_privilege('authenticated', to_regclass('public.platform_org_notes'), 'update')
                or has_table_privilege('authenticated', to_regclass('public.platform_org_notes'), 'delete')
              then 'HATA: platform_org_notes RLS / yetki hatalı'
              when exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
                             and p.proname in ('org_send_member_invitation', '_org_onboarding_flags')
                             and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')))
                or exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
                             and p.proname in ('platform_customer_overview', 'org_onboarding', 'org_member_account_states')
                             and has_function_privilege('anon', p.oid, 'execute'))
              then 'HATA: müşteri operasyon fonksiyonları istemciye açık'
              when (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text >= '20261011000001'
              then 'TAMAM' else 'HATA: şema sürümü eski' end
)
select sira, kontrol, deger, durum from checks order by sira;
