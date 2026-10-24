-- =============================================================================
-- KARAYS marka geçişi (20261018000001_karays_brand.sql) — 2/5 ÖN GÖRÜNTÜ → GERİ DÖNÜŞ BETİĞİ
--
-- YALNIZCA OKUR: tek bir SELECT. Migration'ın değiştireceği nesnelerin BUGÜNKÜ hâlinden
-- (sütun varsayılanı, company_name, karay_schema_version() tanımı ve yetkileri, CLI geçmişi)
-- birebir geri dönüş betiği üretir. Uygulamadan ÖNCE çalıştırın.
--   Supabase SQL Editor: "betik" sütununu sırayla kopyalayıp geri-donus-<tarih>.sql olarak saklayın.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -At -f 02_rollback_script.sql > geri-donus-<tarih>.sql
-- Üretilen betik yalnızca onayla ve yalnızca 03_apply.sql'den SONRA kullanılır.
-- Yetkiler: migration'ın dokunduğu dört rolün (public, anon, authenticated, service_role) yürütme yetkisi
-- önce kaldırılır, sonra bugünkü ACL'deki sırayla yeniden verilir. Varsayılan (NULL) ACL, sahibin ve
-- PUBLIC'in yürütebildiği ACL olarak okunur; geri dönüşten sonra 01'in 9. satırı bugünküyle aynı olmalı.
-- Yorum satırları tek satıra indirilir: veritabanından gelen metin (ör. elle girilmiş company_name)
-- satır sonu içerse bile yorumdan taşıp geri dönüş betiğinde komut olarak çalışamaz.
-- =============================================================================
with
o as (
  select to_regclass('public.platform_settings') is not null as ps_var,
         to_regprocedure('public.karay_schema_version()') as fn,
         to_regclass('supabase_migrations.schema_migrations') is not null as gecmis_var
),
d as (
  select (select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name') as varsayilan,
         case when (select ps_var from o)
              then (select x.n from xmltable('/table/row' passing query_to_xml('select company_name as n from public.platform_settings', false, false, '') columns n text path 'n') x limit 1) end as ad,
         case when (select gecmis_var from o)
              then (select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where version = ''20261018000001''', false, false, '') columns n int path 'n') x limit 1) end as kayitli
),
yetki as (
  select string_agg(format('grant execute on function public.karay_schema_version() to %s%s;',
                           case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end,
                           case when a.is_grantable then ' with grant option' else '' end),
                    E'\n' order by a.sira) as grantlar
  from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))
    with ordinality as a(grantor, grantee, privilege_type, is_grantable, sira)
  left join pg_roles r on r.oid = a.grantee
  where p.oid = (select fn from o) and a.privilege_type = 'EXECUTE'
    and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))
)
select case when betik like '--%' then regexp_replace(betik, '[\r\n]+', ' ', 'g') else betik end as betik from (
  select 1 as sira, '-- KARAYS geri dönüş betiği · üretildi ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' · veritabanı ' || current_database() as betik
  union all select 2, '-- Yalnızca 03_apply.sql uygulandıktan sonra ve onayla çalıştırın. Tek işlem: hata olursa hiçbir şey değişmez.'
  union all select 3, 'begin;'
  union all select 4, 'set local lock_timeout = ''5s'';'
  union all select 5, 'set local statement_timeout = ''60s'';'
  union all
  select 6, case when (select varsayilan from d) is null then '-- company_name sütunu/varsayılanı yoktu: varsayılan adımı atlandı'
                 else format('alter table public.platform_settings alter column company_name set default %s;', (select varsayilan from d)) end
  union all
  select 7, case when (select ad from d) = 'KARAY'
                 then 'update public.platform_settings set company_name = ''KARAY'' where company_name = ''KARAYS'';'
                 else '-- company_name önceden ' || coalesce(quote_literal((select ad from d)), 'yok') || ' idi; migration bu satırı değiştirmedi, geri dönüşte dokunulmaz' end
  union all
  select 8, case when (select fn from o) is null then '-- karay_schema_version() yoktu: geri dönüşte fonksiyon bırakılır (silmek için ayrı karar gerekir)'
                 else pg_get_functiondef((select fn from o)) || ';' end
  union all
  select 9, case when (select fn from o) is null then '-- yetki adımı yok'
                 else 'revoke all on function public.karay_schema_version() from public, anon, authenticated, service_role;' end
  union all
  select 10, case when (select fn from o) is null then '-- yetki adımı yok'
                  else coalesce((select grantlar from yetki), '-- bu dört rolden hiçbiri önceden yürütemiyordu') end
  union all
  select 11, case when not (select gecmis_var from o) then '-- supabase_migrations.schema_migrations yok: geçmiş adımı yok'
                  when (select kayitli from d) > 0 then '-- 20261018000001 geçmişte önceden de kayıtlıydı: silinmez'
                  else 'delete from supabase_migrations.schema_migrations where version = ''20261018000001'';' end
  union all select 12, 'notify pgrst, ''reload schema'';'
  union all select 13, 'commit;'
) b
order by sira;
