-- =============================================================================
-- V2 / 2 — Çok kiracılı (multi-tenant) temel yapı
--
-- Her emlak ofisi bir "organization"dır. Kullanıcılar organizasyonlara rol ile
-- üye olur; tüm yetki kontrolleri merkezi role_permissions tablosundan okunur.
-- Elvankent Gayrimenkul, mevcut (V1) verinin taşındığı VARSAYILAN kiracıdır.
--
-- Bu migration V1'in tüm RLS politikalarını kaldırır; yeni, kiracı-kapsamlı
-- politikalar 20260926000007_v2_security.sql içinde oluşturulur. Aradaki
-- migration'lar aynı dağıtımda uygulandığından tablolar arada "kapalı"
-- (politikasız RLS = erişim yok) kalır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- V1 politikalarını ve V1'e özgü fonksiyonları kaldır
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

drop policy if exists "site_images_admin_select" on storage.objects;
drop policy if exists "site_images_admin_insert" on storage.objects;
drop policy if exists "site_images_admin_update" on storage.objects;
drop policy if exists "site_images_admin_delete" on storage.objects;

drop function if exists public.admin_dashboard_stats(integer);
drop function if exists public.submit_contact_request(text, text, text, text, uuid, text, boolean, text, text);
drop function if exists public.track_property_event(uuid, public.property_event_type, text);
drop function if exists public.region_listing_counts();
drop function if exists public.is_admin();

-- -----------------------------------------------------------------------------
-- Enum tipleri
-- -----------------------------------------------------------------------------
create type public.org_status as enum ('active', 'suspended', 'cancelled');
create type public.org_role as enum ('owner', 'admin', 'agent', 'editor', 'viewer');
create type public.member_status as enum ('active', 'disabled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');

-- -----------------------------------------------------------------------------
-- Planlar (SaaS abonelik altyapısı). NULL limit = sınırsız.
-- Ödeme entegrasyonu henüz yok; fiyat alanı bilinçli olarak boş bırakılabilir.
-- -----------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 300),
  max_users integer check (max_users > 0),
  max_properties integer check (max_properties > 0),
  max_storage_mb integer check (max_storage_mb > 0),
  crm_enabled boolean not null default false,
  analytics_enabled boolean not null default false,
  pdf_enabled boolean not null default false,
  custom_domain_enabled boolean not null default false,
  price_monthly numeric(10, 2) check (price_monthly >= 0),
  currency public.currency_code not null default 'TRY',
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Organizasyonlar (kiracılar)
-- reference_prefix: insan tarafından okunabilir ilan numarasının öneki (EKG-2026-0001)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  name text not null check (char_length(name) between 2 and 120),
  reference_prefix text not null unique check (reference_prefix ~ '^[A-Z]{2,5}$'),
  status public.org_status not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_single_default_idx on public.organizations (is_default) where is_default;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- Özel alan adları (ör. emlakci1.com) — ileride domain doğrulaması eklenecek
create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hostname text not null unique check (
    hostname = lower(hostname)
    and char_length(hostname) between 4 and 253
    and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_domains_org_idx on public.organization_domains (organization_id);
create unique index organization_domains_one_primary_idx on public.organization_domains (organization_id) where is_primary;

-- Abonelikler: organizasyon başına tek "geçerli" abonelik
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id) on update cascade on delete restrict,
  status public.subscription_status not null default 'trialing',
  started_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  renewal_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_org_idx on public.subscriptions (organization_id, created_at desc);
create unique index subscriptions_one_current_idx on public.subscriptions (organization_id)
  where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Üyelikler ve merkezi yetki tablosu
-- -----------------------------------------------------------------------------
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null,
  status public.member_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role public.org_role not null,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (role, permission)
);

-- Uygulamadaki src/platform/auth/permissions.ts ile birebir aynı tutulur
-- (tests/security/permissions.test.mjs bunu doğrular).
insert into public.role_permissions (role, permission)
select r.role::public.org_role, p.permission
from (values
  ('owner'), ('admin'), ('agent'), ('editor'), ('viewer')
) as r(role)
cross join lateral (
  select unnest(case r.role
    when 'owner' then array[
      'properties.read', 'properties.create', 'properties.update', 'properties.publish', 'properties.delete',
      'media.manage', 'leads.read', 'leads.create', 'leads.update', 'leads.delete',
      'appointments.read', 'appointments.manage', 'collections.manage', 'content.manage', 'seo.manage',
      'settings.manage', 'users.manage', 'analytics.read', 'audit.read', 'data.export', 'billing.manage']
    when 'admin' then array[
      'properties.read', 'properties.create', 'properties.update', 'properties.publish', 'properties.delete',
      'media.manage', 'leads.read', 'leads.create', 'leads.update', 'leads.delete',
      'appointments.read', 'appointments.manage', 'collections.manage', 'content.manage', 'seo.manage',
      'settings.manage', 'users.manage', 'analytics.read', 'audit.read', 'data.export']
    when 'agent' then array[
      'properties.read', 'properties.create', 'properties.update', 'properties.publish',
      'media.manage', 'leads.read', 'leads.create', 'leads.update',
      'appointments.read', 'appointments.manage', 'collections.manage', 'analytics.read']
    when 'editor' then array[
      'properties.read', 'properties.create', 'properties.update',
      'media.manage', 'content.manage', 'seo.manage']
    when 'viewer' then array[
      'properties.read', 'leads.read', 'appointments.read', 'analytics.read']
  end) as permission
) as p;

-- -----------------------------------------------------------------------------
-- Organizasyon bazlı sayaçlar (ilan numarası: PREFIX-YIL-SIRA)
-- -----------------------------------------------------------------------------
create table public.organization_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope text not null check (scope ~ '^[a-z_]+$'),
  period integer not null check (period between 2000 and 2999),
  value integer not null default 0 check (value >= 0),
  primary key (organization_id, scope, period)
);

-- Eşzamanlı eklemelerde bile çakışmasız artan sayaç (satır kilidi ile)
create or replace function public.next_org_counter(p_org uuid, p_scope text, p_period integer)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.organization_counters as c (organization_id, scope, period, value)
  values (p_org, p_scope, p_period, 1)
  on conflict (organization_id, scope, period) do update set value = c.value + 1
  returning c.value;
$$;

-- -----------------------------------------------------------------------------
-- Profiller: platform rolü (SUPER_ADMIN) ve ilk girişte şifre değişimi
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column is_super_admin boolean not null default false,
  add column password_change_required boolean not null default false;

-- -----------------------------------------------------------------------------
-- Yetki fonksiyonları (RLS politikalarında kullanılır)
--
-- Performans: politikalar "organization_id in (select public.user_org_ids(...))"
-- biçiminde yazılır; alt sorgu satır başına değil sorgu başına bir kez çalışır.
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.active_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizations o where o.status = 'active';
$$;

create or replace function public.user_org_ids(p_permission text default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.status = 'active'
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and (
       p_permission is null
       or exists (
         select 1 from public.role_permissions rp
          where rp.role = m.role and rp.permission = p_permission
       )
     );
$$;

create or replace function public.has_org_permission(p_org uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_org_ids(p_permission) as x(id) where x.id = p_org);
$$;

-- Plan özellikleri (geçerli abonelik yoksa tüm özellikler kapalı, limitler 1)
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
         p.crm_enabled, p.analytics_enabled, p.pdf_enabled, p.custom_domain_enabled
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
   where s.organization_id = p_org
     and s.status in ('trialing', 'active', 'past_due')
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Üyelik güvenlik kuralları (veritabanında zorunlu):
--  • Kullanıcı kendi rolünü/durumunu değiştiremez, kendini çıkaramaz.
--  • Sadece OWNER, OWNER rolü atayabilir veya bir OWNER'ı değiştirebilir/çıkarabilir.
--  • Son aktif OWNER düşürülemez / devre dışı bırakılamaz / çıkarılamaz.
--  • Plan kullanıcı limiti aşılamaz.
-- Sunucu tarafı ayrıcalıklı işlemler (service_role, auth.uid() yok) bu
-- kontrollerin yalnızca plan limitine tabidir.
-- -----------------------------------------------------------------------------
create or replace function public.organization_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.org_role;
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_target_user uuid := coalesce(new.user_id, old.user_id);
  v_max_users integer;
  v_active_count integer;
begin
  -- Plan limiti (aktif üye sayısı)
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'active'
     and (tg_op = 'INSERT' or old.status <> 'active') then
    select max_users into v_max_users from public.org_plan(v_org);
    if v_max_users is not null then
      select count(*) into v_active_count from public.organization_members
       where organization_id = v_org and status = 'active';
      if v_active_count >= v_max_users then
        raise exception 'plan_limit_users' using errcode = 'P0001',
          hint = 'Planınızın kullanıcı limitine ulaşıldı.';
      end if;
    end if;
  end if;

  if v_actor is null then
    return coalesce(new, old);
  end if;

  if v_actor = v_target_user then
    raise exception 'cannot_modify_self' using errcode = '42501',
      hint = 'Kendi rolünüzü veya üyeliğinizi değiştiremezsiniz.';
  end if;

  select m.role into v_actor_role from public.organization_members m
   where m.organization_id = v_org and m.user_id = v_actor and m.status = 'active';

  if v_actor_role is distinct from 'owner' and (
       (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
    or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner')
  ) then
    raise exception 'owner_required' using errcode = '42501',
      hint = 'Sahip (owner) rolüyle ilgili işlemleri yalnızca bir sahip yapabilir.';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    if (select count(*) from public.organization_members
         where organization_id = v_org and role = 'owner' and status = 'active') <= 1 then
      raise exception 'last_owner' using errcode = '42501',
        hint = 'Organizasyonun en az bir aktif sahibi olmalıdır.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_guard
  before insert or update or delete on public.organization_members
  for each row execute function public.organization_members_guard();

-- -----------------------------------------------------------------------------
-- Organizasyon ayarları (white-label): marka, iletişim, SEO, görünüm
-- -----------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  legal_name text check (char_length(legal_name) <= 160),
  tagline text check (char_length(tagline) <= 160),
  description text check (char_length(description) <= 2000),
  service_area text check (char_length(service_area) <= 160),
  logo_url text check (char_length(logo_url) <= 500),
  favicon_url text check (char_length(favicon_url) <= 500),
  primary_color text not null default '#0e4d45' check (primary_color ~ '^#[0-9a-f]{6}$'),
  accent_color text not null default '#b5813a' check (accent_color ~ '^#[0-9a-f]{6}$'),
  phone text check (char_length(phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  email text check (char_length(email) <= 160),
  address_line text check (char_length(address_line) <= 240),
  address_district text check (char_length(address_district) <= 80),
  address_city text check (char_length(address_city) <= 80),
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  office_latitude numeric(9, 6) check (office_latitude between -90 and 90),
  office_longitude numeric(9, 6) check (office_longitude between -180 and 180),
  opening_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(opening_hours) = 'array'),
  working_hours_note text check (char_length(working_hours_note) <= 300),
  instagram_url text check (char_length(instagram_url) <= 300),
  facebook_url text check (char_length(facebook_url) <= 300),
  x_url text check (char_length(x_url) <= 300),
  youtube_url text check (char_length(youtube_url) <= 300),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  tiktok_url text check (char_length(tiktok_url) <= 300),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  og_image_url text check (char_length(og_image_url) <= 500),
  google_site_verification text check (google_site_verification ~ '^[A-Za-z0-9_-]{10,100}$'),
  hero_title text check (char_length(hero_title) <= 120),
  hero_subtitle text check (char_length(hero_subtitle) <= 240),
  hero_image_url text check (char_length(hero_image_url) <= 500),
  default_location_precision public.location_precision not null default 'approximate',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger organization_settings_updated_at before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Planlar ve varsayılan kiracı (Elvankent Gayrimenkul)
-- -----------------------------------------------------------------------------
insert into public.plans (id, name, description, max_users, max_properties, max_storage_mb,
  crm_enabled, analytics_enabled, pdf_enabled, custom_domain_enabled, is_public, sort_order)
values
  ('baslangic', 'Başlangıç', 'Tek ofis, temel ilan yönetimi.', 3, 50, 2048, false, true, false, false, true, 10),
  ('profesyonel', 'Profesyonel', 'CRM, analitik ve PDF broşür dahil.', 10, 300, 10240, true, true, true, false, true, 20),
  ('kurumsal', 'Kurumsal', 'Sınırsız ilan ve kullanıcı, özel alan adı.', null, null, 51200, true, true, true, true, true, 30)
on conflict (id) do nothing;

insert into public.organizations (slug, name, reference_prefix, status, is_default)
values ('elvankent', 'Elvankent Gayrimenkul', 'EKG', 'active', true)
on conflict (slug) do nothing;

insert into public.subscriptions (organization_id, plan_id, status, started_at)
select o.id, 'kurumsal', 'active', now()
  from public.organizations o
 where o.slug = 'elvankent'
   and not exists (select 1 from public.subscriptions s where s.organization_id = o.id);

-- V1 site_settings → varsayılan kiracının ayarları
insert into public.organization_settings (
  organization_id, display_name, tagline, description, service_area, logo_url, phone, whatsapp, email,
  address_line, working_hours_note, office_latitude, office_longitude,
  instagram_url, facebook_url, x_url, youtube_url, linkedin_url
)
select o.id,
       coalesce(left(s.business_name, 80), o.name),
       left(s.tagline, 160),
       left(split_part(coalesce(s.about_text, ''), E'\n\n', 1), 2000),
       'Etimesgut, Elvankent, Eryaman ve Ankara genelinde',
       s.logo_url, s.phone, s.whatsapp, s.email,
       left(s.address, 240), left(s.working_hours, 300), s.office_latitude, s.office_longitude,
       s.instagram_url, s.facebook_url, s.x_url, s.youtube_url, s.linkedin_url
  from public.organizations o
  left join public.site_settings s on s.id = 1
 where o.slug = 'elvankent'
on conflict (organization_id) do nothing;

update public.organization_settings
   set description = null
 where description = '';

-- V1 rolleri → varsayılan kiracı üyelikleri (admin → owner, agent → agent)
insert into public.organization_members (organization_id, user_id, role, status)
select o.id, p.id,
       case p.role when 'admin' then 'owner'::public.org_role else 'agent'::public.org_role end,
       'active'
  from public.profiles p
  cross join public.organizations o
 where o.slug = 'elvankent'
   and p.role in ('admin', 'agent')
on conflict do nothing;

alter table public.profiles drop column role;
drop type public.user_role;

-- -----------------------------------------------------------------------------
-- RLS: yeni tablolar varsayılan olarak kapalı (politikalar security migration'da)
-- -----------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_domains enable row level security;
alter table public.subscriptions enable row level security;
alter table public.organization_members enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_counters enable row level security;
alter table public.organization_settings enable row level security;
