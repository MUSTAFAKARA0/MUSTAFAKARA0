-- =============================================================================
-- Şirket adı kısıtı (20261026000002_company_name_check.sql) — 4/5 SON KONTROL
--
-- YALNIZCA OKUR: tek bir SELECT. 03 sonrası: 1–5. satırlar TAMAM; 4. satır "doğrulanmadı" (NOT VALID) olur.
-- 03b_validate.sql çalıştırıldıysa 4. satır "doğrulandı" olmalıdır.
--   Supabase SQL Editor: yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 04_postflight.sql
-- =============================================================================
with
k as (
  select oid, convalidated, contype, pg_get_constraintdef(oid) as tanim
    from pg_constraint
   where conname = 'platform_settings_company_name_plain' and conrelid = to_regclass('public.platform_settings')
),
ihlal as (
  select count(*) as adet from public.platform_settings
   where company_name ~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]'
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'platform_settings_company_name_plain (tam bir kez, kontrol kısıtı)' as kontrol,
         (select count(*)::text from k) as deger,
         case when (select count(*) from k) = 1 and (select contype from k) = 'c'
              then 'TAMAM' else 'HATA' end as durum
  union all
  select 2, 'Kısıt tanımı',
         coalesce((select tanim from k), 'yok'),
         'BİLGİ'
  union all
  select 3, 'Tanım pending dosyadaki düzenli ifadeyi içerir (company_name !~ …)',
         (select (strpos(tanim, E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]') > 0 and strpos(tanim, 'company_name') > 0 and strpos(tanim, '!~') > 0)::text from k),
         case when (select strpos(tanim, E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]') > 0 and strpos(tanim, 'company_name') > 0 and strpos(tanim, '!~') > 0 from k)
              then 'TAMAM' else 'HATA: tanım beklenen düzenli ifadeyi içermiyor' end
  union all
  select 4, 'Doğrulama durumu (convalidated)',
         coalesce((select case when convalidated then 'doğrulandı' else 'doğrulanmadı (NOT VALID)' end from k), 'yok'),
         case when (select convalidated from k) then 'TAMAM (mevcut satırlar da doğrulandı)'
              when (select count(*) from k) = 1 then 'BİLGİ: NOT VALID — yeni/güncellenen satırlar denetlenir; mevcutlar için isteğe bağlı 03b_validate.sql'
              else 'HATA' end
  union all
  select 5, 'Yasak karakter içeren company_name satır sayısı (0 olmalı)',
         (select adet from ihlal)::text,
         case when (select adet from ihlal) = 0 then 'TAMAM' else 'HATA: temizleyin; kısıt bu satırın her güncellemesini reddeder' end
  union all
  select 6, 'karay_schema_version() (değişmemeli)',
         case when to_regprocedure('public.karay_schema_version()') is null then 'yok'
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1) end,
         'BİLGİ: 01 çıktısının 3. satırıyla aynı olmalı'
) kontroller
order by sira;
