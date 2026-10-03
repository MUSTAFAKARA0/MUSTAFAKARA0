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

-- ---------------------------------------------------------------------------
-- 20260930000002_site_builder.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- KARAY Web Sitesi Yönetimi (Site Control Center)
--
-- Her kiracının (emlak ofisi) web sitesinin GÖRÜNÜMÜ yapılandırma olarak tutulur;
-- tema, renkler, tipografi, header, menü, ana sayfa bölümleri, footer, sayfa ve SEO
-- ayarları tek bir JSON belgesidir (şema uygulamada: src/platform/site/schema.ts).
-- İlanlar, CRM, kullanıcılar ve URL'ler bu belgeden ETKİLENMEZ (yalnızca sunum katmanı).
--
--   site_configs            kiracı başına 1 satır: taslak, yayındaki sürüm, site durumu,
--                           özellik bayrakları (feature flags)
--   site_config_revisions   her yayın bir sürüm (geri dönüş için)
--
-- Yazma: yalnızca SÜPER ADMİN (KARAY), SECURITY DEFINER fonksiyonlarla; her işlem
-- denetim kaydına (audit_logs) yazılır. Kiracı kullanıcıları kendi sitelerinin
-- kaydını OKUYABİLİR, başka kiracınınkini okuyamaz; hiçbirini değiştiremez.
-- Herkese açık site yalnızca YAYINDAKİ sürümü okur (taslak asla).
--
-- Ayrıca: organization_settings'e kısa ad / mobil logo / harita bağlantısı sütunları;
-- org_plan() kiracı bazlı özellik bayraklarını da hesaba katar.
-- Tekrar çalıştırılabilir; mevcut veriyi değiştirmez. Geri dönüş: dosyanın sonunda.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tablolar
-- -----------------------------------------------------------------------------
create table if not exists public.site_configs (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) < 262144),
  published jsonb not null default '{}'::jsonb check (jsonb_typeof(published) = 'object' and octet_length(published::text) < 262144),
  published_version integer not null default 0 check (published_version >= 0),
  has_unpublished_changes boolean not null default false,
  site_status text not null default 'active' check (site_status in ('active', 'maintenance', 'draft')),
  maintenance_message text check (char_length(maintenance_message) <= 300),
  feature_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(feature_overrides) = 'object'),
  draft_updated_at timestamptz,
  draft_updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_configs_updated_at on public.site_configs;
create trigger site_configs_updated_at before update on public.site_configs
  for each row execute function public.set_updated_at();

create table if not exists public.site_config_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null check (version > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, version)
);
create index if not exists site_config_revisions_org_idx on public.site_config_revisions (organization_id, version desc);
create index if not exists site_configs_draft_by_idx on public.site_configs (draft_updated_by) where draft_updated_by is not null;
create index if not exists site_configs_published_by_idx on public.site_configs (published_by) where published_by is not null;
create index if not exists site_config_revisions_created_by_idx on public.site_config_revisions (created_by) where created_by is not null;

-- Mevcut her kiracı için boş yapılandırma (boş = bugünkü görünüm; hiçbir şey değişmez)
insert into public.site_configs (organization_id)
select o.id from public.organizations o
on conflict (organization_id) do nothing;

-- Yeni kiracı oluşturulunca yapılandırma satırı da oluşur
create or replace function public.site_configs_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_configs (organization_id) values (new.id) on conflict (organization_id) do nothing;
  return new;
end;
$$;
drop trigger if exists organizations_site_config on public.organizations;
create trigger organizations_site_config after insert on public.organizations
  for each row execute function public.site_configs_on_org_insert();

-- -----------------------------------------------------------------------------
-- 2) RLS: kiracı yalnızca KENDİ sitesinin kaydını okur; süper admin hepsini.
--    Doğrudan yazma yok (yalnızca aşağıdaki fonksiyonlar).
-- -----------------------------------------------------------------------------
alter table public.site_configs enable row level security;
alter table public.site_config_revisions enable row level security;

drop policy if exists "site_configs_read" on public.site_configs;
create policy "site_configs_read" on public.site_configs for select to authenticated
  using (organization_id in (select public.member_org_ids()) or (select public.is_super_admin()));
drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
create policy "site_config_revisions_read" on public.site_config_revisions for select to authenticated
  using ((select public.is_super_admin()));

revoke all on public.site_configs, public.site_config_revisions from anon;
revoke insert, update, delete, truncate on public.site_configs, public.site_config_revisions from authenticated;
grant select on public.site_configs, public.site_config_revisions to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Marka sütunları (kısa ad, mobil logo, harita bağlantısı)
-- -----------------------------------------------------------------------------
alter table public.organization_settings
  add column if not exists short_name text check (char_length(short_name) <= 40),
  add column if not exists logo_mobile_url text check (char_length(logo_mobile_url) <= 500),
  add column if not exists maps_url text check (char_length(maps_url) <= 500 and maps_url ~ '^https://');

-- Süper admin (KARAY) kiracının marka/iletişim ayarlarını da düzenleyebilir
create or replace function public.organization_settings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[];
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  new.organization_id := old.organization_id;
  new.updated_by := (select auth.uid());
  v_fields := public.audit_changed_fields(to_jsonb(old), to_jsonb(new));
  if exists (
    select 1 from unnest(v_fields) f
     where f not in ('seo_title', 'seo_description', 'og_image_url', 'google_site_verification', 'updated_by')
  ) and not public.has_org_permission(new.organization_id, 'settings.manage')
    and not public.is_super_admin() then
    raise exception 'settings_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Özellik bayrakları plan hesabına dahil (kiracı bazlı AÇ/KAPA, plandan önceliklidir)
--    Anahtarlar: crm, analytics, pdf, custom_domain (panel) — diğerleri site tarafında.
-- -----------------------------------------------------------------------------
create or replace function public.org_plan(p_org uuid)
returns table (
  plan_id text,
  subscription_status public.subscription_status,
  max_users integer,
  max_properties integer,
  max_storage_mb integer,
  crm_enabled boolean,
  analytics_enabled boolean,
  pdf_enabled boolean,
  custom_domain_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, s.status, p.max_users, p.max_properties, p.max_storage_mb,
         coalesce((f.feature_overrides->>'crm')::boolean, p.crm_enabled),
         coalesce((f.feature_overrides->>'analytics')::boolean, p.analytics_enabled),
         coalesce((f.feature_overrides->>'pdf')::boolean, p.pdf_enabled),
         coalesce((f.feature_overrides->>'custom_domain')::boolean, p.custom_domain_enabled)
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    left join public.site_configs f on f.organization_id = s.organization_id
   where s.organization_id = p_org
     and s.status in ('trialing', 'active', 'past_due')
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 5) Herkese açık okuma: yalnızca YAYINDAKİ sürüm + durum + site bayrakları (aktif kiracı)
-- -----------------------------------------------------------------------------
create or replace function public.public_site_config(p_org uuid)
returns table (published jsonb, published_version integer, site_status text, maintenance_message text, feature_overrides jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.published, c.published_version, c.site_status, c.maintenance_message, c.feature_overrides
    from public.site_configs c
    join public.organizations o on o.id = c.organization_id and o.status = 'active'
   where c.organization_id = p_org;
$$;

-- -----------------------------------------------------------------------------
-- 6) Yönetim fonksiyonları (yalnızca süper admin; her biri denetim kaydı yazar)
-- -----------------------------------------------------------------------------

-- Web siteleri listesi (tüm kiracılar)
create or replace function public.platform_sites()
returns table (
  organization_id uuid, slug text, name text, org_status public.org_status, is_default boolean,
  site_status text, published_version integer, has_unpublished_changes boolean,
  published_at timestamptz, draft_updated_at timestamptz, theme text, primary_domain text, logo_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select o.id, o.slug, o.name, o.status, o.is_default,
           coalesce(c.site_status, 'active'), coalesce(c.published_version, 0), coalesce(c.has_unpublished_changes, false),
           c.published_at, c.draft_updated_at,
           coalesce(c.published->>'theme', 'klasik'),
           (select d.hostname from public.organization_domains d where d.organization_id = o.id and d.is_primary limit 1),
           s.logo_url
      from public.organizations o
      left join public.site_configs c on c.organization_id = o.id
      left join public.organization_settings s on s.organization_id = o.id
     order by o.is_default desc, o.name;
end;
$$;

-- Taslağın bir bölümünü kaydeder (ör. 'theme', 'colors', 'navigation'); tüm belgeyi değil
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  perform public.assert_super_admin();
  -- Yalnızca bilinen bölümler (uygulamadaki SECTION_SCHEMAS ile aynı liste)
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section into v_old from public.site_configs c where c.organization_id = p_org for update;
  update public.site_configs
     set draft = jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true),
         has_unpublished_changes = true,
         draft_updated_at = now(),
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end));
end;
$$;

-- Taslağı yayınlar: yeni sürüm oluşturur
create or replace function public.site_publish(p_org uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
begin
  perform public.assert_super_admin();
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_row.draft, left(nullif(trim(p_note), ''), 200), (select auth.uid()));
  update public.site_configs
     set published = v_row.draft, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.published', 'site', p_org::text, 'Sürüm ' || v_version,
    jsonb_build_object('version', v_version, 'note', left(p_note, 200),
                       'old_theme', v_row.published->>'theme', 'new_theme', v_row.draft->>'theme'));
  return v_version;
end;
$$;

-- Önceki bir sürüme geri döner (yeni sürüm olarak yayınlanır; geçmiş silinmez)
create or replace function public.site_rollback(p_org uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config jsonb;
  v_row public.site_configs;
  v_version integer;
begin
  perform public.assert_super_admin();
  select r.config into v_config from public.site_config_revisions r where r.organization_id = p_org and r.version = p_version;
  if v_config is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config, 'Sürüm ' || p_version || ' geri yüklendi', (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid()), draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.rolled_back', 'site', p_org::text, 'Sürüm ' || p_version,
    jsonb_build_object('restored_version', p_version, 'new_version', v_version));
  return v_version;
end;
$$;

-- Yayınlanmamış taslak değişikliklerini atar
create or replace function public.site_discard_draft(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.site_configs
     set draft = published, has_unpublished_changes = false, draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_discarded', 'site', p_org::text, null, '{}'::jsonb);
end;
$$;

-- Site durumu: active | maintenance | draft (panel etkilenmez)
create or replace function public.site_set_status(p_org uuid, p_status text, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.assert_super_admin();
  if p_status not in ('active', 'maintenance', 'draft') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select c.site_status into v_old from public.site_configs c where c.organization_id = p_org;
  update public.site_configs
     set site_status = p_status, maintenance_message = left(nullif(trim(p_message), ''), 300)
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.status_changed', 'site', p_org::text, p_status,
    jsonb_build_object('old', v_old, 'new', p_status));
end;
$$;

-- Özellik bayrakları (anında geçerli). null değer = plan varsayılanına dön
create or replace function public.site_set_features(p_org uuid, p_overrides jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_clean jsonb;
begin
  perform public.assert_super_admin();
  if jsonb_typeof(p_overrides) <> 'object' then
    raise exception 'invalid_features' using errcode = '22023';
  end if;
  -- Yalnızca bilinen anahtarlar ve boolean değerler
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean
    from jsonb_each(p_overrides) as e(k, v)
   where k in ('crm', 'analytics', 'pdf', 'custom_domain', 'blog', 'valuation', 'whatsapp', 'favorites', 'advanced_seo', 'dark_mode')
     and jsonb_typeof(v) = 'boolean';
  select c.feature_overrides into v_old from public.site_configs c where c.organization_id = p_org;
  update public.site_configs set feature_overrides = v_clean where organization_id = p_org;
  perform public.write_audit(p_org, 'site.features_changed', 'site', p_org::text, null,
    jsonb_build_object('old', v_old, 'new', v_clean));
end;
$$;

revoke all on function public.public_site_config(uuid) from public;
grant execute on function public.public_site_config(uuid) to anon, authenticated, service_role;
revoke all on function public.platform_sites() from public, anon;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
revoke all on function public.site_discard_draft(uuid) from public, anon;
revoke all on function public.site_set_status(uuid, text, text) from public, anon;
revoke all on function public.site_set_features(uuid, jsonb) from public, anon;
revoke all on function public.site_configs_on_org_insert() from public, anon, authenticated;
grant execute on function public.platform_sites() to authenticated;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;
grant execute on function public.site_discard_draft(uuid) to authenticated;
grant execute on function public.site_set_status(uuid, text, text) to authenticated;
grant execute on function public.site_set_features(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse; site görünümü varsayılana döner, başka veri etkilenmez):
--   -- ÖNCE org_plan ve organization_settings_guard'ı önceki tanımlarına döndürün
--   -- (20260926000002_v2_tenancy.sql › org_plan, 20260930000002 öncesi guard:
--   --  20260926000007_v2_security.sql); org_plan site_configs tablosunu okur.
--   drop trigger if exists organizations_site_config on public.organizations;
--   drop function if exists public.site_configs_on_org_insert();
--   drop function if exists public.public_site_config(uuid), public.platform_sites(),
--     public.site_save_draft(uuid, text, jsonb), public.site_publish(uuid, text),
--     public.site_rollback(uuid, integer), public.site_discard_draft(uuid),
--     public.site_set_status(uuid, text, text), public.site_set_features(uuid, jsonb);
--   drop table if exists public.site_config_revisions;
--   drop table if exists public.site_configs;
--   -- Eklenen sütunlar (short_name, logo_mobile_url, maps_url) boş kalabilir.
--   notify pgrst, 'reload schema';
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 20261001000001_site_brand_publish.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- KARAY Web Sitesi Yönetimi — marka da taslak → önizleme → yayın → geri alma akışında
--
-- Önceden KARAY › Marka sekmesindeki logo / ad / iletişim / renk değişiklikleri
-- organization_settings'e anında yazılıyordu. Artık:
--   * Taslak: site_configs.draft.brand (yalnızca DEĞİŞEN alanlar; canlı site değişmez)
--   * Önizleme: taslak marka yalnızca imzalı önizlemede üste bindirilir
--   * Yayın: bekleyen marka alanları organization_settings'e uygulanır; sürüm kaydına
--     markanın TAM anlık görüntüsü yazılır (geri alma için)
--   * Geri alma: sürümdeki marka anlık görüntüsü organization_settings'e geri uygulanır
--
-- Herkese açık site marka bilgisini bugünkü gibi organization_settings'ten (önbellekli)
-- okur: ziyaretçi başına ek sorgu yoktur. Ofisin kendi panelinden (Şirket Ayarları)
-- yaptığı düzenlemeler bugünkü gibi anında geçerlidir.
--
-- Tekrar çalıştırılabilir; veri silmez; tablo yapısı değişmez (yalnızca fonksiyonlar).
-- Geri dönüş: dosya sonunda.
-- =============================================================================

-- Taslakta tutulabilen marka alanları (organization_settings sütunları; beyaz liste)
create or replace function public.site_brand_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'display_name', 'short_name', 'legal_name', 'tagline', 'description',
    'phone', 'whatsapp', 'email', 'address_line', 'address_district', 'address_city', 'maps_url',
    'instagram_url', 'facebook_url', 'x_url', 'youtube_url', 'linkedin_url', 'tiktok_url',
    'logo_url', 'logo_mobile_url', 'favicon_url', 'og_image_url', 'hero_image_url',
    'primary_color', 'accent_color'
  ]::text[];
$$;

-- Ofisin güncel marka anlık görüntüsü (sürüm kaydı için)
create or replace function public.site_brand_snapshot(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(s) -> k), '{}'::jsonb)
    from public.organization_settings s, unnest(public.site_brand_columns()) k
   where s.organization_id = p_org;
$$;

-- Marka alanlarını organization_settings'e uygular (yalnızca beyaz listedeki sütunlar)
create or replace function public.site_apply_brand(p_org uuid, p_brand jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if p_brand is null or jsonb_typeof(p_brand) <> 'object' then
    return;
  end if;
  foreach k in array public.site_brand_columns() loop
    if p_brand ? k then
      -- Firma adı ve renkler boşaltılamaz (NOT NULL); boş gelirse mevcut değer korunur
      if k in ('display_name', 'primary_color', 'accent_color') and nullif(p_brand ->> k, '') is null then
        continue;
      end if;
      execute format('update public.organization_settings set %I = $1 where organization_id = $2', k)
        using nullif(p_brand ->> k, ''), p_org;
    end if;
  end loop;
end;
$$;

-- Taslak bölümü kaydeder (beyaz liste: brand ve style eklendi)
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  perform public.assert_super_admin();
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section into v_old from public.site_configs c where c.organization_id = p_org for update;
  update public.site_configs
     set draft = case when p_section = 'brand' and p_value = '{}'::jsonb then draft - 'brand'
                      else jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true) end,
         has_unpublished_changes = true,
         draft_updated_at = now(),
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end,
                       'fields', case when p_section = 'brand' then (select jsonb_agg(k) from jsonb_object_keys(p_value) k) else null end));
end;
$$;

-- Taslağı yayınlar: bekleyen marka uygulanır, yeni sürüm (marka anlık görüntüsüyle) oluşur
create or replace function public.site_publish(p_org uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
  v_config jsonb;
begin
  perform public.assert_super_admin();
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.site_apply_brand(p_org, v_row.draft -> 'brand');
  v_config := v_row.draft - 'brand';
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          left(nullif(trim(p_note), ''), 200), (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.published', 'site', p_org::text, 'Sürüm ' || v_version,
    jsonb_build_object('version', v_version, 'note', left(p_note, 200),
                       'old_theme', v_row.published->>'theme', 'new_theme', v_row.draft->>'theme',
                       'brand_fields', (select jsonb_agg(k) from jsonb_object_keys(coalesce(v_row.draft -> 'brand', '{}'::jsonb)) k)));
  return v_version;
end;
$$;

-- Önceki sürüme döner (marka anlık görüntüsü varsa o da geri yüklenir)
create or replace function public.site_rollback(p_org uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config jsonb;
  v_row public.site_configs;
  v_version integer;
begin
  perform public.assert_super_admin();
  select r.config into v_config from public.site_config_revisions r where r.organization_id = p_org and r.version = p_version;
  if v_config is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  -- Eski sürümlerde (bu dosyadan önce) marka anlık görüntüsü yoktur: marka olduğu gibi kalır
  perform public.site_apply_brand(p_org, v_config -> 'brand');
  v_config := v_config - 'brand';
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          'Sürüm ' || p_version || ' geri yüklendi', (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid()), draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.rolled_back', 'site', p_org::text, 'Sürüm ' || p_version,
    jsonb_build_object('restored_version', p_version, 'new_version', v_version));
  return v_version;
end;
$$;

-- Yardımcı fonksiyonlar yalnızca yukarıdaki süper admin fonksiyonlarının içinden kullanılır
revoke all on function public.site_brand_columns() from public, anon;
revoke all on function public.site_brand_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.site_apply_brand(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.site_brand_columns() to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse): site_save_draft, site_publish, site_rollback fonksiyonlarını
-- 20260930000002_site_builder.sql içindeki tanımlarıyla yeniden oluşturun, ardından:
--   drop function if exists public.site_apply_brand(uuid, jsonb), public.site_brand_snapshot(uuid),
--     public.site_brand_columns();
--   update public.site_configs set draft = draft - 'brand';   -- bekleyen marka taslağı atılır
--   notify pgrst, 'reload schema';
-- Veri kaybı yoktur: yayınlanmış marka zaten organization_settings'tedir.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 20261002000001_karay_platform.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- KARAY platform sahibi: kurumsal ayarlar + KARAY talepleri (potansiyel müşteri)
--
-- 1) platform_settings (tek satır): KARAY'ın herkese açık şirket/ürün sayfasında
--    (/karay) gösterilen iletişim bilgileri, sosyal hesaplar, SEO ve talep bildirim
--    adresleri. Varsayılanlar BOŞTUR (uydurma iletişim bilgisi yok); süper admin
--    Platform › KARAY ayarları ekranından doldurur.
-- 2) platform_leads: KARAY sayfasındaki "Bilgi al / Demo talep et" formu. Kiracı
--    talepleri (public.leads, organization_id zorunlu) ile HİÇBİR ortak tablo veya
--    fonksiyon paylaşmaz: KARAY'a gelen emlakçı adayı bir ofisin CRM'ine, bir ofisin
--    müşterisi KARAY'a düşmez.
--
-- Güvenlik: iki tabloda da RLS açık. Okuma/güncelleme yalnızca süper admin; tabloya
-- doğrudan ekleme yok. Talep yalnızca submit_platform_lead() ile eklenir (doğrulama +
-- IP özetine göre hız sınırı + genel taşma sınırı). Herkese açık sayfa yalnızca
-- public_platform_profile() ile gösterilebilir alanları okur (bildirim adresleri hariç).
--
-- Tekrar çalıştırılabilir; mevcut veriyi değiştirmez. Geri dönüş: dosya sonunda.
-- =============================================================================

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'KARAY' check (char_length(company_name) between 2 and 80),
  tagline text check (char_length(tagline) <= 160),
  contact_email text check (contact_email is null or (char_length(contact_email) <= 160 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  contact_phone text check (char_length(contact_phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  address text check (char_length(address) <= 240),
  city text check (char_length(city) <= 80),
  website_url text check (website_url is null or (char_length(website_url) <= 300 and website_url ~ '^https://')),
  linkedin_url text check (linkedin_url is null or (char_length(linkedin_url) <= 300 and linkedin_url ~ '^https://')),
  instagram_url text check (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~ '^https://')),
  x_url text check (x_url is null or (char_length(x_url) <= 300 and x_url ~ '^https://')),
  youtube_url text check (youtube_url is null or (char_length(youtube_url) <= 300 and youtube_url ~ '^https://')),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  indexable boolean not null default true,
  lead_notify_emails text[] not null default '{}' check (cardinality(lead_notify_emails) <= 5),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_admin_read on public.platform_settings;
create policy platform_settings_admin_read on public.platform_settings
  for select to authenticated using ((select public.is_super_admin()));

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings
  for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);

-- Herkese açık KARAY sayfası için gösterilebilir alanlar (bildirim adresleri HARİÇ)
create or replace function public.public_platform_profile()
returns table (
  company_name text, tagline text, contact_email text, contact_phone text, whatsapp text,
  address text, city text, website_url text, linkedin_url text, instagram_url text, x_url text,
  youtube_url text, seo_title text, seo_description text, indexable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.company_name, s.tagline, s.contact_email, s.contact_phone, s.whatsapp, s.address, s.city,
         s.website_url, s.linkedin_url, s.instagram_url, s.x_url, s.youtube_url, s.seo_title,
         s.seo_description, s.indexable
    from public.platform_settings s
   where s.id;
$$;

-- -----------------------------------------------------------------------------
-- KARAY talepleri
-- -----------------------------------------------------------------------------
create table if not exists public.platform_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'info' check (kind in ('info', 'demo')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text check (email is null or (char_length(email) <= 160 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  phone text check (char_length(phone) <= 30),
  company text check (char_length(company) <= 160),
  city text check (char_length(city) <= 80),
  message text check (char_length(message) <= 3000),
  kvkk_consent boolean not null check (kvkk_consent),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  note text check (char_length(note) <= 2000),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  ip_hash text check (char_length(ip_hash) <= 64),
  user_agent text check (char_length(user_agent) <= 400),
  constraint platform_leads_contact_check check (email is not null or phone is not null)
);

create index if not exists platform_leads_created_idx on public.platform_leads (created_at desc);
create index if not exists platform_leads_status_idx on public.platform_leads (status, created_at desc);
create index if not exists platform_leads_ip_idx on public.platform_leads (ip_hash, created_at desc);
create index if not exists platform_leads_handled_by_idx on public.platform_leads (handled_by);

alter table public.platform_leads enable row level security;

drop policy if exists platform_leads_admin_read on public.platform_leads;
create policy platform_leads_admin_read on public.platform_leads
  for select to authenticated using ((select public.is_super_admin()));

drop policy if exists platform_leads_admin_update on public.platform_leads;
create policy platform_leads_admin_update on public.platform_leads
  for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- Talep ekleme: yalnızca bu fonksiyonla (doğrudan INSERT politikası yok)
create or replace function public.submit_platform_lead(
  p_kind text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_city text,
  p_message text,
  p_kvkk_consent boolean,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_kvkk_consent, false) is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if nullif(btrim(p_email), '') is null and nullif(btrim(p_phone), '') is null then
    raise exception 'contact_required' using errcode = '22023';
  end if;
  -- Hız sınırı: aynı IP özeti 10 dakikada 3, 24 saatte 10 talep; genel taşma: saatte 300
  if nullif(btrim(p_ip_hash), '') is null then
    raise exception 'ip_required' using errcode = '22023';
  end if;
  if (
       (select count(*) from public.platform_leads where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3
    or (select count(*) from public.platform_leads where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 10) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.platform_leads where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.platform_leads (kind, full_name, email, phone, company, city, message, kvkk_consent, ip_hash, user_agent)
  values (case when p_kind = 'demo' then 'demo' else 'info' end,
          btrim(p_full_name), lower(nullif(btrim(p_email), '')), nullif(btrim(p_phone), ''),
          nullif(btrim(p_company), ''), nullif(btrim(p_city), ''), nullif(btrim(p_message), ''),
          true, left(p_ip_hash, 64), left(p_user_agent, 400))
  returning id into v_id;
  return v_id;
end;
$$;

-- Süper admin: talep durumu / notu (denetim kaydına platform düzeyinde yazılır)
create or replace function public.platform_update_lead(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.assert_super_admin();
  if p_status not in ('new', 'contacted', 'qualified', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select status into v_old from public.platform_leads where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.platform_leads
     set status = p_status, note = left(nullif(btrim(p_note), ''), 2000),
         handled_by = (select auth.uid()), handled_at = now()
   where id = p_id;
  perform public.write_audit(null, 'platform.lead_updated', 'platform_lead', p_id::text, p_status,
    jsonb_build_object('old_status', v_old, 'new_status', p_status));
end;
$$;

revoke all on function public.public_platform_profile() from public;
grant execute on function public.public_platform_profile() to anon, authenticated, service_role;
revoke all on function public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text) from public;
revoke all on function public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text) from anon, authenticated;
-- Yalnızca sunucu (KARAY formu sunucu eylemi): gizli alan, süre ve doğrulama kontrolleri
-- herkese açık anahtarla doğrudan çağrılarak atlanamaz
grant execute on function public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text) to service_role;
revoke all on function public.platform_update_lead(uuid, text, text) from public, anon;
grant execute on function public.platform_update_lead(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse; KARAY sayfası kod tarafında varsayılanlarla çalışmaya devam eder):
--   drop function if exists public.platform_update_lead(uuid, text, text),
--     public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text),
--     public.public_platform_profile();
--   drop table if exists public.platform_leads;      -- DİKKAT: KARAY talepleri silinir (önce yedek alın)
--   drop table if exists public.platform_settings;
--   notify pgrst, 'reload schema';
-- =============================================================================

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260929000001', 'platform_owner_isolation'),
  ('20260930000001', 'session_context_and_indexes'),
  ('20260930000002', 'site_builder'),
  ('20261001000001', 'site_brand_publish'),
  ('20261002000001', 'karay_platform')
on conflict (version) do nothing;

-- API şema önbelleğini yenile
notify pgrst, 'reload schema';
