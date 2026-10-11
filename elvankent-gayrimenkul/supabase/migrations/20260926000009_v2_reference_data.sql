-- =============================================================================
-- V2 / 9 — Referans veriler: "Diğer" kategorisi emlak tipleri
-- (Ticari kategori V1 "işyeri" tiplerini aynen kullanır.)
-- =============================================================================

insert into public.property_types (category, name, slug, sort_order) values
  ('diger', 'Turistik Tesis', 'turistik-tesis', 310),
  ('diger', 'Diğer', 'diger', 320)
on conflict (slug) do nothing;
