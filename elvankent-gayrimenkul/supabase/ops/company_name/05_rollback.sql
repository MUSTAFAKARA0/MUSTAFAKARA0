-- =============================================================================
-- Şirket adı kısıtı — 5/5 GERİ DÖNÜŞ (20261026000002_company_name_check.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261026000002_company_name_check.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14
-- her ifadenin burada bulunduğunu denetler). Kısıt silinir (doğrulanmış olsa da); veri değiştirilmez.
-- Yalnızca onayla. Tek işlem.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: tablo kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 6. satır "0 / false" (02 çıktısındaki kısıt sayısıyla aynı) olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.platform_settings drop constraint if exists platform_settings_company_name_plain;

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
declare kalan int;
begin
  select count(*) into kalan from pg_constraint
   where conname = 'platform_settings_company_name_plain' and conrelid = to_regclass('public.platform_settings');
  if kalan <> 0 then
    raise exception 'KONTROL: platform_settings_company_name_plain kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
