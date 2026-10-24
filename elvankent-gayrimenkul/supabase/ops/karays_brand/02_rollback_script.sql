-- =============================================================================
-- KARAYS marka geçişi (20261018000001_karays_brand.sql) — 2/5 ÖN GÖRÜNTÜ → GERİ DÖNÜŞ BETİĞİ
--
-- YALNIZCA OKUR: tek bir SELECT. Migration'ın değiştireceği nesnelerin BUGÜNKÜ hâlinden
-- (sütun varsayılanı, company_name, karay_schema_version() tanımı ve yetkileri, CLI geçmişi)
-- birebir geri dönüş betiği üretir. Uygulamadan ÖNCE çalıştırın.
--   Supabase SQL Editor: "betik" sütununu sırayla kopyalayıp geri-donus-<tarih>.sql olarak saklayın.
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -At -f 02_rollback_script.sql > geri-donus-<tarih>.sql
-- Üretilen betik yalnızca onayla ve yalnızca 03_apply.sql'den SONRA kullanılır.
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
              then (xpath('/row/n/text()', query_to_xml('select company_name as n from public.platform_settings', false, true, '')))[1]::text end as ad,
         case when (select gecmis_var from o)
              then (xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where version = ''20261018000001''', false, true, '')))[1]::text::int end as kayitli
),
yetki as (
  select string_agg(case when a.grantee = 0 then 'public' else quote_ident(r.rolname) end, ', ' order by coalesce(r.rolname, 'public'))
           filter (where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) as alanlar,
         bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_var
  from pg_proc p
  cross join lateral aclexplode(p.proacl) a
  left join pg_roles r on r.oid = a.grantee
  where p.oid = (select fn from o)
)
select betik from (
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
                 when coalesce((select public_var from yetki), false) then '-- public yürütme yetkisi önceden vardı; revoke yazılmadı'
                 else 'revoke all on function public.karay_schema_version() from public;' end
  union all
  select 10, case when (select fn from o) is null or (select alanlar from yetki) is null then '-- ek grant yok'
                  else format('grant execute on function public.karay_schema_version() to %s;', (select alanlar from yetki)) end
  union all
  select 11, case when not (select gecmis_var from o) then '-- supabase_migrations.schema_migrations yok: geçmiş adımı yok'
                  when (select kayitli from d) > 0 then '-- 20261018000001 geçmişte önceden de kayıtlıydı: silinmez'
                  else 'delete from supabase_migrations.schema_migrations where version = ''20261018000001'';' end
  union all select 12, 'notify pgrst, ''reload schema'';'
  union all select 13, 'commit;'
) b
order by sira;
