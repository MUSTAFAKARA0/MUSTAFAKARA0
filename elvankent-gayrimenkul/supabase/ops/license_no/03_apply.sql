-- =============================================================================
-- Yetki belgesi numarası — 3/5 UYGULAMA: supabase/pending/20261108000003_license_no.sql (tek işlem)
--
-- ÖN KOŞUL: 01'de DUR yok · 02 saklandı · tam yedek alındı · sahibin yazılı onayı.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak Run · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
-- Tek işlem; lock_timeout 3 sn (ADD COLUMN kısa ACCESS EXCLUSIVE kilit; NULL varsayılan → tablo yeniden yazılmaz).
-- Tekrar çalıştırılabilir. Mevcut veri değişmez. Geri dönüş: 05.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir', surum;
  end if;
  if to_regclass('public.organization_settings') is null then
    raise exception 'DUR: public.organization_settings yok';
  end if;
end
$koruma$;

-- ---- 20261108000003_license_no ----------------------------------------------
alter table public.organization_settings
  add column if not exists license_no text
  constraint organization_settings_license_no_format check (license_no ~ '^[0-9A-Z-]{3,20}$');

comment on column public.organization_settings.license_no is
  'Taşınmaz ticareti yetki belgesi numarası (P0-8). Sitede alt bilgide gösterilir; boşsa gösterilmez.';

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_settings_license_no_format' and conrelid = to_regclass('public.organization_settings')) then
    raise exception 'KONTROL: license_no biçim kısıtı yok; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

select 'license_no sütunu' as alan, (exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no'))::text as deger;
