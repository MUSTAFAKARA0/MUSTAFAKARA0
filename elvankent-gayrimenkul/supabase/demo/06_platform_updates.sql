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

-- ---------------------------------------------------------------------------
-- 20261004000001_design_family_access.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Aşama D5 — Tasarım ailesi yetkileri (KARAY Site Factory)
--
--   1) design_family_settings        : KARAY'ın aileyi GLOBAL açıp kapatması (satır yok = açık)
--   2) organization_design_families  : KARAY'ın bir kiracıya izin verdiği aileler
--   3) org_design_family_access()     : kiracının seçebileceği aileler (izinli ∩ global açık)
--   4) platform_set_design_family()  / platform_set_org_design_families() : yalnızca süper admin
--   5) site_apply_design()            : ofis yöneticisi (settings.manage) kendi sitesinin tasarımını
--                                        İZİNLİ bir aileyle değiştirir; yetki VERİTABANINDA doğrulanır
--
-- EK (additive) migration: mevcut tablo/fonksiyon değiştirilmez veya silinmez, veri silinmez.
-- Katalog (aile tanımları) kodda kalır; burada yalnızca kimlikler (ör. 'sinematik-vitrin') tutulur.
-- Kiracı sitesi bu tabloları OKUMAZ: yayındaki site yalnızca kendi manifestini (site_configs) çizer.
--
-- Geri alma (veri kaybı yoktur; yalnızca izin kayıtları kaybolur, siteler etkilenmez):
--   drop function if exists public.site_apply_design(uuid, text, jsonb),
--     public.platform_set_org_design_families(uuid, text[]), public.platform_set_design_family(text, boolean),
--     public.org_design_family_access(uuid);
--   drop table if exists public.organization_design_families, public.design_family_settings;
-- =============================================================================

create table if not exists public.design_family_settings (
  family_id text primary key check (family_id ~ '^[a-z0-9-]{1,40}$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.organization_design_families (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  family_id text not null check (family_id ~ '^[a-z0-9-]{1,40}$'),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (organization_id, family_id)
);
create index if not exists organization_design_families_granted_by_idx on public.organization_design_families (granted_by) where granted_by is not null;
create index if not exists design_family_settings_updated_by_idx on public.design_family_settings (updated_by) where updated_by is not null;

-- RLS: okuma — global ayarlar oturumlu kullanıcılara (yalnızca kimlik + açık/kapalı), kiracı izinleri
-- yalnızca o kiracının üyelerine ve süper admine. Doğrudan yazma YOK (yalnızca aşağıdaki fonksiyonlar).
alter table public.design_family_settings enable row level security;
alter table public.organization_design_families enable row level security;

drop policy if exists "design_family_settings_read" on public.design_family_settings;
create policy "design_family_settings_read" on public.design_family_settings for select to authenticated using (true);

drop policy if exists "organization_design_families_read" on public.organization_design_families;
create policy "organization_design_families_read" on public.organization_design_families for select to authenticated
  using (organization_id in (select public.member_org_ids()) or (select public.is_super_admin()));

revoke all on public.design_family_settings, public.organization_design_families from anon;
revoke insert, update, delete on public.design_family_settings, public.organization_design_families from authenticated;
grant select on public.design_family_settings, public.organization_design_families to authenticated;
grant all on public.design_family_settings, public.organization_design_families to service_role;

-- Kiracının seçebileceği aileler: KARAY'ın izin verdiği VE global olarak kapatılmamış olanlar
create or replace function public.org_design_family_access(p_org uuid)
returns table (family_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.family_id
    from public.organization_design_families g
    left join public.design_family_settings s on s.family_id = g.family_id
   where g.organization_id = p_org
     and coalesce(s.enabled, true)
     and (p_org in (select public.member_org_ids()) or (select public.is_super_admin()))
   order by g.family_id;
$$;

-- KARAY: aileyi global aç / kapat (kapatılan aile hiçbir kiracıya yeni seçenek olarak görünmez;
-- onu kullanan mevcut sitelerin yayındaki görünümü DEĞİŞMEZ)
create or replace function public.platform_set_design_family(p_family text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if p_family is null or p_family !~ '^[a-z0-9-]{1,40}$' or p_enabled is null then
    raise exception 'invalid_family' using errcode = '22023';
  end if;
  insert into public.design_family_settings (family_id, enabled, updated_at, updated_by)
  values (p_family, p_enabled, now(), (select auth.uid()))
  on conflict (family_id) do update set enabled = excluded.enabled, updated_at = now(), updated_by = (select auth.uid());
  perform public.write_audit(null, 'design_family.toggled', 'design_family', p_family, p_family,
    jsonb_build_object('enabled', p_enabled));
end;
$$;

-- KARAY: kiracının izinli aile listesini belirler (liste tamamen değiştirilir)
create or replace function public.platform_set_org_design_families(p_org uuid, p_families text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text[];
  v_new text[];
begin
  perform public.assert_super_admin();
  if p_org is null or not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(distinct f order by f), '{}') into v_new from unnest(coalesce(p_families, '{}')) f;
  if exists (select 1 from unnest(v_new) f where f !~ '^[a-z0-9-]{1,40}$') or cardinality(v_new) > 50 then
    raise exception 'invalid_family' using errcode = '22023';
  end if;
  select coalesce(array_agg(family_id order by family_id), '{}') into v_old from public.organization_design_families where organization_id = p_org;
  delete from public.organization_design_families where organization_id = p_org and family_id <> all (v_new);
  insert into public.organization_design_families (organization_id, family_id, granted_by)
  select p_org, f, (select auth.uid()) from unnest(v_new) f
  on conflict (organization_id, family_id) do nothing;
  if v_old is distinct from v_new then
    perform public.write_audit(p_org, 'site.design_families_changed', 'site', p_org::text, null,
      jsonb_build_object('old', v_old, 'new', v_new));
  end if;
end;
$$;

-- OFİS YÖNETİCİSİ: izinli bir aileyle kendi sitesinin tasarımını değiştirir ve yayınlar.
-- Yalnızca tasarım bölümleri (tema, renk, tipografi, yapısal parçalar, ana sayfa) yazılır; marka,
-- menü, sayfalar, SEO ve KARAY'ın yayınlanmamış taslak değişiklikleri YAYINLANMAZ (taslağın diğer
-- bölümleri olduğu gibi kalır). Bölümlerin içeriği uygulama sunucusunda katalogdan derlenir ve
-- şemayla doğrulanır; okuma tarafı (parseSiteConfig) ayrıca kapalı şemayla temizler.
create or replace function public.site_apply_design(p_org uuid, p_family text, p_sections jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
  v_published jsonb;
  v_draft jsonb;
begin
  if (select auth.uid()) is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_family is null or not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = p_family) then
    raise exception 'family_not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_sections) k where k <> all (array['theme', 'colors', 'typography', 'style', 'home']))
     or not (p_sections ?& array['theme', 'colors', 'typography', 'style', 'home'])
     or jsonb_typeof(p_sections -> 'style') <> 'object'
     or (p_sections -> 'style' -> 'origin' ->> 'family') is distinct from p_family
     or pg_column_size(p_sections) > 65536 then
    raise exception 'invalid_design' using errcode = '22023';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_published := coalesce(v_row.published, '{}'::jsonb) || p_sections;
  v_draft := coalesce(v_row.draft, '{}'::jsonb) || p_sections;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_published || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          'Tasarım değişikliği (ofis): ' || p_family, (select auth.uid()));
  update public.site_configs
     set published = v_published, draft = v_draft, published_version = v_version,
         has_unpublished_changes = (v_draft is distinct from v_published),
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.design_applied', 'site', p_org::text, p_family,
    jsonb_build_object('version', v_version, 'family', p_family, 'old_family', v_row.published -> 'style' -> 'origin' ->> 'family'));
  return v_version;
end;
$$;

revoke all on function public.org_design_family_access(uuid) from public, anon;
revoke all on function public.platform_set_design_family(text, boolean) from public, anon;
revoke all on function public.platform_set_org_design_families(uuid, text[]) from public, anon;
revoke all on function public.site_apply_design(uuid, text, jsonb) from public, anon;
grant execute on function public.org_design_family_access(uuid) to authenticated, service_role;
grant execute on function public.platform_set_design_family(text, boolean) to authenticated;
grant execute on function public.platform_set_org_design_families(uuid, text[]) to authenticated;
grant execute on function public.site_apply_design(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261005000001_office_site_management.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- P0.1 — Ofis site yönetimi (/admin/site): mevcut taslak/yayın akışını ofise açar
--
-- NEDEN: site_save_draft, site_publish, site_rollback ve site_discard_draft yalnızca süper
-- admine (assert_super_admin) açıktı; ofis yöneticisi kendi sitesini taslak → önizleme → yayın
-- akışıyla yönetemiyordu. YENİ bir taslak/yayın sistemi yazılmaz: aynı fonksiyonların yetki
-- kontrolü genişletilir, gövdeleri AYNEN korunur (20261001000001 ve 20260930000002 ile aynı).
--
--   1) assert_site_editor(p_org) : süper admin VEYA (oturum + o organizasyonda settings.manage)
--   2) site_save_draft / site_publish / site_rollback / site_discard_draft : assert_site_editor
--   3) site_save_draft : süper admin olmayan çağıran 'style' bölümünde tasarım ailesini yalnızca
--      KARAY'ın izin verdiği (org_design_family_access) bir aileye değiştirebilir
--   4) site_config_revisions : ofiste settings.manage yetkisi olan kendi sürümlerini okuyabilir
--
-- DEĞİŞMEYENLER (yalnızca KARAY / süper admin): site_set_status, site_set_features, platform_*
-- fonksiyonları, aile izin tabloları, planlar. site_apply_design olduğu gibi kalır (silinmez).
-- Yeni tablo yok, veri değişmez/silinmez. organization_id her fonksiyonda parametre olarak gelir
-- ve has_org_permission ile OTURUMUN üyeliğine karşı doğrulanır (istemciye güvenilmez).
--
-- Geri alma (veri kaybı yoktur):
--   1) 20261001000001_site_brand_publish.sql içindeki site_save_draft, site_publish, site_rollback
--      tanımlarını ve 20260930000002_site_builder.sql içindeki site_discard_draft tanımını yeniden
--      çalıştırın (perform public.assert_super_admin()).
--   2) drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
--      create policy "site_config_revisions_read" on public.site_config_revisions for select
--        to authenticated using ((select public.is_super_admin()));
--   3) drop function if exists public.assert_site_editor(uuid);
-- =============================================================================

-- Site düzenleme yetkisi: KARAY süper admini veya o ofiste "Şirket ve site ayarları" yetkisi
create or replace function public.assert_site_editor(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_super_admin() then
    return;
  end if;
  if (select auth.uid()) is null or p_org is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Taslak bölümü kaydeder (gövde 20261001000001 ile aynı; yetki + ofis için aile izni)
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_family text;
begin
  perform public.assert_site_editor(p_org);
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  -- Ofis: tasarım ailesi yalnızca izinli (ve global açık) bir aileye değiştirilebilir. Sitenin
  -- mevcut ailesi (KARAY'ın atadığı) korunarak diğer görünüm ayarları kaydedilebilir.
  if p_section = 'style' and not public.is_super_admin() then
    v_family := p_value -> 'origin' ->> 'family';
    if v_family is not null
       and v_family is distinct from (select c.draft -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and v_family is distinct from (select c.published -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = v_family) then
      raise exception 'family_not_allowed' using errcode = '42501';
    end if;
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

-- Taslağı yayınlar (gövde 20261001000001 ile aynı)
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
  perform public.assert_site_editor(p_org);
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

-- Önceki sürüme döner (gövde 20261001000001 ile aynı)
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
  perform public.assert_site_editor(p_org);
  select r.config into v_config from public.site_config_revisions r where r.organization_id = p_org and r.version = p_version;
  if v_config is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
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

-- Taslağı canlı sürüme döndürür (gövde 20260930000002 ile aynı)
create or replace function public.site_discard_draft(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_editor(p_org);
  update public.site_configs
     set draft = published, has_unpublished_changes = false, draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_discarded', 'site', p_org::text, null, '{}'::jsonb);
end;
$$;

-- Sürüm geçmişi: süper admin veya o ofiste settings.manage (başka kiracının sürümleri görünmez)
drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
create policy "site_config_revisions_read" on public.site_config_revisions for select to authenticated
  using ((select public.is_super_admin()) or public.has_org_permission(organization_id, 'settings.manage'));

revoke all on function public.assert_site_editor(uuid) from public, anon;
grant execute on function public.assert_site_editor(uuid) to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
revoke all on function public.site_discard_draft(uuid) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;
grant execute on function public.site_discard_draft(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261006000001_brand_content_draft.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- P0.2 — Marka ve site içeriği de taslak → önizleme → yayın → geri alma akışında
--
-- NEDEN: Ofis panelindeki "Şirket ayarları" (/admin/sirket), ana sayfa metinleri ve marka
-- görselleri organization_settings'e ANINDA yazılıyordu; P0.1'in taslak/yayın modeliyle
-- tutarsızdı ve canlı siteyi değiştiren ikinci bir yayın yolu bırakıyordu. Yeni taslak/sürüm
-- sistemi YAZILMAZ: mevcut site_configs.draft.brand + site_publish + site_rollback kullanılır.
--
--   1) site_brand_columns() : ziyaretçinin gördüğü diğer içerik alanları beyaz listeye eklenir
--      (hizmet bölgesi, posta kodu, ofis konumu, çalışma saatleri, saat notu, ana sayfa metinleri)
--   2) site_apply_brand()   : sütun tipine duyarlı (numeric / jsonb); yalnızca yayın/geri alma
--      sırasında işlem içi bayrak (app.site_brand_apply) açılır
--   3) organization_settings_guard : süper admin olmayan kullanıcı marka/site içeriği sütunlarını
--      DOĞRUDAN değiştiremez (tek yayın noktası); yalnızca site_publish / site_rollback yazar.
--      Paylaşım görseli ve SEO alanları SEO modülünde kalır (seo.manage; ayrı yetki modeli).
--   4) site_save_draft : isteğe bağlı eşzamanlılık belirteci (p_expected_updated_at). Verilirse ve
--      taslak o andan sonra değişmişse kayıt reddedilir ('stale_draft'). Verilmezse eskisi gibi.
--      Dönüş: yeni taslak zamanı (bir sonraki kaydın belirteci; art arda kayıtlar için).
--
-- Yeni tablo yok; veri değişmez/silinmez. Gövdelerin geri kalanı 20261005000001 ile aynıdır.
--
-- Geri alma (veri kaybı yoktur; bekleyen taslak alanları kalır ama yeni alanlar uygulanmaz):
--   1) 20261001000001_site_brand_publish.sql › site_brand_columns, site_apply_brand ve
--      20260930000002_site_builder.sql › organization_settings_guard tanımlarını yeniden çalıştırın.
--   2) drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);
--      ardından 20261005000001_office_site_management.sql › site_save_draft tanımını ve izinlerini
--      yeniden çalıştırın.
--   3) notify pgrst, 'reload schema';
-- =============================================================================

-- 1) Taslakta tutulabilen marka / site içeriği alanları (organization_settings sütunları)
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
    'primary_color', 'accent_color',
    'service_area', 'postal_code', 'office_latitude', 'office_longitude',
    'opening_hours', 'working_hours_note', 'hero_title', 'hero_subtitle'
  ]::text[];
$$;

-- 2) Marka alanlarını organization_settings'e uygular (yalnızca beyaz liste; tip dönüşümü sütuna göre)
create or replace function public.site_apply_brand(p_org uuid, p_brand jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if p_brand is null or jsonb_typeof(p_brand) <> 'object' then
    return;
  end if;
  -- Doğrudan yazım koruması (organization_settings_guard) yalnızca bu işlem boyunca açılır
  perform set_config('app.site_brand_apply', 'on', true);
  foreach k in array public.site_brand_columns() loop
    if p_brand ? k then
      v := p_brand -> k;
      -- Boş metin = boş değer
      if jsonb_typeof(v) = 'string' and v #>> '{}' = '' then
        v := 'null'::jsonb;
      end if;
      -- Firma adı ve renkler boşaltılamaz (NOT NULL); boş gelirse mevcut değer korunur
      if k in ('display_name', 'primary_color', 'accent_color') and jsonb_typeof(v) = 'null' then
        continue;
      end if;
      -- Çalışma saatleri boşaltılırsa boş liste (sütun NOT NULL varsayılanı)
      if k = 'opening_hours' and jsonb_typeof(v) = 'null' then
        v := '[]'::jsonb;
      end if;
      execute format('update public.organization_settings set %1$I = (jsonb_populate_record(null::public.organization_settings, jsonb_build_object(%2$L, $1))).%1$I where organization_id = $2', k, k)
        using v, p_org;
    end if;
  end loop;
  perform set_config('app.site_brand_apply', 'off', true);
end;
$$;

-- 3) Ayar kaydı koruması (20260930000002 tanımı + marka/site içeriği için tek yayın noktası)
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
  -- Ziyaretçinin gördüğü marka/site içeriği yalnızca yayınla (site_publish / site_rollback) değişir
  if exists (
    select 1 from unnest(v_fields) f
     where f = any (public.site_brand_columns()) and f <> 'og_image_url'
  ) and coalesce(current_setting('app.site_brand_apply', true), '') <> 'on'
    and not public.is_super_admin() then
    raise exception 'brand_requires_publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4) Taslak bölümü kaydeder (20261005000001 gövdesi + isteğe bağlı eşzamanlılık belirteci)
drop function if exists public.site_save_draft(uuid, text, jsonb);
drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb, p_expected_updated_at timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_family text;
  v_updated_at timestamptz;
  v_now timestamptz := now();
begin
  perform public.assert_site_editor(p_org);
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  if p_section = 'style' and not public.is_super_admin() then
    v_family := p_value -> 'origin' ->> 'family';
    if v_family is not null
       and v_family is distinct from (select c.draft -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and v_family is distinct from (select c.published -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = v_family) then
      raise exception 'family_not_allowed' using errcode = '42501';
    end if;
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section, c.draft_updated_at into v_old, v_updated_at from public.site_configs c where c.organization_id = p_org for update;
  -- Eski taslak: kullanıcı formu açtıktan sonra taslak başka biri tarafından değiştirildi
  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_draft' using errcode = 'PT409';
  end if;
  update public.site_configs
     set draft = case when p_section = 'brand' and p_value = '{}'::jsonb then draft - 'brand'
                      else jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true) end,
         has_unpublished_changes = true,
         draft_updated_at = v_now,
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end,
                       'fields', case when p_section = 'brand' then (select jsonb_agg(k) from jsonb_object_keys(p_value) k) else null end));
  -- Yeni eşzamanlılık belirteci (istemci bir sonraki kayıtta gönderir)
  return v_now;
end;
$$;

revoke all on function public.site_brand_columns() from public, anon;
grant execute on function public.site_brand_columns() to authenticated;
revoke all on function public.site_apply_brand(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261007000001_seo_draft.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- P0.3 — Site geneli SEO ve meta verisi de taslak → önizleme → yayın → geri alma akışında
--
-- NEDEN: /admin/seo (seo.manage) SEO başlığını, açıklamasını, paylaşım görselini ve Search
-- Console doğrulama kodunu organization_settings'e ANINDA yazıyordu; ayrıca site_configs.seo
-- (taslaklı) ile organization_settings.seo_* (anlık) iki ayrı başlık/açıklama kaynağıydı.
-- Yeni tablo veya ikinci bir taslak/sürüm sistemi YAZILMAZ:
--
--   * Başlık / açıklama / indeksleme / şema türü : TEK kaynak site_configs.seo bölümü (taslaklı)
--   * Paylaşım görseli / doğrulama kodu          : marka taslağı (site_configs.draft.brand →
--                                                  yayında organization_settings; P0.2 ile aynı yol)
--
--   1) Geriye uyum (veri kaybı yok): organization_settings.seo_title / seo_description değerleri,
--      site_configs.published / draft ve sürüm kayıtlarındaki seo bölümüne — orada değer YOKSA —
--      kopyalanır (görünen sonuç değişmez; eski metadata "seo.title ?? seo_title" ile aynıydı).
--      Eski sütunlar silinmez; artık yalnızca okunmaz ve doğrudan değiştirilemez (donduruldu).
--   2) site_brand_columns : google_site_verification eklenir (og_image_url zaten listede)
--   3) organization_settings_guard : paylaşım görseli dahil marka sütunları ve eski SEO sütunları
--      süper admin dışında doğrudan değiştirilemez (yalnızca site_publish / site_rollback yazar)
--   4) site_save_draft : SEO yetkisi (seo.manage) olan rol (ör. editör) yalnızca SEO taslağını
--      yazabilir: 'seo' bölümü ve marka taslağında YALNIZCA paylaşım görseli / doğrulama kodu.
--      Yayın ve geri alma eskisi gibi settings.manage ister (assert_site_editor).
--
-- Gövdelerin geri kalanı 20261006000001 ile aynıdır. Veri silinmez.
--
-- Geri alma:
--   1) 20261006000001_brand_content_draft.sql › site_brand_columns, organization_settings_guard ve
--      site_save_draft tanımlarını yeniden çalıştırın (site_save_draft'tan önce:
--      drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);).
--   2) Kopyalanan seo.title / seo.description değerleri zararsızdır (eski sütunlarla aynı değer);
--      geri almada bırakılabilir. Eski sütunlar hiç değişmediği için uygulama eski sürüme dönerse
--      onları okumaya devam eder.
--   3) notify pgrst, 'reload schema';
-- =============================================================================

-- 1) Geriye uyum: eski SEO alanları seo bölümüne (yalnızca boşsa)
create or replace function public._p03_merge_seo(p_config jsonb, p_title text, p_description text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_config is null or jsonb_typeof(p_config) <> 'object' then p_config
    when p_title is null and p_description is null then p_config
    else jsonb_set(
      p_config, '{seo}',
      (case when jsonb_typeof(p_config -> 'seo') = 'object' then p_config -> 'seo' else '{}'::jsonb end)
        || jsonb_strip_nulls(jsonb_build_object(
             'title', coalesce(nullif(p_config -> 'seo' ->> 'title', ''), p_title),
             'description', coalesce(nullif(p_config -> 'seo' ->> 'description', ''), p_description))),
      true)
  end;
$$;

update public.site_configs c
   set published = public._p03_merge_seo(c.published, s.seo_title, s.seo_description),
       draft = public._p03_merge_seo(c.draft, s.seo_title, s.seo_description)
  from public.organization_settings s
 where s.organization_id = c.organization_id
   and (s.seo_title is not null or s.seo_description is not null);

update public.site_config_revisions r
   set config = public._p03_merge_seo(r.config, s.seo_title, s.seo_description)
  from public.organization_settings s
 where s.organization_id = r.organization_id
   and (s.seo_title is not null or s.seo_description is not null);

drop function public._p03_merge_seo(jsonb, text, text);

-- 2) Taslakta tutulabilen marka / site içeriği alanları (+ doğrulama kodu)
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
    'primary_color', 'accent_color',
    'service_area', 'postal_code', 'office_latitude', 'office_longitude',
    'opening_hours', 'working_hours_note', 'hero_title', 'hero_subtitle',
    'google_site_verification'
  ]::text[];
$$;

-- SEO yetkisinin (seo.manage) taslakta değiştirebildiği marka alanları
create or replace function public.site_seo_brand_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['og_image_url', 'google_site_verification']::text[];
$$;

-- 3) Ayar kaydı koruması: marka/site içeriği + SEO yalnızca yayınla değişir
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
  -- Ziyaretçinin gördüğü marka/site içeriği ve site SEO'su yalnızca yayınla (site_publish /
  -- site_rollback) değişir. Eski seo_title / seo_description artık okunmaz ve değiştirilemez.
  if exists (
    select 1 from unnest(v_fields) f
     where f = any (public.site_brand_columns()) or f in ('seo_title', 'seo_description')
  ) and coalesce(current_setting('app.site_brand_apply', true), '') <> 'on'
    and not public.is_super_admin() then
    raise exception 'brand_requires_publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4) Taslak bölümü kaydeder (20261006000001 gövdesi + SEO yetkisinin sınırlı taslak hakkı)
drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb, p_expected_updated_at timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_family text;
  v_updated_at timestamptz;
  v_now timestamptz := now();
  v_full boolean;
begin
  -- Yetki: süper admin veya settings.manage → tüm bölümler; seo.manage → yalnızca SEO taslağı
  if public.is_super_admin()
     or ((select auth.uid()) is not null and p_org is not null and public.has_org_permission(p_org, 'settings.manage')) then
    v_full := true;
  elsif (select auth.uid()) is not null and p_org is not null and public.has_org_permission(p_org, 'seo.manage')
        and p_section in ('seo', 'brand') then
    v_full := false;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  if p_section = 'style' and not public.is_super_admin() then
    v_family := p_value -> 'origin' ->> 'family';
    if v_family is not null
       and v_family is distinct from (select c.draft -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and v_family is distinct from (select c.published -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = v_family) then
      raise exception 'family_not_allowed' using errcode = '42501';
    end if;
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section, c.draft_updated_at into v_old, v_updated_at from public.site_configs c where c.organization_id = p_org for update;
  -- SEO yetkisi: marka taslağında yalnızca SEO alanları değişebilir (diğer bekleyen alanlar aynen kalmalı)
  if not v_full and p_section = 'brand' and exists (
    select 1
      from (select jsonb_object_keys(coalesce(v_old, '{}'::jsonb)) as k
            union select jsonb_object_keys(p_value)) keys
     where keys.k <> all (public.site_seo_brand_columns())
       and (coalesce(v_old, '{}'::jsonb) -> keys.k) is distinct from (p_value -> keys.k)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Eski taslak: kullanıcı formu açtıktan sonra taslak başka biri tarafından değiştirildi
  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_draft' using errcode = 'PT409';
  end if;
  update public.site_configs
     set draft = case when p_section = 'brand' and p_value = '{}'::jsonb then draft - 'brand'
                      else jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true) end,
         has_unpublished_changes = true,
         draft_updated_at = v_now,
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end,
                       'fields', case when p_section = 'brand' then (select jsonb_agg(k) from jsonb_object_keys(p_value) k) else null end));
  -- Yeni eşzamanlılık belirteci (istemci bir sonraki kayıtta gönderir)
  return v_now;
end;
$$;

revoke all on function public.site_brand_columns() from public, anon;
grant execute on function public.site_brand_columns() to authenticated;
revoke all on function public.site_seo_brand_columns() from public, anon;
grant execute on function public.site_seo_brand_columns() to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261008000001_owner_invitations.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- P0.4 — Müşteri (ofis sahibi) daveti ve güvenli hesap aktivasyonu
--
-- Önceki akış: KARAY yeni müşteri açarken sahip hesabını GEÇİCİ ŞİFREYLE oluşturuyor ve
-- şifreyi yöneticinin ekranında gösteriyordu. Yeni akış:
--
--   platform_create_organization(..., p_invite_token_hash)
--      → organizasyon + sahip üyeliği + BEKLEYEN davet (tek işlem)
--   platform_send_owner_invitation      → yeni token (eski bağlantı geçersiz) + yeni süre
--   platform_revoke_owner_invitation    → bekleyen daveti iptal eder (hesabı silmez)
--   invitation_lookup / invitation_accept (yalnızca sunucu, service_role)
--      → token özeti ile tek kullanımlık, süreli, e-posta / kiracı / rol bağlı kabul
--
-- Güvenlik:
--   • Ham token veritabanına HİÇ gelmez; uygulama SHA-256 özetini gönderir (token_hash).
--   • Süre politikası tek yerde: invitation_ttl() (72 saat).
--   • Tek kullanım: kabul, "status = 'pending'" koşullu tek UPDATE ile yapılır (yarış güvenli).
--   • Kabul yalnızca: davetin hesabı hâlâ etkinleştirilmemiş (e-posta doğrulanmamış, hiç giriş yok), hesabın e-postası davetin
--     e-postası, üyelik aktif ve rolü davetin rolü ise. Davet şifre sıfırlama yerine kullanılamaz.
--   • Tablo istemciye kapalı: RLS + yalnızca süper admin / users.manage SELECT; token_hash sütunu
--     hiçbir istemci rolüne okunmaz. Yazma yalnızca bu dosyadaki fonksiyonlarla.
--   • Deneme sınırı: başarısız aktivasyon (IP özeti başına 10 dk'da 10) ve gönderim (ofis başına
--     saatte 5) mevcut denetim kaydı (audit_logs) üzerinden sayılır.
--
-- Mevcut kullanıcılar, üyelikler ve şifreler DEĞİŞMEZ (veri taşıma yok).
--
-- Geri alma (yalnızca gerekirse):
--   drop function if exists public.invitation_release(uuid);
--   drop function if exists public.invitation_accept(text, text);
--   drop function if exists public.invitation_lookup(text, text);
--   drop function if exists public.platform_owner_invitation(uuid);
--   drop function if exists public.platform_revoke_owner_invitation(uuid);
--   drop function if exists public.platform_mark_invitation_sent(uuid);
--   drop function if exists public.platform_send_owner_invitation(uuid, text);
--   drop function if exists public.invitation_ttl();
--   drop function if exists public.platform_create_organization(text, text, text, text, uuid, text);
--   -- 20260926000007_v2_security.sql içindeki 5 parametreli platform_create_organization yeniden uygulanır
--   drop table if exists public.organization_invitations;
-- =============================================================================

-- 1) Davet tablosu
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role public.org_role not null default 'owner' check (role = 'owner'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);

create unique index if not exists organization_invitations_token_idx on public.organization_invitations (token_hash);
-- Aynı ofis + e-posta için en fazla bir bekleyen davet
create unique index if not exists organization_invitations_pending_idx
  on public.organization_invitations (organization_id, email) where status = 'pending';
create index if not exists organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
create index if not exists organization_invitations_user_idx on public.organization_invitations (user_id);

drop trigger if exists organization_invitations_updated_at on public.organization_invitations;
create trigger organization_invitations_updated_at before update on public.organization_invitations
  for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from public, anon, authenticated;
-- Okuma: süper admin her şeyi, ofiste users.manage yetkisi olan yalnızca kendi ofisini; token_hash HİÇ
grant select (id, organization_id, user_id, email, role, status, expires_at, last_sent_at, accepted_at, revoked_at, created_by, created_at, updated_at)
  on public.organization_invitations to authenticated;
drop policy if exists organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (public.is_super_admin() or public.has_org_permission(organization_id, 'users.manage'));
-- INSERT / UPDATE / DELETE politikası yok: yalnızca aşağıdaki security definer fonksiyonlar yazar

-- 2) Süre politikası (tek merkez)
create or replace function public.invitation_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '72 hours';
$$;

-- Hesap henüz etkinleştirilmemiş mi? E-postası hiç doğrulanmamış ve hiç giriş yapmamış (Supabase Auth,
-- şifresiz açılan hesaba kimsenin bilmediği rastgele bir şifre özeti yazar; doğrulanmamış e-postayla
-- şifreli giriş yapılamaz), silinmemiş, engellenmemiş. Aktivasyon e-postayı doğrular → artık false.
create or replace function public._invitation_account_pending(p_user uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
     where u.id = p_user
       and lower(u.email) = p_email
       and u.email_confirmed_at is null
       and u.last_sign_in_at is null
       and u.deleted_at is null
       and (u.banned_until is null or u.banned_until < now())
  );
$$;
revoke all on function public._invitation_account_pending(uuid, text) from public, anon, authenticated;

-- 3) Organizasyon açma: davet özeti verilirse sahip için bekleyen davet aynı işlemde oluşur
drop function if exists public.platform_create_organization(text, text, text, text, uuid);
create or replace function public.platform_create_organization(
  p_slug text, p_name text, p_prefix text, p_plan text, p_owner uuid, p_invite_token_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_email text;
begin
  perform public.assert_super_admin();
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;
  if p_invite_token_hash is not null then
    if p_owner is null or p_invite_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_invitation' using errcode = '22023';
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = p_owner;
    -- Davet yalnızca henüz etkinleştirilmemiş yeni hesap içindir
    if v_email is null or not public._invitation_account_pending(p_owner, v_email) then
      raise exception 'account_active' using errcode = 'P0001';
    end if;
  end if;
  insert into public.organizations (slug, name, reference_prefix, status)
  values (p_slug, p_name, upper(p_prefix), 'active')
  returning id into v_org;
  insert into public.organization_settings (organization_id, display_name) values (v_org, left(p_name, 80));
  insert into public.subscriptions (organization_id, plan_id, status, started_at, trial_ends_at)
  values (v_org, p_plan, 'trialing', now(), now() + interval '14 days');
  if p_owner is not null then
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_org, p_owner, 'owner', 'active');
  end if;
  perform public.write_audit(null, 'organization.created', 'organization', v_org::text, p_name,
    jsonb_build_object('slug', p_slug, 'plan', p_plan));
  if p_invite_token_hash is not null then
    insert into public.organization_invitations (organization_id, user_id, email, role, token_hash, expires_at, created_by)
    values (v_org, p_owner, v_email, 'owner', p_invite_token_hash, now() + public.invitation_ttl(), (select auth.uid()));
    perform public.write_audit(v_org, 'invitation.created', 'user', p_owner::text, v_email, jsonb_build_object('role', 'owner'));
  end if;
  return v_org;
end;
$$;

-- 4) Davet gönder / tekrar gönder / yeni davet (yalnızca süper admin).
--    Bekleyen davet varsa token ve süre YENİLENİR (eski bağlantı geçersiz olur); iptal edilmiş
--    veya hiç davet yoksa sahip hesabı hâlâ etkinleştirilmemişse yeni davet açılır.
--    E-posta, kullanıcı ve rol istemciden ALINMAZ: sahip üyeliğinden / mevcut davetten okunur.
create or replace function public.platform_send_owner_invitation(p_org uuid, p_token_hash text)
returns table (invitation_id uuid, email text, expires_at timestamptz, resent boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
  v_user uuid;
  v_email text;
begin
  perform public.assert_super_admin();
  if p_org is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_invitation' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active') then
    raise exception 'invalid_organization' using errcode = 'P0001';
  end if;
  -- Kötüye kullanım sınırı: ofis başına saatte 5 gönderim
  if (select count(*) from public.audit_logs a
       where a.organization_id = p_org and a.action in ('invitation.sent', 'invitation.resent')
         and a.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_inv from public.organization_invitations i
   where i.organization_id = p_org and i.status = 'pending'
   order by i.created_at desc limit 1
   for update;

  if found then
    if not public._invitation_account_pending(v_inv.user_id, v_inv.email)
       or not exists (select 1 from public.organization_members m
                       where m.organization_id = p_org and m.user_id = v_inv.user_id and m.status = 'active' and m.role = v_inv.role) then
      raise exception 'account_active' using errcode = 'P0001';
    end if;
    update public.organization_invitations i
       set token_hash = p_token_hash, expires_at = now() + public.invitation_ttl()
     where i.id = v_inv.id
     returning * into v_inv;
    perform public.write_audit(p_org, case when v_inv.last_sent_at is null then 'invitation.sent' else 'invitation.resent' end,
      'user', v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id));
    return query select v_inv.id, v_inv.email, v_inv.expires_at, v_inv.last_sent_at is not null;
    return;
  end if;

  if exists (select 1 from public.organization_invitations i where i.organization_id = p_org and i.status = 'accepted') then
    raise exception 'invitation_accepted' using errcode = 'P0001';
  end if;
  -- Yeni davet: aktif sahip üyeliği olan, henüz etkinleştirilmemiş hesap
  select m.user_id, lower(u.email) into v_user, v_email
    from public.organization_members m join auth.users u on u.id = m.user_id
   where m.organization_id = p_org and m.role = 'owner' and m.status = 'active'
   order by m.created_at limit 1;
  if v_user is null then
    raise exception 'owner_not_found' using errcode = 'P0001';
  end if;
  if not public._invitation_account_pending(v_user, v_email) then
    raise exception 'account_active' using errcode = 'P0001';
  end if;
  insert into public.organization_invitations (organization_id, user_id, email, role, token_hash, expires_at, created_by)
  values (p_org, v_user, v_email, 'owner', p_token_hash, now() + public.invitation_ttl(), (select auth.uid()))
  returning * into v_inv;
  perform public.write_audit(p_org, 'invitation.created', 'user', v_user::text, v_email, jsonb_build_object('role', 'owner'));
  perform public.write_audit(p_org, 'invitation.sent', 'user', v_user::text, v_email, jsonb_build_object('invitation_id', v_inv.id));
  return query select v_inv.id, v_inv.email, v_inv.expires_at, false;
end;
$$;

-- E-posta sağlayıcı kabul ettikten sonra işaretlenir (teslim ve kabul durumu ayrı kavramlar)
create or replace function public.platform_mark_invitation_sent(p_invitation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.organization_invitations set last_sent_at = now() where id = p_invitation and status = 'pending';
end;
$$;

-- Bekleyen daveti iptal eder; kabul edilmiş davet iptal edilemez, hesap silinmez
create or replace function public.platform_revoke_owner_invitation(p_org uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  perform public.assert_super_admin();
  update public.organization_invitations i
     set status = 'revoked', revoked_at = now()
   where i.organization_id = p_org and i.status = 'pending'
   returning * into v_inv;
  if v_inv.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.write_audit(p_org, 'invitation.revoked', 'user', v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id));
end;
$$;

-- Platform ekranı: ofisin son sahip daveti (token özeti dönmez); süresi geçmiş bekleyen = expired
create or replace function public.platform_owner_invitation(p_org uuid)
returns table (id uuid, email text, status text, expires_at timestamptz, last_sent_at timestamptz,
               accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz, account_pending boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select i.id, i.email,
           case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
           i.expires_at, i.last_sent_at, i.accepted_at, i.revoked_at, i.created_at,
           public._invitation_account_pending(i.user_id, i.email)
      from public.organization_invitations i
     where i.organization_id = p_org
     order by (i.status = 'pending') desc, i.created_at desc
     limit 1;
end;
$$;

-- 5) Aktivasyon (yalnızca sunucu: service_role). Geçersiz/eskimiş/kullanılmış/iptal tokenlar
--    AYNI sonucu döndürür (bilgi sızdırmaz); başarısız denemeler IP özetiyle kaydedilir ve sınırlanır.
create or replace function public._invitation_attempt_blocked(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_ip_hash is not null and (
    select count(*) from public.audit_logs a
     where a.action = 'invitation.activation_failed' and a.ip_hash = p_ip_hash
       and a.created_at > now() - interval '10 minutes') >= 10;
$$;
revoke all on function public._invitation_attempt_blocked(text) from public, anon, authenticated;

create or replace function public._invitation_log_failure(p_ip_hash text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, action, metadata, ip_hash)
  values (null, 'invitation.activation_failed', '{}'::jsonb, left(p_ip_hash, 128));
$$;
revoke all on function public._invitation_log_failure(text) from public, anon, authenticated;

-- Kullanılabilir davetin satırı (kilitlemeden); tüm koşullar burada
create or replace function public._invitation_usable(p_token_hash text)
returns public.organization_invitations
language sql
stable
security definer
set search_path = ''
as $$
  select i.* from public.organization_invitations i
   where i.token_hash = p_token_hash
     and i.status = 'pending'
     and i.expires_at > now()
     and public._invitation_account_pending(i.user_id, i.email)
     and exists (select 1 from public.organization_members m
                  where m.organization_id = i.organization_id and m.user_id = i.user_id
                    and m.status = 'active' and m.role = i.role)
     and exists (select 1 from public.organizations o where o.id = i.organization_id and o.status = 'active');
$$;
revoke all on function public._invitation_usable(text) from public, anon, authenticated;

create or replace function public.invitation_lookup(p_token_hash text, p_ip_hash text default null)
returns table (result text, email text, organization_name text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  if public._invitation_attempt_blocked(p_ip_hash) then
    return query select 'rate_limited'::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  if p_token_hash ~ '^[0-9a-f]{64}$' then
    v_inv := public._invitation_usable(p_token_hash);
  end if;
  if v_inv.id is null then
    perform public._invitation_log_failure(p_ip_hash);
    return query select 'invalid'::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  return query select 'ok'::text, v_inv.email, o.name, v_inv.expires_at
    from public.organizations o where o.id = v_inv.organization_id;
end;
$$;

-- Tek kullanımlık kabul: koşullu tek UPDATE (eşzamanlı iki istekte yalnızca biri satır alır)
create or replace function public.invitation_accept(p_token_hash text, p_ip_hash text default null)
returns table (result text, invitation_id uuid, organization_id uuid, user_id uuid, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  if public._invitation_attempt_blocked(p_ip_hash) then
    return query select 'rate_limited'::text, null::uuid, null::uuid, null::uuid, null::text;
    return;
  end if;
  if p_token_hash ~ '^[0-9a-f]{64}$' then
    v_inv := public._invitation_usable(p_token_hash);
  end if;
  if v_inv.id is not null then
    update public.organization_invitations i
       set status = 'accepted', accepted_at = now()
     where i.id = v_inv.id and i.status = 'pending' and i.token_hash = p_token_hash and i.expires_at > now()
     returning * into v_inv;
  end if;
  if v_inv.id is null or v_inv.status <> 'accepted' then
    perform public._invitation_log_failure(p_ip_hash);
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::text;
    return;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata, ip_hash)
  values (v_inv.organization_id, v_inv.user_id, public.audit_actor_label(v_inv.user_id), 'invitation.accepted', 'user',
          v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role), left(p_ip_hash, 128));
  return query select 'ok'::text, v_inv.id, v_inv.organization_id, v_inv.user_id, v_inv.email;
end;
$$;

-- Telafi: kabulden sonra şifre atanamadıysa (ör. Supabase Auth şifreyi zayıf buldu) davet
-- yeniden bekler — yalnızca hesap hâlâ etkinleştirilmemişse ve kabul az önce yapıldıysa
create or replace function public.invitation_release(p_invitation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.organization_invitations i
     set status = 'pending', accepted_at = null
   where i.id = p_invitation and i.status = 'accepted'
     and i.accepted_at > now() - interval '5 minutes'
     and public._invitation_account_pending(i.user_id, i.email);
$$;

revoke all on function public.invitation_ttl() from public, anon;
grant execute on function public.invitation_ttl() to authenticated, service_role;
revoke all on function public.platform_create_organization(text, text, text, text, uuid, text) from public, anon;
grant execute on function public.platform_create_organization(text, text, text, text, uuid, text) to authenticated;
revoke all on function public.platform_send_owner_invitation(uuid, text) from public, anon;
grant execute on function public.platform_send_owner_invitation(uuid, text) to authenticated;
revoke all on function public.platform_mark_invitation_sent(uuid) from public, anon;
grant execute on function public.platform_mark_invitation_sent(uuid) to authenticated;
revoke all on function public.platform_revoke_owner_invitation(uuid) from public, anon;
grant execute on function public.platform_revoke_owner_invitation(uuid) to authenticated;
revoke all on function public.platform_owner_invitation(uuid) from public, anon;
grant execute on function public.platform_owner_invitation(uuid) to authenticated;
-- Token ile çalışan fonksiyonlar istemciye KAPALI: yalnızca sunucu (service_role)
revoke all on function public.invitation_lookup(text, text) from public, anon, authenticated;
grant execute on function public.invitation_lookup(text, text) to service_role;
revoke all on function public.invitation_accept(text, text) from public, anon, authenticated;
grant execute on function public.invitation_accept(text, text) to service_role;
revoke all on function public.invitation_release(uuid) from public, anon, authenticated;
grant execute on function public.invitation_release(uuid) to service_role;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261009000001_custom_domains.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- P0.5 — Özel alan adı bağlama (doğrulama → bağlantı → kiracı çözümlemesi)
--
-- Önceki durum: organization_domains vardı; süper admin eklediği anda verified_at = now()
-- yazılıyordu (sahiplik doğrulaması yok), "doğrulandı" ile "trafik bağlandı" ayrımı yoktu ve
-- hostname tüm durumlarda tekildi (bekleyen bir kayıt alan adını kalıcı olarak kilitliyordu).
--
-- Yeni yaşam döngüsü (AYNI tablo genişletilir; ikinci bir alan adı sistemi yoktur):
--   pending  → alan adı eklendi; TXT doğrulama kodu bekleniyor (süreli)
--   verified → _karay-verification TXT kaydı doğrulandı (sahiplik)
--   active   → DNS yönlendirmesi KARAY'a bağlı; site bu adreste açılır
-- Yalnızca ACTIVE alan adı kiracıya çözülür (public_tenant, public_tenant_domains).
--
-- Güvenlik:
--   • Doğrulama kodu (TXT değeri) veritabanına yazılmaz; yalnızca SHA-256 özeti
--     (verification_token_hash) ve kodu sunucunun yeniden üretebilmesi için rastgele nonce.
--     Kod sunucuda HMAC(sunucu anahtarı, alan adı kimliği | kiracı | hostname | nonce) ile
--     üretilir → bir alan adının kodu başka bir alan adını / kiracıyı doğrulayamaz.
--   • Kod süreli: domain_verification_ttl() (7 gün, tek merkez).
--   • Bir hostname aynı anda yalnızca BİR kiracıda doğrulanmış/aktif olabilir (kısmi tekil
--     indeks; eşzamanlı iki doğrulamada yalnızca biri başarılı olur). Aynı kiracıda tekrar yok.
--     Bekleyen kayıt alan adını kilitlemez (işgal edilemez); sahibi doğrulayan alır.
--   • Birincil alan adı yalnızca aktif olabilir; kiracı başına en fazla bir birincil (mevcut indeks).
--   • Yazma yalnızca bu dosyadaki fonksiyonlarla ve yalnızca sunucudan (service_role). Fonksiyon
--     işlemi yapanın (p_actor) yetkisini AYRICA doğrular: ofiste settings.manage (+ plan özelliği)
--     veya süper admin. Organizasyon kimliği sunucuda oturumdan gelir (ctx.org.id).
--   • İstemci tabloyu yalnızca okuyabilir (kendi ofisi / süper admin; anonim RLS ile boş); token özeti ve nonce okunmaz.
--   • Doğrulama denemesi sınırı: alan adı başına 10 dakikada 10 (audit_logs üzerinden).
--
-- Mevcut veri: verified_at dolu kayıtlar 'active' olur (bugün çalışan alan adları çalışmaya devam
-- eder), diğerleri 'pending' (birincil işareti kaldırılır). Veri silinmez.
--
-- Geri alma (yalnızca gerekirse):
--   drop function if exists public.domain_list(uuid, uuid, boolean);
--   drop function if exists public.domain_remove(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_set_primary(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_mark_active(uuid, uuid, boolean, uuid, boolean);
--   drop function if exists public.domain_mark_verified(uuid, uuid, boolean, uuid, text[]);
--   drop function if exists public.domain_check_begin(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_rotate_verification(uuid, uuid, boolean, uuid, text, text);
--   drop function if exists public.domain_add(uuid, uuid, boolean, uuid, text, text, text);
--   drop function if exists public._domain_actor_allowed(uuid, uuid, boolean);
--   drop function if exists public.domain_verification_ttl();
--   -- public_tenant / public_tenant_domains / platform_add_domain: 20260929000001 ve
--   -- 20260926000007 tanımları yeniden uygulanır
--   drop index if exists public.organization_domains_bound_idx;
--   drop index if exists public.organization_domains_org_host_idx;
--   alter table public.organization_domains add constraint organization_domains_hostname_key unique (hostname);
--   alter table public.organization_domains drop constraint if exists organization_domains_status_check,
--     drop constraint if exists organization_domains_state_check, drop constraint if exists organization_domains_primary_active_check,
--     drop column if exists status, drop column if exists verification_token_hash, drop column if exists verification_nonce,
--     drop column if exists verification_expires_at, drop column if exists activated_at, drop column if exists updated_at,
--     drop column if exists created_by;
-- =============================================================================

-- 1) Sütunlar
alter table public.organization_domains
  add column if not exists status text not null default 'pending',
  add column if not exists verification_token_hash text,
  add column if not exists verification_nonce text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- 2) Mevcut veri (bir kez; yeniden çalıştırmada değişiklik yapmaz)
update public.organization_domains
   set status = 'active', activated_at = coalesce(activated_at, verified_at)
 where verified_at is not null and status = 'pending' and activated_at is null;
update public.organization_domains set is_primary = false where is_primary and status <> 'active';

-- 3) Kısıtlar
alter table public.organization_domains drop constraint if exists organization_domains_status_check;
alter table public.organization_domains add constraint organization_domains_status_check
  check (status in ('pending', 'verified', 'active'));
alter table public.organization_domains drop constraint if exists organization_domains_state_check;
alter table public.organization_domains add constraint organization_domains_state_check check (
  (status = 'pending' or verified_at is not null)
  and ((status = 'active') = (activated_at is not null))
  and (verification_token_hash is null or verification_token_hash ~ '^[0-9a-f]{64}$')
  and (verification_nonce is null or verification_nonce ~ '^[0-9a-f]{32}$')
);
alter table public.organization_domains drop constraint if exists organization_domains_primary_active_check;
alter table public.organization_domains add constraint organization_domains_primary_active_check
  check (not is_primary or status = 'active');

-- Tekillik: bağlı (doğrulanmış/aktif) hostname tek kiracıda; aynı kiracıda tekrar yok
alter table public.organization_domains drop constraint if exists organization_domains_hostname_key;
create unique index if not exists organization_domains_bound_idx
  on public.organization_domains (hostname) where status in ('verified', 'active');
create unique index if not exists organization_domains_org_host_idx
  on public.organization_domains (organization_id, hostname);
create index if not exists organization_domains_host_idx on public.organization_domains (hostname);

drop trigger if exists organization_domains_updated_at on public.organization_domains;
create trigger organization_domains_updated_at before update on public.organization_domains
  for each row execute function public.set_updated_at();

-- 4) İstemci erişimi: yalnızca okuma (RLS: kendi ofisi settings.manage / süper admin; anonim için
--    politika yok → boş); token özeti ve nonce hiçbir istemciye okunmaz (herkese açık çözümleme RPC ile)
revoke all on public.organization_domains from anon, authenticated;
grant select (id, organization_id, hostname, is_primary, status, verified_at, activated_at, verification_expires_at, created_at, updated_at)
  on public.organization_domains to authenticated;
-- Anonim rol: önceki davranış korunur (tablo okuma yetkisi var, anonim RLS politikası YOK → hiçbir
-- satır, dolayısıyla hiçbir özet dönmez). Herkese açık çözümleme yalnızca public_tenant* RPC'leriyle.
grant select on public.organization_domains to anon;

-- 5) Süre politikası (tek merkez)
create or replace function public.domain_verification_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '7 days';
$$;

-- İşlemi yapan kişi bu ofisin alan adlarını yönetebilir mi? (service_role çağrılarında auth.uid()
-- yoktur; kimlik sunucunun doğruladığı oturumdan gelir ve burada AYRICA denetlenir)
create or replace function public._domain_actor_allowed(p_actor uuid, p_org uuid, p_platform boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_actor is null or p_org is null then false
    when p_platform then exists (select 1 from public.profiles p where p.id = p_actor and p.is_super_admin)
    else exists (
      select 1
        from public.organization_members m
        join public.organizations o on o.id = m.organization_id and o.status = 'active'
        join public.role_permissions rp on rp.role = m.role and rp.permission = 'settings.manage'
       where m.organization_id = p_org and m.user_id = p_actor and m.status = 'active')
  end;
$$;
revoke all on function public._domain_actor_allowed(uuid, uuid, boolean) from public, anon, authenticated;

-- 6) Alan adı ekle (pending + doğrulama kodu özeti)
create or replace function public.domain_add(
  p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_hostname text, p_nonce text, p_token_hash text
)
returns table (id uuid, hostname text, status text, verification_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_domains;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active') then
    raise exception 'invalid_organization' using errcode = 'P0001';
  end if;
  -- Ofis kendi alan adını ancak planı özel alan adına izin veriyorsa ekler
  if not p_platform and not coalesce((select pl.custom_domain_enabled from public.org_plan(p_org) pl limit 1), false) then
    raise exception 'plan_feature_disabled' using errcode = 'P0001';
  end if;
  if (select count(*) from public.organization_domains d where d.organization_id = p_org) >= 5 then
    raise exception 'domain_limit' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_nonce is null or p_nonce !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid_verification' using errcode = '22023';
  end if;
  -- Başka kiracıda doğrulanmış/aktif alan adı alınamaz (indeks de korur; burada anlaşılır hata)
  if exists (select 1 from public.organization_domains d where d.hostname = p_hostname and d.status in ('verified', 'active') and d.organization_id <> p_org) then
    raise exception 'domain_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organization_domains d where d.hostname = p_hostname and d.organization_id = p_org) then
    raise exception 'domain_exists' using errcode = 'P0001';
  end if;
  insert into public.organization_domains (id, organization_id, hostname, is_primary, status, verification_token_hash, verification_nonce, verification_expires_at, created_by)
  values (p_id, p_org, p_hostname, false, 'pending', p_token_hash, p_nonce, now() + public.domain_verification_ttl(), p_actor)
  returning * into v_row;
  return query select v_row.id, v_row.hostname, v_row.status, v_row.verification_expires_at;
end;
$$;

-- 7) Yeni doğrulama kodu (yalnızca bekleyen alan adı; eski kod hemen geçersiz, süre baştan)
create or replace function public.domain_rotate_verification(
  p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_nonce text, p_token_hash text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_nonce is null or p_nonce !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid_verification' using errcode = '22023';
  end if;
  update public.organization_domains d
     set verification_token_hash = p_token_hash, verification_nonce = p_nonce,
         verification_expires_at = now() + public.domain_verification_ttl()
   where d.id = p_id and d.organization_id = p_org and d.status = 'pending'
   returning d.verification_expires_at into v_expires;
  if v_expires is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_expires;
end;
$$;

-- 8) Doğrulama / bağlantı denetimi başlangıcı: yetki + deneme sınırı (DNS'e gitmeden ÖNCE)
create or replace function public.domain_check_begin(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns table (hostname text, status text, verification_nonce text, verification_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_domains;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.organization_domains d where d.id = p_id and d.organization_id = p_org;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.audit_logs a
       where a.organization_id = p_org and a.action = 'domain.checked' and a.target_id = p_id::text
         and a.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.checked', 'domain', p_id::text, v_row.hostname,
          jsonb_build_object('status', v_row.status));
  return query select v_row.hostname, v_row.status, v_row.verification_nonce, v_row.verification_expires_at;
end;
$$;

-- 9) Sahiplik doğrulandı: DNS'te bulunan TXT değerlerinin özetlerinden biri bu alan adının
--    (bu kiracının) süresi geçmemiş kod özetiyle eşleşmeli
create or replace function public.domain_mark_verified(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_found_hashes text[])
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  begin
    update public.organization_domains d
       set status = 'verified', verified_at = now(), verification_token_hash = null, verification_nonce = null, verification_expires_at = null
     where d.id = p_id and d.organization_id = p_org and d.status = 'pending'
       and d.verification_token_hash is not null
       and d.verification_expires_at > now()
       and d.verification_token_hash = any (coalesce(p_found_hashes, '{}'::text[]))
     returning d.hostname into v_host;
  exception when unique_violation then
    raise exception 'domain_taken' using errcode = 'P0001';
  end;
  if v_host is null then
    raise exception 'verification_failed' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.verified', 'domain', p_id::text, v_host, '{}'::jsonb);
  return v_host;
end;
$$;

-- 10) Bağlantı: yalnızca doğrulanmış alan adı aktif olur. DNS yönlendirmesi sunucuda denetlenir;
--     elle onay (p_manual) yalnızca süper admin. İlk aktif alan adı birincil olur.
create or replace function public.domain_mark_active(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_manual boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_manual and not p_platform then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organization_domains d
     set status = 'active', activated_at = now()
   where d.id = p_id and d.organization_id = p_org and d.status = 'verified' and d.verified_at is not null
   returning d.hostname into v_host;
  if v_host is null then
    raise exception 'not_verified' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.organization_domains d where d.organization_id = p_org and d.is_primary) then
    update public.organization_domains d set is_primary = true where d.id = p_id;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.activated', 'domain', p_id::text, v_host,
          jsonb_build_object('manual', coalesce(p_manual, false)));
  return v_host;
end;
$$;

-- 11) Birincil (kanonik) alan adı: yalnızca aynı kiracının AKTİF alan adı
create or replace function public.domain_set_primary(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_domains d where d.id = p_id and d.organization_id = p_org and d.status = 'active') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  update public.organization_domains d set is_primary = false where d.organization_id = p_org and d.is_primary and d.id <> p_id;
  update public.organization_domains d set is_primary = true where d.id = p_id and d.organization_id = p_org;
end;
$$;

-- 12) Kaldır: kiracı çözümlemesinden hemen düşer; birincilse kiracı varsayılan adresine döner
--     (başka alan adı kendiliğinden birincil yapılmaz). Ad serbest kalır; yeni sahibi yeniden doğrular.
create or replace function public.domain_remove(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.organization_domains d where d.id = p_id and d.organization_id = p_org returning d.hostname into v_host;
  if v_host is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_host;
end;
$$;

-- 13) Yönetim listesi (token özeti dönmez; nonce yalnızca sunucuya, TXT değerini yeniden üretmek için)
create or replace function public.domain_list(p_actor uuid, p_org uuid, p_platform boolean)
returns table (id uuid, hostname text, status text, is_primary boolean, verified_at timestamptz, activated_at timestamptz,
               verification_expires_at timestamptz, verification_nonce text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select d.id, d.hostname, d.status, d.is_primary, d.verified_at, d.activated_at, d.verification_expires_at, d.verification_nonce, d.created_at
      from public.organization_domains d
     where d.organization_id = p_org
     order by d.is_primary desc, d.created_at;
end;
$$;

-- 14) Herkese açık çözümleme: YALNIZCA aktif alan adı
create or replace function public.public_tenant(p_slug text default null, p_hostname text default null)
returns table (id uuid, slug text, name text, is_default boolean, reference_prefix text, status public.org_status)
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
              and d.status = 'active'
            limit 1
         )
       )
     )
   limit 1;
$$;

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
     and d.status = 'active';
$$;

-- Eski platform yolu (geriye uyum): artık doğrulanmış/aktif olarak EKLEMEZ, bekleyen kayıt açar.
-- Uygulama bunu kullanmaz (domain_add); süper admin dışındakiler için hata vermeye devam eder.
create or replace function public.platform_add_domain(p_org uuid, p_hostname text, p_primary boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_super_admin();
  insert into public.organization_domains (organization_id, hostname, is_primary, status)
  values (p_org, lower(btrim(p_hostname)), false, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.domain_verification_ttl() from public, anon;
grant execute on function public.domain_verification_ttl() to authenticated, service_role;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.domain_add(uuid, uuid, boolean, uuid, text, text, text)',
    'public.domain_rotate_verification(uuid, uuid, boolean, uuid, text, text)',
    'public.domain_check_begin(uuid, uuid, boolean, uuid)',
    'public.domain_mark_verified(uuid, uuid, boolean, uuid, text[])',
    'public.domain_mark_active(uuid, uuid, boolean, uuid, boolean)',
    'public.domain_set_primary(uuid, uuid, boolean, uuid)',
    'public.domain_remove(uuid, uuid, boolean, uuid)',
    'public.domain_list(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 20261010000001_password_reset_requests.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- FAZ 0 — Şifre sıfırlama isteği hız sınırı + şema sürümü
--
-- Şifre sıfırlama e-postası artık KARAY'ın e-posta sağlayıcısıyla (EMAIL_PROVIDER) gönderilir:
-- bağlantı sunucuda Auth yönetici API'siyle (generateLink) üretilir. Bu yol Supabase Auth'un kendi
-- "recover" hız sınırından geçmediği için sınır burada uygulanır:
--   • aynı e-posta için saatte en fazla 3 istek,
--   • aynı IP özeti için saatte en fazla 10 istek.
-- Sınır hesabın var olup olmamasından BAĞIMSIZDIR (kullanıcı listesi tahmin edilemez). E-posta
-- düz metin olarak saklanmaz: sunucu tuzlu özetini (64 hex) gönderir, kayıt audit_logs'a yazılır.
--
-- Fonksiyon YALNIZCA sunucu anahtarıyla (service_role) çağrılabilir.
--
-- karay_schema_version(): uygulanmış en son KARAY migration'ının kimliği. Canlıya çıkış kontrolü
-- (npm run prelaunch -- --production) ve son kontrol betiği bunu beklenen değerle karşılaştırır.
-- Sonraki her migration bu fonksiyonu kendi kimliğiyle yeniden tanımlar.
--
-- Veri değiştirmez; tekrar çalıştırılabilir.
--
-- Geri dönüş:
--   drop function if exists public.auth_password_reset_allowed(text, text);
--   drop function if exists public.karay_schema_version();
-- =============================================================================

create or replace function public.auth_password_reset_allowed(p_email_hash text, p_ip_hash text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  if p_ip_hash is not null and (char_length(p_ip_hash) > 128 or p_ip_hash !~ '^[0-9a-f]+$') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  -- Aynı adres için saatte 3 istek (hesap var olsun olmasın)
  if (select count(*) from public.audit_logs a
       where a.organization_id is null and a.action = 'auth.password_reset_requested'
         and a.target_type = 'email_hash' and a.target_id = p_email_hash
         and a.created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  -- Aynı istemci (IP özeti) için saatte 10 istek
  if p_ip_hash is not null and (select count(*) from public.audit_logs a
       where a.organization_id is null and a.action = 'auth.password_reset_requested'
         and a.ip_hash = p_ip_hash and a.created_at > now() - interval '1 hour') >= 10 then
    return false;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, metadata, ip_hash)
  values (null, null, null, 'auth.password_reset_requested', 'email_hash', p_email_hash, '{}'::jsonb, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.auth_password_reset_allowed(text, text) from public, anon, authenticated;
grant execute on function public.auth_password_reset_allowed(text, text) to service_role;

create or replace function public.karay_schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20261010000001'::text $$;
revoke all on function public.karay_schema_version() from public;
grant execute on function public.karay_schema_version() to anon, authenticated, service_role;

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260929000001', 'platform_owner_isolation'),
  ('20260930000001', 'session_context_and_indexes'),
  ('20260930000002', 'site_builder'),
  ('20261001000001', 'site_brand_publish'),
  ('20261002000001', 'karay_platform'),
  ('20261004000001', 'design_family_access'),
  ('20261005000001', 'office_site_management'),
  ('20261006000001', 'brand_content_draft'),
  ('20261007000001', 'seo_draft'),
  ('20261008000001', 'owner_invitations'),
  ('20261009000001', 'custom_domains'),
  ('20261010000001', 'password_reset_requests')
on conflict (version) do nothing;

-- API şema önbelleğini yenile
notify pgrst, 'reload schema';
