-- =============================================================================
-- Şirket adı kısıtı — 3b/5 DOĞRULAMA (İSTEĞE BAĞLI, 03'ten sonra, ayrı adım)
--
-- VALIDATE CONSTRAINT mevcut satırları tarar (SHARE UPDATE EXCLUSIVE kilit: okuma/yazmayı engellemez, ama başka
-- şema değişikliklerini bekletir). platform_settings küçük bir tablodur; yine de 03'ten ayrı, sakin bir anda çalıştırın.
-- ÖN KOŞUL: 01'in 5. satırı 0 (yoksa VALIDATE hata verir ve hiçbir şey değişmez).
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03b_validate.sql
-- lock_timeout 3 sn: kilit alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; yeniden deneyin.
-- Sonra 04_postflight.sql: 4. satır "doğrulandı" olmalı. Geri dönüş bu adımı ayrıca geri almaz (05 kısıtı siler).
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.platform_settings validate constraint platform_settings_company_name_plain;

commit;
