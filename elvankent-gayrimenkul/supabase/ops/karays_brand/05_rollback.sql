-- =============================================================================
-- KARAYS marka geçişi — 5/5 GENEL GERİ DÖNÜŞ (20261018000001'i geri alır)
--
-- Tercih edilen yol: 02_rollback_script.sql ile uygulamadan ÖNCE üretilen, o veritabanına özgü betik.
-- Bu dosya onun yedeğidir ve ön kontrolün BEKLENEN değerlerini varsayar:
--   şema sürümü 20261011000001 · varsayılan 'KARAY' · company_name 'KARAY'
-- Ön kontrol çıktınız farklıysa aşağıdaki üç sabiti o değerlerle değiştirin (yoksa betik durur).
--
-- Yalnızca onayla. Tek işlem: koruma veya kontrol hata verirse hiçbir şey değişmez.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 3, 5, 6, 8, 9. satırlar uygulama öncesi çıktıyla aynı olmalı.
-- Not: Uygulama kodu (K-15/K-16) bu geri dönüşten sonra da çalışır; yalnızca alt bilgi/JSON-LD'de ad KARAY görünür.
-- =============================================================================
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $geri$
declare
  eski_surum      constant text := '20261011000001';  -- 01 çıktısı, 3. satır
  eski_varsayilan constant text := 'KARAY';           -- 01 çıktısı, 6. satır (tırnaksız)
  eski_ad         constant text := 'KARAY';           -- 01 çıktısı, 5. satır
  surum text;
begin
  if to_regprocedure('public.karay_schema_version()') is null or to_regclass('public.platform_settings') is null then
    raise exception 'DUR: beklenen nesneler yok; geri dönüş yapılmadı';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum <> '20261018000001' then
    raise exception 'DUR: şema sürümü % — 20261018000001 uygulanmamış görünüyor; geri dönüşe gerek yok', surum;
  end if;
  if eski_surum !~ '^\d{14}$' or eski_surum >= '20261018000001' then
    raise exception 'DUR: eski_surum geçersiz (%)', eski_surum;
  end if;

  -- 1) varsayılan
  execute format('alter table public.platform_settings alter column company_name set default %L', eski_varsayilan);
  -- 2) değer: migration yalnızca KARAY'ı KARAYS yaptığı için yalnızca o durumda geri alınır
  if eski_ad = 'KARAY' then
    update public.platform_settings set company_name = 'KARAY' where company_name = 'KARAYS';
  end if;
  -- 3) şema sürümü fonksiyonu: önceki tanım (20261011000001_customer_operations.sql ile aynı biçim)
  execute format($f$create or replace function public.karay_schema_version()
returns text
language sql
immutable
set search_path = ''
as $b$ select %L::text $b$$f$, eski_surum);
  revoke all on function public.karay_schema_version() from public;
  grant execute on function public.karay_schema_version() to anon, authenticated, service_role;
  -- 4) Supabase CLI geçmişi (tablo varsa)
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $q$delete from supabase_migrations.schema_migrations where version = '20261018000001'$q$;
  end if;

  -- Kontrol (aynı işlem içinde)
  execute 'select public.karay_schema_version()' into surum;
  if surum <> eski_surum then
    raise exception 'KONTROL: şema sürümü % (beklenen %)', surum, eski_surum;
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name')
     is distinct from quote_literal(eski_varsayilan) || '::text' then
    raise exception 'KONTROL: varsayılan geri alınamadı';
  end if;
end
$geri$;

notify pgrst, 'reload schema';
commit;

select 'company_name' as alan, (select company_name from public.platform_settings) as deger
union all
select 'varsayılan', (select column_default from information_schema.columns
                       where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name')
union all
select 'karay_schema_version()', public.karay_schema_version();
