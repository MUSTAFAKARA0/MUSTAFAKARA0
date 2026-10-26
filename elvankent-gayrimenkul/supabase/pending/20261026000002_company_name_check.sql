-- =============================================================================
-- KARAYS marka adı · platform_settings.company_name düz metin kısıtı (derinlemesine savunma)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına ayrı sahip onayı
-- ve kendi ön/son kontrol adımlarıyla alınır.
--
-- Neden: şirket adı sitede, JSON-LD'de ve operasyon betiklerinin ürettiği SQL yorumlarında kullanılır
-- (supabase/ops/karays_brand/02, düzeltme 92ad985). Uygulama değeri singleLine() ile temizler ve yön
-- denetim karakterlerini hasBidiControl() ile reddeder (src/lib/single-line.ts); ancak service-role
-- ya da SQL ile doğrudan yazan biri bunu aşabilir. Aynı sınıflar veritabanında da reddedilir.
--
-- Reddedilen karakterler (src/lib/single-line.ts ile bire bir):
--   CONTROL_OR_SEPARATOR  C0 U+0001–U+001F (NUL metinde zaten olamaz), DEL + C1 U+007F–U+009F, U+2028, U+2029
--   INVISIBLE             U+200B, U+2060–U+2064, U+FEFF
--   BIDI_CONTROL          U+202A–U+202E, U+2066–U+2069
-- İzin verilenler (uygulamada da korunur): ZWJ/ZWNJ (U+200C/U+200D), LRM/RLM/ALM, her görünür karakter.
-- single-line.ts değişirse bu dosya ve tests/security/rls.test.mjs birlikte güncellenmelidir.
--
-- Kapsam: yalnızca platform_settings.company_name. Mevcut 2–80 karakter kısıtına dokunmaz.
-- Kısıt NOT VALID eklenir: uygulama anında tabloyu taramaz/uzun kilit almaz, yalnızca yeni ve
-- güncellenen satırları denetler. Mevcut satırlar AYRI bir adımda, runbook içinde ön kontrolden sonra
-- doğrulanır:
--   ön kontrol:  select count(*) from public.platform_settings
--                where company_name ~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]';
--                (0 olmalı; değilse değeri uygulamadaki Ayarlar ekranından kaydederek temizleyin)
--   doğrulama:   alter table public.platform_settings validate constraint platform_settings_company_name_plain;
-- DİKKAT: NOT VALID kısıt, satırın HERHANGİ bir sütunu güncellendiğinde yeni satır sürümünü denetler.
-- company_name değeri zaten geçersiz olan bir satırda başka bir ayarın (ör. OPS-02 bayrağı) kaydı da
-- reddedilir. Bu yüzden ön kontrol uygulamadan ÖNCE çalıştırılır; 0 değilse önce değer temizlenir.
--
-- Tekrar çalıştırılabilir (kısıt önce silinip yeniden eklenir; yeniden eklenince NOT VALID'e döner).
-- Veri değiştirmez.
--
-- GERİ DÖNÜŞ:
--   alter table public.platform_settings drop constraint if exists platform_settings_company_name_plain;
-- =============================================================================

alter table public.platform_settings drop constraint if exists platform_settings_company_name_plain;

alter table public.platform_settings
  add constraint platform_settings_company_name_plain
  check (company_name !~ E'[\\u0001-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u200B\\u2060-\\u2064\\uFEFF\\u202A-\\u202E\\u2066-\\u2069]')
  not valid;
