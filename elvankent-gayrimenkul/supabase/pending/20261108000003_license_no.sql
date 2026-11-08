-- =============================================================================
-- P0-8 · Taşınmaz ticareti yetki belgesi numarası (G)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin yazılı onayı ve
-- supabase/ops/license_no/ betikleriyle alınır. Başka bekleyen dosyaya bağlı değildir.
--
-- Amaç: ofisin taşınmaz ticareti yetki belgesi numarası ofis ayarlarında tutulur ve ofis sitesinin alt bilgisinde
-- (dolayısıyla her ilan sayfasında) gösterilir. Hangi kanallarda gösterilmesinin zorunlu olduğu ve EİDS kapsamı avukat
-- görüşüne bağlıdır (D-20); alan isteğe bağlıdır, boşken site değişmez.
--
-- Etki: organization_settings'e tek nullable sütun. Mevcut satırlar değişmez (NULL). Yazma: `settings.manage` yetkili
-- ofis kullanıcısı (organization_settings_guard bu sütunu taslak/yayın akışına bağlamaz; doğrudan kaydedilir).
-- Okuma: public_tenant_settings tüm sütunları (updated_by hariç) döndürür → site gösterir. Kişisel veri değildir.
-- Biçim: büyük harf/rakam/tire, 3–20 karakter (uygulama boşlukları kırpar, büyük harfe çevirir).
-- Eski kod bu sütunu okumaz/yazmaz; yeni kod sütun yoksa alanı göstermez (sıra serbest).
-- Tekrar çalıştırılabilir.
--
-- GERİ DÖNÜŞ: (05_rollback.sql — sütundaki girilmiş numaralar silinir; önce 02 çıktısı saklanır)
--   alter table public.organization_settings drop column if exists license_no;
-- =============================================================================

alter table public.organization_settings
  add column if not exists license_no text
  constraint organization_settings_license_no_format check (license_no ~ '^[0-9A-Z-]{3,20}$');

comment on column public.organization_settings.license_no is
  'Taşınmaz ticareti yetki belgesi numarası (P0-8). Sitede alt bilgide gösterilir; boşsa gösterilmez.';

notify pgrst, 'reload schema';
