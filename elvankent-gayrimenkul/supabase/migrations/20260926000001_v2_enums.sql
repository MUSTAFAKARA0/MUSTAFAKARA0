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
