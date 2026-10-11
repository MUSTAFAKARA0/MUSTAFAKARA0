-- =============================================================================
-- Stage 3 / 3 — Konum referans verisi: resmî kodlar
--
-- İl → ilçe → mahalle hiyerarşisi Türkiye geneli veriyi zaten destekler
-- (adlar üst öğeye göre benzersiz). Güvenilir içe aktarma ve sonraki
-- güncellemeler için kaynak veri setindeki kodlar saklanır:
--   cities.code         plaka kodu ("06")
--   districts.code      kaynak ilçe kodu (ör. PTT / TÜİK / UAVT)
--   neighborhoods.code  kaynak mahalle kodu
-- Kodlar isteğe bağlıdır; mevcut satırlar ve slug'lar DEĞİŞMEZ.
-- İçe aktarma: scripts/import-locations.mjs (docs/LOCATION_DATA.md).
-- =============================================================================

alter table public.cities add column if not exists code text check (code is null or code ~ '^[0-9]{2}$');
alter table public.districts add column if not exists code text check (code is null or char_length(code) between 1 and 20);
alter table public.neighborhoods add column if not exists code text check (code is null or char_length(code) between 1 and 20);

create unique index if not exists cities_code_key on public.cities (code) where code is not null;
create unique index if not exists districts_city_code_key on public.districts (city_id, code) where code is not null;
create unique index if not exists neighborhoods_district_code_key on public.neighborhoods (district_id, code) where code is not null;

-- Ankara'nın plaka kodu (mevcut kayıt)
update public.cities set code = '06' where slug = 'ankara' and code is null;
