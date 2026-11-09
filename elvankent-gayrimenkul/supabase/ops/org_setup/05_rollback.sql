-- =============================================================================
-- İlk kurulum ve tasarım kilidi — 5/5 GERİ DÖNÜŞ (20261108000005_org_setup.sql'i geri alır)
--
-- Kaynak: pending dosyanın "GERİ DÖNÜŞ" başlığı (LR-14 denetler). Kurulum durumu (organization_setup) kaybolur; site
-- yapılandırmaları, yayın sürümleri ve kurulumda seçilmiş tasarımlar KALIR. Uygulama kodu tablo yokken kurulum akışını
-- göstermez ve tasarımı kilitlemez (eski davranış).
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists site_configs_design_lock on public.site_configs;
drop trigger if exists organization_setup_init on public.organizations;
drop function if exists public.platform_reopen_org_setup(uuid, text);
drop function if exists public.org_setup_complete(uuid, text, jsonb);
drop function if exists public.org_setup_progress(uuid, integer, text);
drop function if exists public.site_configs_design_lock();
drop function if exists public.organization_setup_init();
drop table if exists public.organization_setup;
notify pgrst, 'reload schema';

do $kontrol$
begin
  if to_regclass('public.organization_setup') is not null
     or exists (select 1 from pg_trigger where tgname in ('organization_setup_init', 'site_configs_design_lock') and not tgisinternal)
     or to_regprocedure('public.org_setup_complete(uuid,text,jsonb)') is not null then
    raise exception 'KONTROL: I nesneleri kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
