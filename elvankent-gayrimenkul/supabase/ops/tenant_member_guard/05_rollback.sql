-- =============================================================================
-- Kiracı üyelik koruması — 5/5 GERİ DÖNÜŞ (20261108000002_tenant_member_guard.sql'i geri alır)
--
-- Kaynak: pending dosyanın "GERİ DÖNÜŞ" başlığı (LR-14 her ifadenin burada bulunduğunu denetler).
-- Yalnızca onayla. Tek işlem. Veri değiştirilmez: yalnız iki tetikleyici ve fonksiyonları silinir.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- Sonra: 01 yeniden; 5. satır 0, 6. satır uygulama öncesiyle aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists organization_members_target_guard on public.organization_members;
drop function if exists public.organization_members_target_guard();
drop trigger if exists properties_og_media_guard on public.properties;
drop function if exists public.properties_og_media_guard();

do $kontrol$
begin
  if exists (select 1 from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal)
     or to_regprocedure('public.organization_members_target_guard()') is not null
     or to_regprocedure('public.properties_og_media_guard()') is not null then
    raise exception 'KONTROL: F nesnelerinden biri kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
