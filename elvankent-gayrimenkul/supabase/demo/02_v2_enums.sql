-- =============================================================================
-- DEMO KURULUM 2/4 — V2 enum değerleri
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
-- Otomatik üretildi (npm run demo:sql) — elle düzenlemeyin; kaynak: supabase/migrations
-- 01 başarıyla bittikten sonra, AYRI bir sorgu olarak çalıştırın.
-- =============================================================================

-- Güvenlik: bu veritabanı 01_v1_schema.sql ile kurulmuş DEMO veritabanı değilse dur
do $demo_guard$
begin
  if to_regclass('elvankent_demo.environment') is null then
    raise exception 'DURDURULDU: Bu veritabanı DEMO olarak işaretli değil. Önce 01_v1_schema.sql dosyasını YENİ ve BOŞ demo projesinde çalıştırın. Canlı veritabanında çalıştırmayın.';
  end if;
end
$demo_guard$;

-- ---------------------------------------------------------------------------
-- 20260926000001_v2_enums.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 1 — Enum değişiklikleri
--
-- Enum değerleri ayrı bir migration'da değiştirilir: PostgreSQL, aynı işlem
-- (transaction) içinde eklenen yeni bir enum değerinin kullanılmasına izin
-- vermez. Sonraki migration'lar bu değerleri güvenle kullanabilir.
--
-- İlan durumları (V1 → V2):
--   active  → published   (yayında)
--   passive → archived    (arşiv / yayından kaldırıldı)
--   + pending             (onay bekliyor)
-- Kategori: isyeri → ticari, + diger
-- =============================================================================

alter type public.property_status rename to listing_status;
alter type public.listing_status rename value 'active' to 'published';
alter type public.listing_status rename value 'passive' to 'archived';
alter type public.listing_status add value if not exists 'pending' after 'draft';

alter type public.property_category rename value 'isyeri' to 'ticari';
alter type public.property_category add value if not exists 'diger';

alter type public.property_event_type add value if not exists 'appointment_request';
alter type public.property_event_type add value if not exists 'qr_visit';
alter type public.property_event_type add value if not exists 'compare_add';

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260926000001', 'v2_enums')
on conflict (version) do nothing;
