-- =============================================================================
-- Medya kota kilidi — 5/5 GERİ DÖNÜŞ (20261026000001_media_quota_lock.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261026000001_media_quota_lock.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14
-- her ifadenin burada bulunduğunu denetler). quota_lock'a dokunmaz; o ayrı geri alınır (quota_lock/05).
-- Yalnızca onayla. Tek işlem; geri dönüş sonrası medya yüklemelerinde kota yalnızca uygulamada denetlenir (eski davranış).
-- Veri değiştirilmez.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: tablo kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 7. ve 9. satırlar uygulama öncesi (02) çıktıyla aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists media_assets_quota on public.media_assets;
drop function if exists public.media_quota_check();

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
declare kalan int;
begin
  select count(*) into kalan from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal;
  if kalan <> 0 or to_regprocedure('public.media_quota_check()') is not null then
    raise exception 'KONTROL: media_assets_quota ya da media_quota_check() kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
