-- =============================================================================
-- Yetki belgesi numarası — 5/5 GERİ DÖNÜŞ (20261108000003_license_no.sql'i geri alır)
--
-- Kaynak: pending dosyanın "GERİ DÖNÜŞ" başlığı (LR-14 denetler). Yalnızca onayla.
-- DİKKAT: girilmiş numaralar silinir — önce 02_save_state.sql çıktısını saklayın.
-- ÖNCE yeni panel kodu geri alınmalı değildir: yeni kod sütun yoksa alanı göstermez.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.organization_settings drop column if exists license_no;
notify pgrst, 'reload schema';

do $kontrol$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organization_settings' and column_name = 'license_no') then
    raise exception 'KONTROL: license_no kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
