-- =============================================================================
-- Ekleme kilidi — 5/5 GERİ DÖNÜŞ (20261025000001_quota_lock.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261025000001_quota_lock.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14
-- her ifadenin burada bulunduğunu denetler). SIRA: uygulamanın tersi — ops02_limits de geri alınacaksa
-- önce ops02_limits/05_rollback.sql, sonra bu betik.
-- Yalnızca onayla. Tek işlem; geri dönüş sonrası eşzamanlı eklemeler yeniden aynı sayımı görür
-- (eski davranış). Veri değiştirilmez.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: tablo kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 5, 6, 7. satırlar uygulama öncesi (02) çıktıyla aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists aa_quota_lock on public.properties;
drop trigger if exists aa_quota_lock on public.organization_members;
drop function if exists public.quota_lock();

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
declare kalan int;
begin
  select count(*) into kalan from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal;
  if kalan <> 0 or to_regprocedure('public.quota_lock()') is not null then
    raise exception 'KONTROL: aa_quota_lock ya da quota_lock() kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
