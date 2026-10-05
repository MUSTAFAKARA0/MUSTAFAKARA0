-- =============================================================================
-- KRİTİK VERİ PARMAK İZİ (salt okunur) — FAZ 0
--
-- Yedek almadan ÖNCE kaynak veritabanında, geri yüklemeden SONRA hedef veritabanında çalıştırın;
-- iki çıktı satır satır AYNI olmalıdır (diff boş). Her satır: tablo | kayıt sayısı | kimliklerin
-- ve güncelleme zamanlarının özeti (md5). Kişisel veri yazmaz; yalnızca sayı ve özet üretir.
--
--   psql "$DB_URL" -X -At -f supabase/ops/backup_fingerprint.sql > once.txt
--   psql "$RESTORE_URL" -X -At -f supabase/ops/backup_fingerprint.sql > sonra.txt
--   diff once.txt sonra.txt && echo "geri yükleme birebir"
--
-- Kapsam: kiracılar ve üyelikler, alan adları, web sitesi yapılandırması ve yayın sürümleri,
-- marka/ayarlar, ilanlar ve görselleri, talepler/müşteriler, içerik, davetler, Auth kullanıcıları,
-- Storage nesne kayıtları (dosyaların kendisi ayrıca yedeklenir: docs/BACKUP_RESTORE.md).
-- Tablo yoksa (eski şema) satırda "yok" yazar; betik durmaz.
-- =============================================================================
with t(sira, tablo, sorgu) as (
  values
    (1,  'organizations',          'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text || status || coalesce(slug, ''''), '','' order by id)), ''-'') from public.organizations'),
    (2,  'organization_members',   'select count(*)::text || '' | '' || coalesce(md5(string_agg(organization_id::text || user_id::text || role::text || status::text, '','' order by organization_id, user_id)), ''-'') from public.organization_members'),
    (3,  'organization_settings',  'select count(*)::text || '' | '' || coalesce(md5(string_agg(organization_id::text || updated_at::text, '','' order by organization_id)), ''-'') from public.organization_settings'),
    (4,  'organization_domains',   'select count(*)::text || '' | '' || coalesce(md5(string_agg(hostname || status || is_primary::text, '','' order by hostname, organization_id)), ''-'') from public.organization_domains'),
    (5,  'site_configs',           'select count(*)::text || '' | '' || coalesce(md5(string_agg(organization_id::text || published_version::text || md5(published::text) || md5(draft::text), '','' order by organization_id)), ''-'') from public.site_configs'),
    (6,  'site_config_revisions',  'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from public.site_config_revisions'),
    (7,  'subscriptions',          'select count(*)::text || '' | '' || coalesce(md5(string_agg(organization_id::text || plan_id::text || status::text, '','' order by organization_id)), ''-'') from public.subscriptions'),
    (8,  'properties',             'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text || status::text || updated_at::text, '','' order by id)), ''-'') from public.properties'),
    (9,  'media_assets',           'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from public.media_assets'),
    (10, 'leads',                  'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text || status::text, '','' order by id)), ''-'') from public.leads'),
    (11, 'customers',              'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from public.customers'),
    (12, 'pages',                  'select count(*)::text || '' | '' || coalesce(md5(string_agg(organization_id::text || key || updated_at::text, '','' order by organization_id, key)), ''-'') from public.pages'),
    (13, 'posts',                  'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from public.posts'),
    (14, 'redirects',              'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from public.redirects'),
    (15, 'organization_invitations','select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text || status, '','' order by id)), ''-'') from public.organization_invitations'),
    (16, 'auth.users',             'select count(*)::text || '' | '' || coalesce(md5(string_agg(id::text, '','' order by id)), ''-'') from auth.users'),
    (17, 'storage.objects',        'select count(*)::text || '' | '' || coalesce(md5(string_agg(bucket_id || ''/'' || name, '','' order by bucket_id, name)), ''-'') from storage.objects')
)
select sira || ' | ' || tablo || ' | ' ||
       case when to_regclass(case when tablo like '%.%' then tablo else 'public.' || tablo end) is null then 'yok'
            else (xpath('/row/v/text()', query_to_xml('select v from (' || sorgu || ') q(v)', false, true, '')))[1]::text end
  from t
 order by sira;
