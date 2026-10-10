-- =============================================================================
-- Platform sahibi (KARAY) ↔ kiracı (emlak ofisi) yalıtımı
--
-- Önceki durum: organizations, organization_settings ve organization_domains
-- tablolarında "herkese açık" okuma politikaları vardı. Bu sayede herkese açık
-- (tarayıcıdaki) anahtarla — veya herhangi bir ofisin kullanıcısıyla — TÜM aktif
-- ofislerin listesi, ayarları ve alan adları toplu olarak çekilebiliyordu
-- (platformun müşteri listesi).
--
-- Yeni durum:
--   • Bu üç tabloda herkese açık okuma politikası kaldırılır. Ofis üyesi yalnızca
--     kendi ofisini, süper admin (platform) hepsini görür (mevcut üye politikaları).
--   • Herkese açık site, ofisini TEK TEK ve yalnızca adresiyle (slug) veya doğrulanmış
--     alan adıyla bulur: public_tenant(), public_tenant_settings(),
--     public_tenant_domains(). Liste döndüren bir yol yoktur.
--
-- Geriye uyumluluk: uygulama önce bu fonksiyonları dener; fonksiyon yoksa (migration
-- henüz uygulanmamışsa) eski doğrudan okumaya döner. Yani kod, migration'dan önce
-- ve sonra çalışır.
--
-- Tekrar çalıştırılabilir (idempotent). Veri değiştirmez / silmez.
-- Geri dönüş: dosyanın sonundaki "GERİ DÖNÜŞ" bölümü.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Herkese açık tekil çözümleme fonksiyonları
-- -----------------------------------------------------------------------------

-- Ofis: adres (slug) VEYA doğrulanmış alan adı ile; yalnızca aktif ofis, en fazla 1 satır
create or replace function public.public_tenant(p_slug text default null, p_hostname text default null)
returns table (
  id uuid,
  slug text,
  name text,
  is_default boolean,
  reference_prefix text,
  status public.org_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.slug, o.name, o.is_default, o.reference_prefix, o.status
    from public.organizations o
   where o.status = 'active'
     and (
       (p_slug is not null and o.slug = p_slug)
       or (
         p_hostname is not null
         and o.id = (
           select d.organization_id
             from public.organization_domains d
            where d.hostname = lower(p_hostname)
              and d.verified_at is not null
            limit 1
         )
       )
     )
   limit 1;
$$;

-- Ofisin site ayarları (marka, iletişim, SEO): kimliği bilinen TEK aktif ofis için.
-- Sitede gösterilmeyen "son değiştiren kullanıcı" (updated_by) boş döner.
create or replace function public.public_tenant_settings(p_org uuid)
returns setof public.organization_settings
language sql
stable
security definer
set search_path = ''
as $$
  select (jsonb_populate_record(null::public.organization_settings, to_jsonb(s) - 'updated_by')).*
    from public.organization_settings s
    join public.organizations o on o.id = s.organization_id and o.status = 'active'
   where s.organization_id = p_org;
$$;

-- Ofisin doğrulanmış alan adları (kanonik adres için)
create or replace function public.public_tenant_domains(p_org uuid)
returns table (hostname text, is_primary boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.hostname, d.is_primary
    from public.organization_domains d
    join public.organizations o on o.id = d.organization_id and o.status = 'active'
   where d.organization_id = p_org
     and d.verified_at is not null;
$$;

revoke all on function public.public_tenant(text, text) from public;
revoke all on function public.public_tenant_settings(uuid) from public;
revoke all on function public.public_tenant_domains(uuid) from public;
grant execute on function public.public_tenant(text, text) to anon, authenticated, service_role;
grant execute on function public.public_tenant_settings(uuid) to anon, authenticated, service_role;
grant execute on function public.public_tenant_domains(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) Toplu okumayı kapat: herkese açık politikalar kaldırılır
--    (üye ve süper admin politikaları olduğu gibi kalır)
-- -----------------------------------------------------------------------------
drop policy if exists "organizations_public_read" on public.organizations;
drop policy if exists "settings_public_read" on public.organization_settings;
drop policy if exists "domains_public_read" on public.organization_domains;

-- Süper admin tüm ofislerin ayarlarını ve alan adlarını okuyabilir (platform yönetimi)
drop policy if exists "settings_platform_read" on public.organization_settings;
create policy "settings_platform_read" on public.organization_settings for select to authenticated
  using ((select public.is_super_admin()));
drop policy if exists "domains_platform_read" on public.organization_domains;
create policy "domains_platform_read" on public.organization_domains for select to authenticated
  using ((select public.is_super_admin()));

-- API şema önbelleğini yenile (yeni fonksiyonlar hemen görünsün)
notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (yalnızca gerekirse; SQL Editor'de ayrı sorgu olarak):
--
--   create policy "organizations_public_read" on public.organizations for select
--     using (status = 'active');
--   create policy "settings_public_read" on public.organization_settings for select
--     using (organization_id in (select public.active_org_ids()));
--   create policy "domains_public_read" on public.organization_domains for select
--     using (verified_at is not null and organization_id in (select public.active_org_ids()));
--   drop policy if exists "settings_platform_read" on public.organization_settings;
--   drop policy if exists "domains_platform_read" on public.organization_domains;
--   -- Fonksiyonlar zararsızdır, kalabilir; kaldırmak için:
--   -- drop function if exists public.public_tenant(text, text);
--   -- drop function if exists public.public_tenant_settings(uuid);
--   -- drop function if exists public.public_tenant_domains(uuid);
--   notify pgrst, 'reload schema';
--
-- Uygulama kodu her iki durumda da çalışır (fonksiyon yoksa eski okumaya döner).
-- =============================================================================
