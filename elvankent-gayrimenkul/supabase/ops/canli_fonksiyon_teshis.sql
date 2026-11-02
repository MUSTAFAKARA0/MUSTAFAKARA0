-- =============================================================================
-- KI-23 · FONKSİYON FARKI TEŞHİSİ (YALNIZCA OKUR) — canli_sema_denetimi.sql'in "fonksiyon FARKLI" sonucunu bileşenlerine ayırır.
--
-- Tek bir SELECT; yalnız sistem kataloğu (pg_proc, pg_language). Fonksiyon gövdesi, adı ya da kayıt içeriği YAZDIRILMAZ;
-- yalnız SAYILAR döner. Her public fonksiyon için üç özet beklenenle karşılaştırılır:
--   başlık : dil adı, oynaklık, SECURITY DEFINER, STRICT, LEAKPROOF, PARALLEL, COST, ROWS, dönüş türü, argümanlar, SET ayarları
--   gövde  : prosrc (ham)
--   gövde_cr: prosrc'den satır başı (\r) karakterleri çıkarılmış hâli
-- Yorum: başlık hepsi AYNI ve gövde_cr hepsi AYNI ise fark YALNIZ satır sonu biçimidir (CRLF). Başvuru gövdelerinde satır sonu
-- içeren dize sabiti yoktur (yerel tarama, KI23 §8), dolayısıyla \r yalnız boşluk/yorum konumlarındadır: davranış aynıdır.
-- Beklenen değerler: scripts/sema-denetimi-build.sh (başvuru = migration'lar 20261001000001'e kadar, Supabase CLI ile).
-- =============================================================================
with
-- TESHIS-BEKLENEN-BAS
-- Sıra (başlık, gövde, imza): özetler adın önünde (gizli anahtar tarayıcısı yanlış alarmı, CI #147)
exp(h_baslik, h_govde, imza) as (
  values
    ('6252c0bf984bd26a4cf03b3b49a892ff', 'b2b7aed0d3f6580950cda450d5dccda6', 'active_org_ids()'),
    ('16d3c346c32160d7cfb70b15dfde87e4', '244f9154e78f5a3a3fc8a67bed1340c0', 'assert_super_admin()'),
    ('9087a0566c0022c049b517a7eba52b00', '4ce76a0871846f6761def683515e2b51', 'audit_actor_label(uuid)'),
    ('5bd7e05d4af05bc3205495b134242be4', 'bf732acaea034a30347730b352623cb1', 'audit_changed_fields(jsonb,jsonb)'),
    ('bdc93d8b22299616804436abc56aa78c', 'ad74643f50347d3284dc4756b42d192d', 'audit_generic()'),
    ('bdc93d8b22299616804436abc56aa78c', '29b420889e23a1baa3949a503d7119ce', 'audit_members()'),
    ('bdc93d8b22299616804436abc56aa78c', '1d3658cf2f1f9e5ddcec523fbf887ab0', 'audit_notification_settings()'),
    ('bdc93d8b22299616804436abc56aa78c', 'fcf1694dc01226c58d09b2aee6dfe66d', 'audit_properties()'),
    ('396b16739a83753cc5c7f0161d212017', '59f40e0fd5672042ddf743caf34f56ae', 'bulk_property_action(uuid[],text)'),
    ('eea1a5e3d94f12bf55e8d5dbf22a1b8f', '345bb043d07a0ef9ce15db47faeced67', 'clear_password_change_required()'),
    ('bdc93d8b22299616804436abc56aa78c', '3eafd544f671bb86a3374cbde9e02f3e', 'crm_soft_delete_guard()'),
    ('bdc93d8b22299616804436abc56aa78c', 'a58a7349633f62eef1b8e56551366840', 'crm_tenant_guard()'),
    ('0ad37d93ce756ccb25fc0e0f781e2c28', '441dd72b04407c16a3b221ac6d7d34ef', 'get_public_collection(text)'),
    ('bdc93d8b22299616804436abc56aa78c', '847eed324558bbb97548a6f70b0a67e0', 'handle_new_user()'),
    ('116758d2f569b16b5ae70f3f84bc08c9', '08f5a3a1134506a37ae7347a29b06ef0', 'has_org_permission(uuid,text)'),
    ('bdc93d8b22299616804436abc56aa78c', '691b33fc17768fcc5e60212b569fa2e6', 'inherit_property_org()'),
    ('1e121d42a4b4ec87683b48940c67a228', 'd211378b8098a6a0357d4f7afe1d2410', 'is_super_admin()'),
    ('bdc93d8b22299616804436abc56aa78c', '9db0add416379db1bf0b09eaca95b76f', 'leads_after_status_change()'),
    ('7811c6359b840665f27c833d84d545db', '533bc241c1ea3c995c46a47fc3b81c2d', 'list_org_members(uuid)'),
    ('f67a0f024a2b0ddf926f9c66537027a2', 'ffe23a4541387f119a91b39f202d3431', 'log_security_event(uuid,text,uuid,text,text,text,jsonb,text)'),
    ('bdc93d8b22299616804436abc56aa78c', 'a9f0be1844da1794707083fec1217e15', 'media_assets_ensure_cover()'),
    ('2a1e123dd1a4ca1c0b00def5edb4930e', '3481150a94cef3f1d80e006733b15699', 'media_upload_allowed(uuid,bigint)'),
    ('6252c0bf984bd26a4cf03b3b49a892ff', 'c186524ddabc59940985111f45555dcc', 'member_org_ids()'),
    ('7c110f0f3c90e138dafb755cd089c76a', '8f2a21491a58f24e850f1fb631b012f3', 'next_org_counter(uuid,text,integer)'),
    ('a7cafe6140d11a1fc78caeb62dcb9e34', '41139a3a911d9e185ba3273e01d0afc2', 'org_dashboard(uuid,integer)'),
    ('7811c6359b840665f27c833d84d545db', '3b13ffcd8a39b7160629db5c59b140cf', 'org_member_mfa_status(uuid)'),
    ('4adb851662ccd5ef614c8327d9abe277', '7ca76c034bdc6cfdc968b32745b2cc85', 'org_plan(uuid)'),
    ('42a5adc2794b370cebc3e4d6f81e355f', '0f8ba6e2d0e69a3101adc9ff9d35d266', 'org_usage(uuid)'),
    ('bdc93d8b22299616804436abc56aa78c', 'eab9e704a3a906df4c1a3a3809322d6d', 'organization_members_guard()'),
    ('bdc93d8b22299616804436abc56aa78c', 'ccd644443aea32b3eff8155502564df5', 'organization_settings_guard()'),
    ('b03a329f1455a27725f377d80e26ba71', '19f700fa1f5babc649ee39e80437eaa7', 'platform_add_domain(uuid,text,boolean)'),
    ('cc2df2e10b96cafd33dbf2a1578f52cb', '31cdc4346200bd0eb145a9f70125df12', 'platform_create_organization(text,text,text,text,uuid)'),
    ('0da71fed49265133dd077b3c51e1523d', '8be5e8d721d434b7fd62fa0b2815367c', 'platform_organizations()'),
    ('5e719cb8bd7620a837500ed24bdd1f4b', 'aaa5f510a877f665313aceec4b7a4739', 'platform_remove_domain(uuid)'),
    ('b6995d88bc9b5370d8d605b0480bd1dc', '51d78278de5cb2f9ab2a9cfa8d84537a', 'platform_set_org_plan(uuid,text,subscription_status)'),
    ('4b0d3696df3fd45eeca592e9eaee790c', '6a9eb2b92e5af4021c0429eaa2f46206', 'platform_set_org_status(uuid,org_status)'),
    ('0da71fed49265133dd077b3c51e1523d', 'e69f58ed5254faee841be30ee80c87d7', 'platform_sites()'),
    ('05477f6408557d28808818b647044b7b', '3537f832719cecc6d2a9b8c0cc119764', 'platform_update_plan(text,text,integer,integer,integer,boolean,boolean,boolean,boolean,numeric)'),
    ('7c772ec61aaf6e5592911ba8b904dfb1', '124560581b76956d9340f0d0e67b0491', 'platform_users(text,integer)'),
    ('bdc93d8b22299616804436abc56aa78c', '3497d09891f8722349bac12fae0896f7', 'posts_before_write()'),
    ('bdc93d8b22299616804436abc56aa78c', '662b6fe0319bc9d0055daa5a668d6b49', 'properties_after_delete()'),
    ('bdc93d8b22299616804436abc56aa78c', '7d6bbbdede2ca3591fbf1039e2443c34', 'properties_after_write()'),
    ('bdc93d8b22299616804436abc56aa78c', '8878c434d91a958396e38be3032b2e86', 'properties_before_write()'),
    ('4adb851662ccd5ef614c8327d9abe277', '36b50cdaff1d55a1e60e7f214c84a096', 'public_site_config(uuid)'),
    ('4adb851662ccd5ef614c8327d9abe277', '38dd0718782ac2147ff4dcb6aba8dea1', 'public_tenant_domains(uuid)'),
    ('d67df526fd15cd1a7be2e50e7639019b', '29acd01e9605c8a0790d2dfafe5f6da1', 'public_tenant_settings(uuid)'),
    ('02010ffe7d640abaf825a26b592927d4', 'f35ee9cfd151c1ac81a3e6db37d0c106', 'public_tenant(text,text)'),
    ('30d530b133d7d99289945d9534eeefbc', '1cf32be9329dc0cb1de88cee3fd42eb9', 'purge_old_audit_logs(integer)'),
    ('86346aecceff02be21a9faef375b26f0', '6357156163f1d664bdaa2f378407185d', 'region_listing_counts(uuid)'),
    ('5ff13704d7c1239be501a5772ad43123', 'a123a395bf722b10ec3bcbd5903b5451', 'region_pages_before_write()'),
    ('0b157cbb376871c4c75c5d950dce3052', '18f39724026a3e4d625047af680ccc76', 'region_price_stats(uuid,integer,integer,integer)'),
    ('3ed5ec42dc92acd41b13dab21ff44106', '263c48740d9debcc2051f86583451bb6', 'reorder_property_media(uuid,uuid[])'),
    ('f16049b3504f700d9875341d11c0ab9d', '73dbef7db1a8801429649d65497ea65d', 'session_aal()'),
    ('d75f53ef8b7af9ab95c20feef1993e70', '669505057a3f8dcd180829572f230ff9', 'session_context(uuid,text)'),
    ('8f63207ebd5afe6e645f01727742bae2', '3dddfca97fca78612cc5599d83b71757', 'set_property_cover(uuid)'),
    ('99882c9e42e64290f146c09957a99f2e', '35e0bbb332fb15e43aff1edfb0100dbb', 'set_require_admin_mfa(uuid,boolean)'),
    ('5ff13704d7c1239be501a5772ad43123', '1c4318bee4240d4113d86fad7eb15623', 'set_updated_at()'),
    ('e06c92ef6632160f3a93067e880b93db', 'd5701d9b17ceb089ef60845404a19255', 'similar_properties(uuid,integer)'),
    ('a53988cec3727fc9adf52f52e5e65e78', 'fa86c219223040e6a05ea3dbc4697b72', 'site_apply_brand(uuid,jsonb)'),
    ('e0d970f68a2f7f5a39b8bb8269348b84', 'ad54c7c33f48226da0ac529e39356870', 'site_brand_columns()'),
    ('9fefeda5289f531be0493541072059a2', '02e0738bf7b29a116a500bb153dbe3d0', 'site_brand_snapshot(uuid)'),
    ('bdc93d8b22299616804436abc56aa78c', '33ad6eb212ec747a3175ea5a66ce5f17', 'site_configs_on_org_insert()'),
    ('6ff95f4fb2d60b6194fc916b00533f25', '0a62e3024eaaa46a9ef8f2ba29661cb2', 'site_discard_draft(uuid)'),
    ('4341d034189f9a35707e76e83fed5e59', '52eeda819b191830134a8660be5261a2', 'site_publish(uuid,text)'),
    ('0adbb1cf6d8f4e6a9c8e60910885196f', 'c7981ec7a978028e6623734d3d8dead0', 'site_rollback(uuid,integer)'),
    ('e10d1eee3988670a5586e4c4b823c270', '9cae00e892284745105df87d01627c95', 'site_save_draft(uuid,text,jsonb)'),
    ('63b448af5d07bbaecc4099643f661b52', 'f6f5bb6fbd615bf256045e5c725ef243', 'site_set_features(uuid,jsonb)'),
    ('a3deed60daf4f3c972148fbb9124cca1', '8b4f2a4b34406823785e38dd907eba70', 'site_set_status(uuid,text,text)'),
    ('1abe7de6879920501426da04fce239d9', '7ff2a1e02aeddb93aabbdc9253a863c5', 'slugify(text)'),
    ('339f15133a1693146b580257bde4743f', '50a82c162a9c3192c11c987d57a47f76', 'stale_media(interval)'),
    ('2d3cbdfde90e9f95650adc8e787552a7', 'bfe5e9f1a1803b9bfc1f5a6b6a27d6ff', 'submit_lead(uuid,text,text,text,text,uuid,lead_source,lead_intent,jsonb,timestamp with time zone,boolean,text,text)'),
    ('bdc93d8b22299616804436abc56aa78c', '1ff3cd439d03f866ca7338105c8c530e', 'sync_public_location()'),
    ('09398bce805fef5b3f9a093a51840bee', '56c7842d076e8c5943b93ec1aaed64a4', 'track_event(uuid,property_event_type,text)'),
    ('fd398efbb225d9606ff3b1e129e69306', '421ca76ecc150902fd0ad0ea895e9c14', 'unique_slug(text,uuid,text,uuid)'),
    ('1e121d42a4b4ec87683b48940c67a228', '2202ba42b41cfd71aaa143c740853ab8', 'user_has_mfa()'),
    ('5319f903932eefe464443ffb833b2457', '1a23aff29630932a97b1cf967c31faa2', 'user_org_ids(text)'),
    ('ead6a1cf6d115cbea66862b5a02a3d95', 'e53f1b55aedbc866ad5cc05acbc9b85b', 'write_audit(uuid,text,text,text,text,jsonb)')
),
-- TESHIS-BEKLENEN-SON
cur as (
  select p.oid::regprocedure::text as imza,
         md5(concat_ws('|', l.lanname, p.provolatile, p.prosecdef, p.proisstrict, p.proleakproof, p.proparallel, p.procost, p.prorows,
                       format_type(p.prorettype, null), pg_get_function_arguments(p.oid),
                       array_to_string(array(select unnest(p.proconfig) order by 1), ','))) as h_baslik,
         md5(p.prosrc) as h_govde,
         md5(replace(p.prosrc, chr(13), '')) as h_govde_cr,
         position(chr(13) in p.prosrc) > 0 as cr_var
    from pg_proc p join pg_language l on l.oid = p.prolang
   where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
),
e as (select * from exp where imza <> '?'),
j as (
  select c.*, e.h_baslik as e_baslik, e.h_govde as e_govde
    from cur c join e on e.imza = c.imza
)
select 'TESHIS' as bolum, 'beklenen fonksiyon' as olcu, (select count(*) from e)::text as deger
union all select 'TESHIS', 'eşleşen imza', (select count(*) from j)::text
union all select 'TESHIS', 'başlık AYNI', (select count(*) from j where h_baslik = e_baslik)::text
union all select 'TESHIS', 'gövde ham AYNI', (select count(*) from j where h_govde = e_govde)::text
union all select 'TESHIS', 'gövde CR çıkarılınca AYNI', (select count(*) from j where h_govde_cr = e_govde)::text
union all select 'TESHIS', 'CR içeren gövde', (select count(*) from cur where cr_var)::text
union all select 'TESHIS', 'beklenmeyen fonksiyon', (select count(*) from cur where imza not in (select imza from e))::text
order by 2;
