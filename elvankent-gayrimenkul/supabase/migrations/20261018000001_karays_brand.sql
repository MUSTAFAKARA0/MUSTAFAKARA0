-- =============================================================================
-- KARAYS marka geçişi (K-15): platform sahibinin görünen adı KARAY → KARAYS.
--
-- platform_settings.company_name KARAYS sayfasının alt bilgisinde ve Organization
-- yapılandırılmış verisinde (JSON-LD) gösterilir. Yalnızca hâlâ eski varsayılan 'KARAY'
-- olan satır güncellenir: Platform › KARAYS ayarlarından başka bir ad girildiyse dokunulmaz.
-- Teknik adlar (tablolar, fonksiyonlar, /karay rotası, KARAY_HOSTS) değişmez.
--
-- Uygulama kodu bu dosya uygulanmadan önce de sonra da çalışır (uygulanmazsa alt bilgi ve
-- JSON-LD'de veritabanındaki ad görünür). Tekrar çalıştırılabilir.
--
-- GERİ DÖNÜŞ (gerekirse):
--   alter table public.platform_settings alter column company_name set default 'KARAY';
--   update public.platform_settings set company_name = 'KARAY' where company_name = 'KARAYS';
--   karay_schema_version(): 20261011000001_customer_operations.sql'deki tanım yeniden uygulanır.
-- =============================================================================

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
