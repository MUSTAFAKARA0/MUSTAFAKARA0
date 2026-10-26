-- =============================================================================
-- Medya sonlandırma RPC'si (20261027000001_media_finalize_rpc.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. Tüm "durum"lar TAMAM olmalı.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- Gövde özeti: prosrc'deki boşluklar tek boşluğa indirilip kırpılır, md5 alınır (LR-14 aynı hesabı JS ile yapar).
-- =============================================================================
with
f as (
  select p.oid, p.prosrc from pg_proc p where p.oid = to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)')
),
q as (
  select to_regclass('public.media_file_queue') as tablo
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'A fonksiyonları: security definer + boş search_path (6 beklenir)' as kontrol,
         (select count(*)::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and p.proconfig @> array['search_path=""'] and p.proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files')) as deger,
         case when (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
                      and p.proconfig @> array['search_path=""'] and p.proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files')) = 6
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'media_finalize / media_mark_failed: yürütme yetkisi (yalnız authenticated; PUBLIC/anon/service_role yok)',
         coalesce((select string_agg(distinct p.proname || ':' || case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ')
                     from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     left join pg_roles r on r.oid = a.grantee
                    where p.pronamespace = 'public'::regnamespace and p.proname in ('media_finalize', 'media_mark_failed')
                      and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))), 'yok'),
         case when (select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      left join pg_roles r on r.oid = a.grantee
                     where p.pronamespace = 'public'::regnamespace and p.proname in ('media_finalize', 'media_mark_failed')
                       and a.privilege_type = 'EXECUTE' and r.rolname = 'authenticated') = 2
                and not exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where p.pronamespace = 'public'::regnamespace and p.proname in ('media_finalize', 'media_mark_failed')
                                  and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'service_role')))
              then 'TAMAM' else 'HATA: yetkiler beklenen değil' end
  union all
  select 3, 'media_queue_claim / media_queue_done: yürütme yetkisi (yalnız service_role)',
         coalesce((select string_agg(distinct p.proname || ':' || case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ')
                     from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     left join pg_roles r on r.oid = a.grantee
                    where p.pronamespace = 'public'::regnamespace and p.proname in ('media_queue_claim', 'media_queue_done')
                      and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))), 'yok'),
         case when (select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      left join pg_roles r on r.oid = a.grantee
                     where p.pronamespace = 'public'::regnamespace and p.proname in ('media_queue_claim', 'media_queue_done')
                       and a.privilege_type = 'EXECUTE' and r.rolname = 'service_role') = 2
                and not exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where p.pronamespace = 'public'::regnamespace and p.proname in ('media_queue_claim', 'media_queue_done')
                                  and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated')))
              then 'TAMAM' else 'HATA: yetkiler beklenen değil' end
  union all
  select 4, 'media_file_queue: RLS açık, politika yok, yabancı anahtar yok',
         coalesce((select c.relrowsecurity::text from pg_class c where c.oid = (select tablo from q)), 'yok') || ' / '
           || (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'media_file_queue') || ' / '
           || (select count(*)::text from pg_constraint where conrelid = (select tablo from q) and contype = 'f'),
         case when (select tablo from q) is not null
                and (select c.relrowsecurity from pg_class c where c.oid = (select tablo from q))
                and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'media_file_queue') = 0
                and (select count(*) from pg_constraint where conrelid = (select tablo from q) and contype = 'f') = 0
              then 'TAMAM' else 'HATA' end
  union all
  select 5, 'media_file_queue: anon / authenticated / service_role / PUBLIC için tablo yetkisi yok',
         case when (select tablo from q) is null then 'yok'
              else coalesce((select string_agg(distinct case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ')
                               from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where c.oid = (select tablo from q) and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))), 'hiçbiri') end,
         case when (select tablo from q) is not null
                and not exists (select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where c.oid = (select tablo from q) and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role')))
              then 'TAMAM' else 'HATA' end
  union all
  select 6, 'media_assets_enqueue_files tetikleyici tanımı',
         coalesce((select pg_get_triggerdef(oid) from pg_trigger where tgname = 'media_assets_enqueue_files' and not tgisinternal
                      and tgrelid = to_regclass('public.media_assets') limit 1), 'yok'),
         case when exists (select 1 from pg_trigger where tgname = 'media_assets_enqueue_files' and not tgisinternal
                              and tgrelid = to_regclass('public.media_assets')
                              and pg_get_triggerdef(oid) like 'CREATE TRIGGER media_assets_enqueue_files AFTER DELETE ON public.media_assets REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION %media_assets_enqueue_files()')
              then 'TAMAM' else 'HATA: AFTER DELETE / FOR EACH STATEMENT / old_rows beklenir' end
  union all
  select 7, 'media_finalize() gövde özeti (boşluklar tek, md5)',
         coalesce((select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f), 'yok'),
         case when (select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from f) = 'b554564babb260fdbc05db63b2d804a9'
              then 'TAMAM' else 'HATA: gövde bekleneni içermiyor' end
  union all
  select 8, 'Depolama erişimi (fonksiyon sahibi): storage.objects SELECT / rolbypassrls',
         coalesce((select o.rolname || ' · ' || has_table_privilege(o.oid, 'storage.objects', 'select')::text || ' · ' || o.rolbypassrls::text
                     from f join pg_proc p on p.oid = f.oid join pg_roles o on o.oid = p.proowner), 'yok'),
         case when exists (select 1 from f join pg_proc p on p.oid = f.oid join pg_roles o on o.oid = p.proowner
                            where has_table_privilege(o.oid, 'storage.objects', 'select') and o.rolbypassrls)
              then 'TAMAM' else 'HATA: sahip storage.objects okuyamaz; sonlandırma media_not_uploaded verir' end
  union all
  select 9, 'media_file_queue_id_seq: anon / authenticated / service_role / PUBLIC için dizi yetkisi yok',
         case when to_regclass('public.media_file_queue_id_seq') is null then 'yok'
              else coalesce((select string_agg(distinct case when a.grantee = 0 then 'PUBLIC' else r.rolname::text end, ', ')
                               from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) a
                               left join pg_roles r on r.oid = a.grantee
                              where c.oid = to_regclass('public.media_file_queue_id_seq') and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))), 'hiçbiri') end,
         case when to_regclass('public.media_file_queue_id_seq') is not null
                and not exists (select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) a
                                 left join pg_roles r on r.oid = a.grantee
                                where c.oid = to_regclass('public.media_file_queue_id_seq') and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role')))
              then 'TAMAM' else 'HATA' end
  union all
  select 10, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
