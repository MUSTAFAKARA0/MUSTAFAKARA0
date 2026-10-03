-- =============================================================================
-- CANLI GEÇİŞ SONRASI DOĞRULAMA (salt okunur)
--
-- Migration'lardan hemen sonra, siteyi yayına almadan ÖNCE çalıştırın.
-- "durum" sütununda HATA varsa yayına almayın; geri dönüş planını uygulayın
-- (docs/PRODUCTION_MIGRATION.md). Sayıları preflight_v1.sql çıktısıyla karşılaştırın.
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
              else (select count(*)::text from public.organizations o
                     where not exists (select 1 from public.site_configs c where c.organization_id = o.id)) || ' kayıtsız ofis' end,
         case when to_regclass('public.site_configs') is null then 'HATA: 20260930000002_site_builder.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = 'public.site_configs'::regclass)
               and (select relrowsecurity from pg_class where oid = 'public.site_config_revisions'::regclass)
               and exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'public_site_config')
               and not exists (select 1 from public.organizations o where not exists (select 1 from public.site_configs c where c.organization_id = o.id))
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
              else (select count(*)::text from public.platform_settings) || ' ayar satırı' end,
         case when to_regclass('public.platform_settings') is null or to_regclass('public.platform_leads') is null
              then 'HATA: 20261002000001_karay_platform.sql uygulanmamış'
              when (select relrowsecurity from pg_class where oid = 'public.platform_settings'::regclass)
               and (select relrowsecurity from pg_class where oid = 'public.platform_leads'::regclass)
               and (select count(*) from public.platform_settings) = 1
               and not has_function_privilege('anon', 'public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text)', 'execute')
               and has_function_privilege('anon', 'public.public_platform_profile()', 'execute')
              then 'TAMAM' else 'HATA' end
)
select sira, kontrol, deger, durum from checks order by sira;
