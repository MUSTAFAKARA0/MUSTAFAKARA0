-- =============================================================================
-- Pilot deneme bitişi — 5/5 GERİ DÖNÜŞ (20261108000004_pilot_trial_end.sql'i geri alır)
--
-- Kaynak: pending dosyanın "GERİ DÖNÜŞ" başlığı (LR-14 denetler). Girilmiş deneme bitiş tarihleri KALIR (veri değişmez).
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop function if exists public.platform_set_trial_end(uuid, timestamptz);
notify pgrst, 'reload schema';

do $kontrol$
begin
  if to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is not null then
    raise exception 'KONTROL: platform_set_trial_end kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
