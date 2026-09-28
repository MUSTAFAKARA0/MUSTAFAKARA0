-- =============================================================================
-- DEMO GÜNCELLEME 6 — kurulum sonrası eklenen migration'lar
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
-- Otomatik üretildi (npm run demo:sql) — elle düzenlemeyin; kaynak: supabase/migrations
-- Kurulu demo projesinde (01–05 bitmiş) SQL Editor > New query > yapıştır > Run. Tekrar çalıştırılabilir.
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
-- 20260929000001_platform_owner_isolation.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 20260930000001_session_context_and_indexes.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Performans: oturum bağlamı tek sorguda + eksik indeksler
--
-- Ölçülen sorun: her panel sayfası, asıl veriden önce oturum/ofis bilgisini
-- 4–5 ARDIŞIK sorguyla alıyordu (profil → üyelikler → ofis + yetkiler + plan →
-- marka ayarları). Supabase ile uygulama arasındaki her gidiş-dönüş bu süreye
-- eklendiği için sayfa geçişleri gecikiyordu.
--
-- session_context(): aynı bilgileri TEK çağrıda döndürür.
--   • SECURITY INVOKER: çağıranın kendi yetkileriyle (RLS) çalışır; öncekiyle aynı
--     satırları görür, fazlasını görmez. Yalnızca çağıranın (auth.uid()) verisi döner.
--   • Aktif ofis seçimi öncekiyle aynı kurala göre yapılır: tercih edilen ofis
--     (çerez) → bulunulan alan adının ofisi → ilk aktif üyelik; üyelik yoksa seçilmez.
--
-- Ayrıca yabancı anahtar / sık süzülen sütunlar için eksik indeksler.
-- Tekrar çalıştırılabilir; veri değiştirmez. Uygulama bu fonksiyon yoksa eski
-- (ardışık) sorgulara döner — migration öncesi ve sonrası çalışır.
-- Geri dönüş: dosyanın sonunda.
-- =============================================================================

create or replace function public.session_context(p_preferred_org uuid default null, p_host_key text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_members jsonb;
  v_host uuid;
  v_org uuid;
  v_role public.org_role;
begin
  if v_uid is null then
    return null;
  end if;

  select jsonb_build_object('full_name', p.full_name, 'is_super_admin', p.is_super_admin, 'password_change_required', p.password_change_required)
    into v_profile
    from public.profiles p
   where p.id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'org_id', o.id, 'slug', o.slug, 'name', o.name, 'status', o.status,
           'role', m.role, 'require_admin_mfa', o.require_admin_mfa) order by m.created_at, o.name), '[]'::jsonb)
    into v_members
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = v_uid and m.status = 'active';

  -- Bulunulan alan adının / adresin ofisi (yalnızca üyesi olduğu ofislerde anlamlı)
  if p_host_key is not null then
    select o.id into v_host
      from public.organizations o
     where o.slug = p_host_key
        or o.id = (select d.organization_id from public.organization_domains d where d.hostname = lower(p_host_key) limit 1)
     limit 1;
  end if;

  -- Aktif ofis: tercih → alan adı → ilk aktif üyelik (ofis durumu 'active')
  select (e->>'org_id')::uuid, (e->>'role')::public.org_role
    into v_org, v_role
    from jsonb_array_elements(v_members) with ordinality as x(e, n)
   where e->>'status' = 'active'
   order by ((e->>'org_id')::uuid = p_preferred_org) desc nulls last,
            ((e->>'org_id')::uuid = v_host) desc nulls last,
            n
   limit 1;

  return jsonb_build_object(
    'profile', v_profile,
    'memberships', v_members,
    'org', case when v_org is null then null else (
      select jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'reference_prefix', o.reference_prefix)
        from public.organizations o where o.id = v_org) end,
    'role', v_role,
    'permissions', case when v_org is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(rp.permission order by rp.permission), '[]'::jsonb)
        from public.role_permissions rp where rp.role = v_role) end,
    'plan', case when v_org is null then null else (
      select to_jsonb(pl) from public.org_plan(v_org) pl limit 1) end,
    'brand', case when v_org is null then null else (
      select jsonb_build_object('display_name', s.display_name, 'logo_url', s.logo_url, 'favicon_url', s.favicon_url,
                                'primary_color', s.primary_color, 'accent_color', s.accent_color)
        from public.organization_settings s where s.organization_id = v_org) end
  );
end;
$$;

revoke all on function public.session_context(uuid, text) from public, anon;
grant execute on function public.session_context(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Eksik indeksler (yabancı anahtarlar ve sık süzülen sütunlar)
-- -----------------------------------------------------------------------------
create index if not exists lead_activities_org_created_idx on public.lead_activities (organization_id, created_at desc);
create index if not exists property_price_history_org_idx on public.property_price_history (organization_id);
create index if not exists appointments_lead_idx on public.appointments (lead_id) where lead_id is not null;
create index if not exists appointments_property_idx on public.appointments (property_id) where property_id is not null;
create index if not exists appointments_assigned_idx on public.appointments (assigned_to) where assigned_to is not null;
create index if not exists leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;
create index if not exists collections_customer_idx on public.collections (customer_id) where customer_id is not null;
create index if not exists favorites_property_idx on public.favorites (property_id);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create index if not exists posts_cover_media_idx on public.posts (cover_media_id) where cover_media_id is not null;
create index if not exists properties_og_media_idx on public.properties (og_media_id) where og_media_id is not null;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse):
--   drop function if exists public.session_context(uuid, text);
--   -- indeksler zararsızdır; kaldırmak için: drop index if exists public.<ad>;
--   notify pgrst, 'reload schema';
-- Uygulama fonksiyon yoksa eski sorgulara döner.
-- =============================================================================

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260929000001', 'platform_owner_isolation'),
  ('20260930000001', 'session_context_and_indexes')
on conflict (version) do nothing;

-- API şema önbelleğini yenile
notify pgrst, 'reload schema';
