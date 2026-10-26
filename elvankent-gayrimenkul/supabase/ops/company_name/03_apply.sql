-- =============================================================================
-- Şirket adı kısıtı — 3/5 UYGULAMA: supabase/pending/20261026000002_company_name_check.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): 01 çıktısında DUR yok (özellikle 5. satır = 0) · 02 çıktısı saklandı · tam yedek alındı ve
-- doğrulandı · bu adım için yazılı O-5 onayı var. company_name kısıtı diğer runbook'lardan bağımsızdır.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 3 sn, statement_timeout 30 sn. ALTER TABLE kısaca ACCESS EXCLUSIVE kilit ister: uzun bir işlem
--     varsa 3 sn sonra 55P03 (lock_not_available) ile vazgeçer, hiçbir şey değişmez; sakin anda TEKRAR deneyin.
--   • Kısıt NOT VALID eklenir: tabloyu taramaz. Mevcut satırlar bu betikte DOĞRULANMAZ; isteğe bağlı ayrı adım 03b_validate.sql.
--   • DİKKAT: NOT VALID kısıt, geçersiz company_name değeri olan bir satırın HERHANGİ bir sütununun güncellenmesini
--     de reddeder. Bu yüzden koruma bloğu, geçersiz değerli satır varsa uygulamayı durdurur (01'in 5. satırıyla aynı sayım).
--   • Koruma: şema sürümü en az 20261018000001 olmalı. Bu betik karay_schema_version() değerini DEĞİŞTİRMEZ.
--   • Gövde supabase/pending/20261026000002_company_name_check.sql ile birebir aynıdır (birim testi LR-14 denetler).
--   • Tekrar çalıştırılabilir (kısıt silinip NOT VALID olarak yeniden eklenir). Veri değiştirmez.
--   • Sondaki kontrol aynı işlemde çalışır: beklenen sonuç yoksa işlem geri alınır.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text; ihlal bigint;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir; önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
  if to_regclass('public.platform_settings') is null then
    raise exception 'DUR: public.platform_settings yok';
  end if;
  select count(*) into ihlal from public.platform_settings
   where company_name ~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]';
  if ihlal <> 0 then
    raise exception 'DUR: % satırda company_name yasak karakter içeriyor; önce Ayarlar ekranından temizleyin (NOT VALID kısıt o satırın her güncellemesini reddeder)', ihlal;
  end if;
end
$koruma$;

-- ---- 20261026000002_company_name_check (gövde, değiştirilmeden) --------------
alter table public.platform_settings drop constraint if exists platform_settings_company_name_plain;

alter table public.platform_settings
  add constraint platform_settings_company_name_plain
  check (company_name !~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]')
  not valid;
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare adet int; dogrulanmis int; surum text;
begin
  select count(*), count(*) filter (where convalidated) into adet, dogrulanmis from pg_constraint
   where conname = 'platform_settings_company_name_plain' and contype = 'c'
     and conrelid = to_regclass('public.platform_settings');
  if adet <> 1 then
    raise exception 'KONTROL: platform_settings_company_name_plain sayısı % (beklenen 1); işlem geri alınıyor', adet;
  end if;
  if dogrulanmis <> 0 then
    raise exception 'KONTROL: kısıt NOT VALID olmalıydı; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur; SQL Editor bu tabloyu gösterir). Tam kontrol: 04_postflight.sql
select 'platform_settings_company_name_plain kısıt sayısı' as alan,
       (select count(*)::text from pg_constraint where conname = 'platform_settings_company_name_plain'
          and conrelid = to_regclass('public.platform_settings')) as deger;
