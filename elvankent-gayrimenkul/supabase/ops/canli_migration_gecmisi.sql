-- =============================================================================
-- KI-23 · CANLI MIGRATION GEÇMİŞİ — supabase_migrations.schema_migrations kayıtlarını depodaki dosyalarla karşılaştırır
-- (YALNIZCA OKUR)
--
-- Tek bir SELECT; hiçbir tabloya yazmaz, DDL/DML yoktur. canli_sema_tespiti.sql'in TAMAMLAYICISIDIR: o dosya "nesne var mı"ya
-- bakar; bu dosya "kayıt defterinde hangi sürüm, hangi İÇERİKLE kayıtlı"ya bakar.
--   Supabase › SQL Editor › New query › yapıştır › Run   (proje adını kontrol edin)
--
-- Her sürüm için: kayıtlı ifade sayısı ve ifadelerin MD5 özeti (ifade metni YAZILMAZ; içerik depodaki migration dosyasıdır,
-- kişisel veri içermez). Beklenen değerler depodaki 31 migration'ın Supabase CLI 2.122.0 ile yerelde uygulanmasından alındı.
--   AYNI           kayıt depodaki dosyayla aynı içerikle yapılmış
--   FARKLI         ifade sayısı ya da özet farklı: dosya uygulandıktan sonra değişmiş, elle düzenlenmiş ya da farklı CLI
--                  sürümü ifadeleri farklı bölmüş olabilir → HATA değil, elle inceleme gerekir
--   AYNI (O-5a kaydı)        supabase/ops/o5a dosyasıyla SQL Editor'den uygulanmış; ifade = dosyanın tamamı, özet aynı
--   AYNI (KARAYS runbook kaydı)  karays_brand/03_apply.sql'in yazdığı içeriksiz kayıt (beklenen)
--   İÇERİKSİZ      ifade listesi boş: "migration repair" ile işaretlenmiş (uygulandığının kanıtı DEĞİL)
--   DEPODA YOK     kayıtlı sürüm depoda yok (başka dal / elle eklenmiş)
--   KAYITSIZ       depodaki sürüm kayıt defterinde yok (uygulanmamış ya da SQL Editor ile uygulanmış)
-- Son satırlar: kayıt sayısı, en yeni sürüm, kayıtlı-ama-nesnesi-olmayan ayrımı için canli_sema_tespiti.sql ile birlikte okunur.
-- =============================================================================
with expected(version, name, n, md5) as (
  values
    ('20260922000001', 'schema', 56, '1d2d209c120a61649983a56616ac4aba'),
    ('20260922000002', 'security', 80, '6342d28f9a22e2cb1059b4e2039ab934'),
    ('20260922000003', 'storage', 5, 'be0b62bf6b9b336156fe7789a472a590'),
    ('20260922000004', 'reference_data', 6, 'fb100342673b38f2abdcbbaaebf93097'),
    ('20260926000001', 'v2_enums', 9, '82312d02b372c906b1ffcee681992504'),
    ('20260926000002', 'v2_tenancy', 59, '706513c89ec8e5f25387ccf24e980e05'),
    ('20260926000003', 'v2_properties', 121, '6f4dc45938269c4463c614acdffd7f2a'),
    ('20260926000004', 'v2_crm', 47, '2383b352ed590dd47fe50be1c3645cd1'),
    ('20260926000005', 'v2_content', 19, '247963d2cade87ee75ea430e75979ef7'),
    ('20260926000006', 'v2_audit', 27, '2332c42b3cbb77bbf3ee6379310b4945'),
    ('20260926000007', 'v2_security', 156, 'b2f41be15e43abdde3e873db6d448336'),
    ('20260926000008', 'v2_storage', 15, 'b1c75baedc1c417749930ecfb00a80de'),
    ('20260926000009', 'v2_reference_data', 1, '43df79a60452e47f44ff46399229c5ce'),
    ('20260927000001', 'v2_platform_fixes', 5, '5eb210c7ec678abbf810e98c1eaae7ca'),
    ('20260928000001', 'stage3_notifications', 23, '54b37543855b045ebf08c4f8a95bc873'),
    ('20260928000002', 'stage3_mfa', 14, '966fd56bf29bea52942a323a92556da5'),
    ('20260928000003', 'stage3_location_codes', 7, 'f22e34ed48fd2050937357f86defd81c'),
    ('20260929000001', 'platform_owner_isolation', 18, 'a836a71534c2104f9cba1e2e9066420e'),
    ('20260930000001', 'session_context_and_indexes', 16, 'cd83d42851c56e676a9a7ccd13d42a1b'),
    ('20260930000002', 'site_builder', 51, '68bcac331238bcd7be9f164d451eaf9b'),
    ('20261001000001', 'site_brand_publish', 18, '1d2075db9664abc3718fa7ff8f45d9d2'),
    ('20261002000001', 'karay_platform', 30, 'c8b3b121e2d3e0ace439a515dac8a276'),
    ('20261004000001', 'design_family_access', 27, '5fa36b94aae6dbcac1b44c48f8eefbce'),
    ('20261005000001', 'office_site_management', 18, 'cc5c427d02d6b55124d3899cc76e7621'),
    ('20261006000001', 'brand_content_draft', 12, 'e2e3606cd353476b6e0f788cb95b5bfe'),
    ('20261007000001', 'seo_draft', 16, '7ec70fdc06c7dc7304c49b0d65bc859d'),
    ('20261008000001', 'owner_invitations', 49, '36a7a3829aec7ca511700f5a90fe15b5'),
    ('20261009000001', 'custom_domains', 36, '77d1f5ba812fa2eed4f760e42213c100'),
    ('20261010000001', 'password_reset_requests', 6, '1b16036d1ade0048f88b8f3d0a6e2b7d'),
    ('20261011000001', 'customer_operations', 33, '33a5468c1fd5c0f7219e78f0d7c3e87a'),
    ('20261018000001', 'karays_brand', 5, 'f05fcff320793863ab2b985f56c05681')
),
-- O-5a (supabase/ops/o5a, scripts/o5a-build.sh): SQL Editor ile uygulanan dosya, ifadeler = dosyanın tamamı tek parça
o5a(version, dosya_md5) as (
  values
    ('20261002000001', '70c6d195784b3bc1ae9ced06e37b589a'),
    ('20261004000001', '84a6a85827e4deae1024fd91932cf6f6'),
    ('20261005000001', '9915e01b080c69da4e889ea9983c8fbd'),
    ('20261006000001', '3f839baeb661b9aba9140e6a20747247'),
    ('20261007000001', 'c96e2e6c2710ff7e1b277e1f54faa7e0'),
    ('20261008000001', 'fa1debb6fccfece18299a6c6590b2eb5'),
    ('20261009000001', '11b61e7ed8ca509b7f728ae43c43f92f'),
    ('20261010000001', 'c4f8b9f43ccb11c0cd3efa7fd58f4e43'),
    ('20261011000001', '5354679775dd0cf02a0cd2fdd1ea1922')
),
reg as (
  select version, name, coalesce(array_length(statements, 1), 0) as n,
         md5(array_to_string(statements, E'\n')) as md5
    from supabase_migrations.schema_migrations
),
cmp as (
  select coalesce(e.version, r.version) as version, coalesce(e.name, r.name) as name,
         case when r.version is null then 'KAYITSIZ'
              when e.version is null then 'DEPODA YOK'
              when r.version = '20261018000001' and r.n = 0 then 'AYNI (KARAYS runbook kaydı)'
              when r.n = 0 then 'İÇERİKSİZ'
              when r.n = e.n and r.md5 = e.md5 then 'AYNI'
              when r.n = 1 and r.md5 = (select o.dosya_md5 from o5a o where o.version = r.version) then 'AYNI (O-5a kaydı)'
              else 'FARKLI' end as durum,
         case when r.version is not null and e.version is not null and r.n > 0 and (r.n <> e.n or r.md5 <> e.md5)
              then 'kayıtlı ' || r.n || ' ifade, depo ' || e.n else '' end as not_
    from expected e full join reg r on r.version = e.version
)
select version as surum, name as dosya, durum, not_ from cmp
union all
select 'ÖZET', 'kayıt defteri', coalesce((select count(*)::text from reg), '0') || ' kayıt · en yeni '
       || coalesce((select max(version) from reg), 'yok'), ''
union all
select 'ÖZET', 'durumlar', (select string_agg(durum || '=' || c, ', ' order by durum) from (select durum, count(*) c from cmp group by durum) s), ''
order by 1, 2;
