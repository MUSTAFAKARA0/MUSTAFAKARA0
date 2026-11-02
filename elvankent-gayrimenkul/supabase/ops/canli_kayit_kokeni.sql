-- =============================================================================
-- KI-23 · MIGRATION KAYITLARININ KÖKENİ — İÇERİKSİZ kayıtlar hangi mekanizmayla, hangi işlemde yazıldı (YALNIZCA OKUR)
--
-- Tek bir SELECT; hiçbir tabloya yazmaz, DDL/DML yoktur. Kişisel veri, kayıt içeriği, e-posta YAZDIRMAZ.
--   Supabase › SQL Editor › New query › yapıştır › Run   (proje adını kontrol edin)
--
-- Ne ölçer (kanıt, yorum değil):
--   K1  elvankent_demo.environment (demo kurulum dosyası 01_v1_schema.sql'in oluşturduğu işaret tablosu) var mı; varsa kurulum tarihi
--   K2  schema_migrations sütunları
--   K3  her kayıt: ad dolu mu, statements NULL mı / boş dizi mi / kaç ifade; kaydı yazan işlem (xmin)
--   K4  her işlem (xmin) için: o işlemde yazılmış ve bugün hâlâ duran katalog satırı sayıları (pg_class, pg_attribute, pg_proc,
--       pg_policy, pg_type). Sayı > 0 ise kayıt, şema nesneleriyle AYNI işlemde (aynı SQL Editor sorgusunda) yazılmıştır.
--       PostgreSQL ≥ 9.4'te dondurma xmin'i silmez; sonradan değişen satırlar yeni xmin alır (sayı yalnız azalabilir).
--       Sayı 0 = BELİRSİZ, "ayrı yazıldı" kanıtı DEĞİL: aynı dosya sonradan yeniden çalıştırılınca (create or replace,
--       drop/create policy) o işlemin bütün katalog satırları yenilenmiş olabilir (yerelde 06'nın ilk sürümünde görüldü).
--   K5  demo işaret tablosunu oluşturan işlem hangi kayıt grubunun işlemi
--
-- Yerel karşılaştırma (CLI 2.122.0): "supabase db push"/"migration repair" statements'ı DOLDURUR; NULL statements + dolu ad,
-- supabase/demo/0x_*.sql dosyalarının "insert into supabase_migrations.schema_migrations (version, name)" satırının izidir.
-- Ayrıntı: docs/KI23_CANLI_SEMA_ON_KONTROL.md §2.
-- =============================================================================
with reg as (
  select version, name, statements is null as st_null, coalesce(array_length(statements, 1), 0) as n, xmin as tx
    from supabase_migrations.schema_migrations
),
grp as (
  select tx, min(version) as ilk, max(version) as son, count(*) as adet from reg group by tx
),
cat as (
  select g.tx, g.ilk, g.son, g.adet,
         (select count(*) from pg_class c where c.xmin = g.tx) as n_class,
         (select count(*) from pg_attribute a where a.xmin = g.tx) as n_attr,
         (select count(*) from pg_proc p where p.xmin = g.tx) as n_proc,
         (select count(*) from pg_policy p where p.xmin = g.tx) as n_pol,
         (select count(*) from pg_type t where t.xmin = g.tx) as n_type
    from grp g
),
demo as (
  select to_regclass('elvankent_demo.environment') as rel
),
demo_tx as (
  select c.xmin as tx from pg_class c where c.oid = (select rel from demo)
)
select 'K1' as bolum, 'elvankent_demo.environment (demo kurulum işareti)' as nesne,
       case when (select rel from demo) is null then 'YOK'
            else 'VAR · kurulum ' || coalesce((xpath('/row/n/text()', query_to_xml(
                   'select min(created_at)::date::text as n from elvankent_demo.environment', false, true, '')))[1]::text, '?') end as durum,
       '' as ayrinti
union all
select 'K2', 'schema_migrations sütunları',
       (select string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) from information_schema.columns
         where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'), ''
union all
select 'K3', version || ' ' || coalesce(name, '(ad yok)'),
       case when st_null then 'statements NULL' when n = 0 then 'statements boş dizi' else n || ' ifade' end,
       'işlem ' || tx::text
  from reg
union all
select 'K4', 'işlem ' || tx::text || ' · ' || adet || ' kayıt (' || ilk || ' … ' || son || ')',
       case when n_class + n_attr + n_proc + n_pol + n_type > 0 then 'ŞEMA İLE AYNI İŞLEM'
            else 'BELİRSİZ: bu işlemin katalog satırı kalmamış' end,
       'pg_class ' || n_class || ' · pg_attribute ' || n_attr || ' · pg_proc ' || n_proc || ' · pg_policy ' || n_pol || ' · pg_type ' || n_type
  from cat
union all
select 'K5', 'demo işaret tablosunu oluşturan işlem',
       case when (select rel from demo) is null then 'işaret yok'
            when exists (select 1 from grp where tx = (select tx from demo_tx)) then
              'kayıt grubu ' || (select ilk || ' … ' || son from grp where tx = (select tx from demo_tx)) || ' ile AYNI işlem'
            else 'hiçbir kayıt grubuyla aynı değil' end,
       coalesce('işlem ' || (select tx::text from demo_tx), '')
order by 1, 2;
