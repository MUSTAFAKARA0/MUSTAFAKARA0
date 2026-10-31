-- =============================================================================
-- Başıboş medya dosyaları — 5/5 GERİ DÖNÜŞ (20261031000001_media_stray_sweep.sql'i geri alır)
--
-- Kaynak: pending dosyanın "GERİ DÖNÜŞ" başlığı (LR-14 denetler). Yalnızca onayla; tek işlem. Fonksiyon silinir; veri ve dosya
-- değişmez. Yeni kod fonksiyonu bulamazsa (PGRST202) süpürmeyi atlar; ayrıca kod geri alınması gerekmez.
-- A'nın 05'inden ÖNCE çalıştırılır (D, A'ya dayanır).
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop function if exists public.media_stray_objects(integer);
notify pgrst, 'reload schema';

do $kontrol$
begin
  if to_regprocedure('public.media_stray_objects(integer)') is not null then
    raise exception 'KONTROL: media_stray_objects kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
