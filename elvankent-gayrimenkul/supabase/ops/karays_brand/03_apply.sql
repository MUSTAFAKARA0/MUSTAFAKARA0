-- =============================================================================
-- KARAYS marka geçişi — 3/5 UYGULAMA: 20261018000001_karays_brand.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): 01 çıktısında DUR yok · 02 betiği saklandı · tam yedek alındı ve doğrulandı
-- (pg_restore --list + parmak izi) · bu adım için yazılı onay var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 5 sn: platform_settings kilidi alınamazsa beklemeden vazgeçer (site etkilenmez).
--   • Koruma: şema sürümü 20261011000001'den eskiyse durur (önce eksik migration'lar).
--   • Migration gövdesi supabase/migrations/20261018000001_karays_brand.sql ile birebir aynıdır
--     (birim testi LR-10 denetler).
--   • Supabase CLI geçmiş tablosu varsa kayıt eklenir (yoksa adım atlanır); tekrar çalıştırılabilir.
--   • Sondaki kontrol aynı işlemde çalışır: beklenen sonuç yoksa işlem geri alınır.
-- =============================================================================
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $koruma$
declare surum text;
begin
  if to_regclass('public.platform_settings') is null then
    raise exception 'DUR: public.platform_settings yok (20261002000001_karay_platform.sql uygulanmamış)';
  end if;
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261011000001' then
    raise exception 'DUR: şema sürümü % — önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
end
$koruma$;

-- ---- 20261018000001_karays_brand.sql (gövde, değiştirilmeden) ---------------
alter table public.platform_settings alter column company_name set default 'KARAYS';

update public.platform_settings set company_name = 'KARAYS' where company_name = 'KARAY';

-- karay_schema_version(): uygulanmış en son migration'ın kimliği (canlıya çıkış kontrolü)
create or replace function public.karay_schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20261018000001'::text $$;
revoke all on function public.karay_schema_version() from public;
grant execute on function public.karay_schema_version() to anon, authenticated, service_role;
-- ---- gövde sonu --------------------------------------------------------------

-- Supabase CLI geçmişi (tablo varsa): ileride "supabase db push" bu dosyayı yeniden çalıştırmaz
do $gecmis$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $q$insert into supabase_migrations.schema_migrations (version, name)
               values ('20261018000001', 'karays_brand') on conflict (version) do nothing$q$;
  end if;
end
$gecmis$;

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare varsayilan text; surum text; kalan int;
begin
  select column_default into varsayilan from information_schema.columns
   where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name';
  if varsayilan is distinct from '''KARAYS''::text' then
    raise exception 'KONTROL: varsayılan beklenen değil (%); işlem geri alınıyor', varsayilan;
  end if;
  select count(*) into kalan from public.platform_settings where company_name = 'KARAY';
  if kalan <> 0 then
    raise exception 'KONTROL: company_name hâlâ KARAY; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum <> '20261018000001' then
    raise exception 'KONTROL: şema sürümü % (beklenen 20261018000001); işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

notify pgrst, 'reload schema';
commit;

-- Sonuç (yalnızca okur; SQL Editor bu tabloyu gösterir)
select 'company_name' as alan, (select company_name from public.platform_settings) as deger
union all
select 'varsayılan', (select column_default from information_schema.columns
                       where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'company_name')
union all
select 'karay_schema_version()', public.karay_schema_version();
