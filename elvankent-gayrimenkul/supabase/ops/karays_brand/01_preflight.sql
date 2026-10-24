-- =============================================================================
-- KARAYS marka geçişi (20261018000001_karays_brand.sql) — 1/5 ÖN KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın (metin olarak): geri dönüşte "eski değerler" (KAYDET satırları)
-- buradan alınır. "durum" sütununda DUR varsa migration UYGULANMAZ.
-- Tablo/fonksiyon yoksa sorgu hata vermez, satır "yok" der (query_to_xml ile dolaylı okuma).
-- Adımlar ve gerekçe: docs/K17_KARAYS_RELEASE.md
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (xpath('/row/n/text()', query_to_xml('select public.karay_schema_version() as n', false, true, '')))[1]::text
         end as surum,
         to_regclass('public.platform_settings') is not null as ps_var,
         to_regclass('supabase_migrations.schema_migrations') is not null as gecmis_var
),
ps as (
  select case when not ps_var then null
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_settings', false, true, '')))[1]::text::int end as satir,
         case when not ps_var then null
              else (xpath('/row/n/text()', query_to_xml('select company_name as n from public.platform_settings', false, true, '')))[1]::text end as ad,
         case when not ps_var then null
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.platform_settings where company_name = ''KARAY''', false, true, '')))[1]::text::int end as etkilenecek,
         (select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name') as varsayilan
  from v
),
g as (
  select case when not gecmis_var then null
              else (xpath('/row/n/text()', query_to_xml('select coalesce(max(version), ''boş'') as n from supabase_migrations.schema_migrations', false, true, '')))[1]::text end as son,
         case when not gecmis_var then null
              else (xpath('/row/n/text()', query_to_xml('select count(*) as n from supabase_migrations.schema_migrations where version = ''20261018000001''', false, true, '')))[1]::text::int end as kayitli
  from v
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'Ortam işareti' as kontrol,
         case when to_regclass('elvankent_demo.environment') is not null then 'DEMO veritabanı (elvankent_demo işareti var)'
              else 'demo işareti yok' end as deger,
         'BİLGİ: uygulamanın kullandığı proje bu mu? Vercel''deki NEXT_PUBLIC_SUPABASE_URL ile panelden karşılaştırın' as durum
  union all
  select 2, 'Sunucu / rol', current_database() || ' · PostgreSQL ' || current_setting('server_version') || ' · rol ' || current_user, 'BİLGİ'
  union all
  select 3, 'Şema sürümü — karay_schema_version()  [KAYDET]', coalesce((select surum from v), 'fonksiyon yok'),
         case when (select surum from v) is null then 'DUR: fonksiyon yok — önceki migration''lar eksik (PRODUCTION_MIGRATION.md)'
              when (select surum from v) = '20261018000001' then 'BİLGİ: bu migration zaten uygulanmış; yeniden çalıştırmak zararsız'
              when (select surum from v) = '20261011000001' then 'TAMAM (beklenen önceki sürüm)'
              when (select surum from v) < '20261011000001' then 'DUR: şema eski — yeni kod bu veritabanıyla çalışmaz; önce eksik migration''lar'
              else 'DUR: beklenmeyen sürüm — inceleyin' end
  union all
  select 4, 'platform_settings satır sayısı', coalesce((select satir from ps)::text, 'tablo yok'),
         case when (select satir from ps) = 1 then 'TAMAM' else 'DUR: tek satır bekleniyordu' end
  union all
  select 5, 'company_name (şu anki değer)  [KAYDET]', coalesce((select ad from ps), 'yok'),
         case when (select ad from ps) = 'KARAY' then 'TAMAM: migration bu değeri KARAYS yapacak'
              when (select ad from ps) = 'KARAYS' then 'BİLGİ: zaten KARAYS; migration değiştirmez'
              when (select ad from ps) is null then 'DUR: satır yok'
              else 'BİLGİ: elle girilmiş ad; migration bu değere DOKUNMAZ' end
  union all
  select 6, 'company_name sütun varsayılanı  [KAYDET]', coalesce((select varsayilan from ps), 'yok'),
         case when (select varsayilan from ps) = '''KARAY''::text' then 'TAMAM (beklenen önceki varsayılan)'
              when (select varsayilan from ps) = '''KARAYS''::text' then 'BİLGİ: zaten KARAYS'
              else 'DUR: beklenmeyen varsayılan — geri dönüş betiğini bu değere göre düzenleyin' end
  union all
  select 7, 'Migration''ın değiştireceği satır sayısı', coalesce((select etkilenecek from ps)::text, '-'), 'BİLGİ (0 veya 1)'
  union all
  select 8, 'karay_schema_version() tanımı  [KAYDET]',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else pg_get_functiondef('public.karay_schema_version()'::regprocedure) end, 'BİLGİ'
  union all
  select 9, 'karay_schema_version() yetkileri  [KAYDET]',
         coalesce((select proacl::text from pg_proc where oid = to_regprocedure('public.karay_schema_version()')), 'yok'), 'BİLGİ'
  union all
  select 10, 'Supabase CLI migration geçmişi tablosu',
         case when (select gecmis_var from v) then 'var · en son kayıt ' || coalesce((select son from g), '-') || ' · 20261018000001 kayıtlı: ' || coalesce((select kayitli from g)::text, '-')
              else 'yok (SQL Editor ile kurulmuş olabilir)' end, 'BİLGİ'
  union all
  select 11, 'platform_settings üzerinde kilit tutan oturum',
         (select count(distinct pid)::text from pg_locks where relation = to_regclass('public.platform_settings') and pid <> pg_backend_pid()),
         'BİLGİ: 0 değilse uygulama kilit bekleyebilir (03 betiği 5 sn sonra vazgeçer)'
  union all
  select 12, '5 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '5 minutes' and pid <> pg_backend_pid()),
         'BİLGİ'
) kontroller
order by sira;
