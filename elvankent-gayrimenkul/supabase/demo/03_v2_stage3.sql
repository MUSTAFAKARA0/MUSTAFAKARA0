-- =============================================================================
-- DEMO KURULUM 3/4 — V2 + Stage 3
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
-- Otomatik üretildi (npm run demo:sql) — elle düzenlemeyin; kaynak: supabase/migrations
-- 02 başarıyla bittikten sonra, AYRI bir sorgu olarak çalıştırın.
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
-- 20260926000002_v2_tenancy.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 20260926000003_v2_properties.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 3 — İlanlar, medya, fiyat geçmişi
--
--  • Her ilan bir organizasyona aittir (organization_id). Bağlı tablolar
--    (konum, özellik, medya, istatistik, favori, yönlendirme) organizasyonu
--    ilandan TETİKLEYİCİ ile devralır; istemcinin gönderdiği değer yok sayılır.
--  • İnsan tarafından okunabilir benzersiz ilan numarası: EKG-2026-0001
--  • Slug: organizasyon içinde benzersiz, ilan numarası eki yok; slug
--    değişince eski adres otomatik 308 yönlendirmesi olur.
--  • Taslaklar eksik olabilir; yayın kontrol listesi veritabanında zorunludur.
--  • Kontrollü durum geçişleri, soft delete, fiyat geçmişi ("Fiyat düştü").
--  • property_images → media_assets: orijinal + varyant yolları ve metadata.
-- =============================================================================

-- V1 tetikleyicisi slug'a ilan numarası ekliyor ve eski durum adlarını kullanıyordu;
-- veri dönüşümünden önce kaldırılır, dosyanın sonunda yeniden yazılır.
drop trigger if exists properties_before_write on public.properties;
drop function if exists public.properties_before_write();

create type public.media_kind as enum ('property_photo', 'post_cover', 'general');
create type public.media_status as enum ('pending', 'ready', 'failed');

-- -----------------------------------------------------------------------------
-- properties: organizasyon, referans no, soft delete, yeni alanlar
-- -----------------------------------------------------------------------------
alter table public.properties
  add column organization_id uuid references public.organizations (id) on delete cascade,
  add column reference_no text,
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add column updated_by uuid references auth.users (id) on delete set null,
  add column status_changed_at timestamptz,
  add column show_on_homepage boolean not null default false,
  add column investment_suitable boolean,
  add column seo_title text check (char_length(seo_title) <= 70),
  add column price_previous numeric(14, 2) check (price_previous >= 0),
  add column price_changed_at timestamptz,
  add column price_dropped_at timestamptz;

update public.properties
   set organization_id = (select id from public.organizations where slug = 'elvankent')
 where organization_id is null;

alter table public.properties alter column organization_id set not null;

-- Taslaklar eksik kaydedilebilir; yayın için gereken alanlar tetikleyicide kontrol edilir
alter table public.properties
  alter column description drop not null,
  alter column price drop not null,
  alter column city_id drop not null,
  alter column district_id drop not null;

alter table public.properties drop constraint if exists properties_title_check;
alter table public.properties add constraint properties_title_check check (char_length(title) between 3 and 120);
alter table public.properties drop constraint if exists properties_description_check;
alter table public.properties add constraint properties_description_check check (char_length(description) <= 10000);

-- meta_description → seo_description (en fazla 200 karakter)
alter table public.properties rename column meta_description to seo_description;
alter table public.properties drop constraint if exists properties_meta_description_check;
update public.properties set seo_description = left(seo_description, 200) where char_length(seo_description) > 200;
alter table public.properties add constraint properties_seo_description_check check (char_length(seo_description) <= 200);

-- -----------------------------------------------------------------------------
-- Kontrollü değer listeleri: serbest metin → kod (filtrelenebilir, çevrilebilir)
-- -----------------------------------------------------------------------------
update public.properties set heating = case heating
    when 'Kombi (Doğalgaz)' then 'kombi-dogalgaz'
    when 'Merkezi' then 'merkezi'
    when 'Merkezi (Pay ölçer)' then 'merkezi-pay-olcer'
    when 'Yerden ısıtma' then 'yerden-isitma'
    when 'Klima' then 'klima'
    when 'Soba' then 'soba'
    when 'Isı pompası' then 'isi-pompasi'
    when 'Güneş enerjisi' then 'gunes-enerjisi'
    when 'Yok' then 'yok'
    else 'diger' end
 where heating is not null;

update public.properties set parking = case parking
    when 'Yok' then 'yok'
    when 'Açık otopark' then 'acik'
    when 'Kapalı otopark' then 'kapali'
    when 'Açık & kapalı otopark' then 'acik-kapali'
    else 'acik' end
 where parking is not null;

update public.properties set deed_status = case deed_status
    when 'Kat mülkiyeti' then 'kat-mulkiyeti'
    when 'Kat irtifakı' then 'kat-irtifaki'
    when 'Hisseli tapu' then 'hisseli-tapu'
    when 'Müstakil tapulu' then 'mustakil-tapu'
    when 'Arsa tapulu' then 'arsa-tapulu'
    when 'Kooperatif hisseli' then 'kooperatif'
    when 'Tapu kaydı yok' then 'tapu-yok'
    else 'diger' end
 where deed_status is not null;

update public.properties set usage_status = case usage_status
    when 'Boş' then 'bos'
    when 'Kiracılı' then 'kiracili'
    when 'Mülk sahibi' then 'mulk-sahibi'
    else null end
 where usage_status is not null;

update public.properties set zoning_status = case zoning_status
    when 'Konut' then 'konut'
    when 'Ticari' then 'ticari'
    when 'Konut + Ticari' then 'konut-ticari'
    when 'Sanayi' then 'sanayi'
    when 'Tarla' then 'tarla'
    when 'Bağ & Bahçe' then 'bag-bahce'
    when 'Turizm' then 'turizm'
    else 'diger' end
 where zoning_status is not null;

update public.properties set floor = case
    when floor ~ '^[0-9]{1,3}$' then floor
    when floor = 'Bodrum kat' then 'bodrum'
    when floor = 'Kot 1' then 'kot-1'
    when floor = 'Kot 2' then 'kot-2'
    when floor = 'Kot 3' then 'kot-3'
    when floor = 'Bahçe katı' then 'bahce'
    when floor = 'Zemin' then 'zemin'
    when floor = 'Giriş katı' then 'giris'
    when floor = 'Yüksek giriş' then 'yuksek-giris'
    when floor = 'Villa katı' then 'villa'
    when floor = 'Çatı katı' then 'cati'
    else null end
 where floor is not null;

update public.properties set facades = coalesce(array(
    select case f when 'Kuzey' then 'kuzey' when 'Güney' then 'guney' when 'Doğu' then 'dogu' when 'Batı' then 'bati' end
      from unnest(facades) as f
     where f in ('Kuzey', 'Güney', 'Doğu', 'Batı')
  ), '{}');

update public.properties set views = coalesce(array(
    select case v when 'Şehir' then 'sehir' when 'Doğa' then 'doga' when 'Park' then 'park'
                  when 'Göl' then 'gol' when 'Dağ' then 'dag' when 'Cadde' then 'cadde' when 'Deniz' then 'deniz' end
      from unnest(views) as v
     where v in ('Şehir', 'Doğa', 'Park', 'Göl', 'Dağ', 'Cadde', 'Deniz')
  ), '{}');

alter table public.properties
  drop constraint if exists properties_heating_check,
  drop constraint if exists properties_parking_check,
  drop constraint if exists properties_deed_status_check,
  drop constraint if exists properties_usage_status_check,
  drop constraint if exists properties_zoning_status_check,
  drop constraint if exists properties_floor_check;

alter table public.properties
  add constraint properties_heating_check check (heating in (
    'kombi-dogalgaz', 'merkezi', 'merkezi-pay-olcer', 'yerden-isitma', 'klima', 'soba',
    'isi-pompasi', 'gunes-enerjisi', 'yok', 'diger')),
  add constraint properties_parking_check check (parking in ('yok', 'acik', 'kapali', 'acik-kapali')),
  add constraint properties_deed_status_check check (deed_status in (
    'kat-mulkiyeti', 'kat-irtifaki', 'hisseli-tapu', 'mustakil-tapu', 'arsa-tapulu', 'kooperatif', 'tapu-yok', 'diger')),
  add constraint properties_usage_status_check check (usage_status in ('bos', 'kiracili', 'mulk-sahibi')),
  add constraint properties_zoning_status_check check (zoning_status in (
    'konut', 'ticari', 'konut-ticari', 'sanayi', 'tarla', 'bag-bahce', 'turizm', 'diger')),
  add constraint properties_floor_check check (
    floor ~ '^[0-9]{1,3}$'
    or floor in ('bodrum', 'kot-1', 'kot-2', 'kot-3', 'bahce', 'zemin', 'giris', 'yuksek-giris', 'villa', 'cati')),
  add constraint properties_facades_check check (facades <@ array['kuzey', 'guney', 'dogu', 'bati']),
  add constraint properties_views_check check (views <@ array['sehir', 'doga', 'park', 'gol', 'dag', 'cadde', 'deniz']);

-- Kat filtresi: giriş / ara / en üst / bodrum (kat kodu ve toplam kattan türetilir)
alter table public.properties add column floor_position text generated always as (
  case
    when floor is null then null
    when floor in ('zemin', 'giris', 'bahce', 'yuksek-giris', 'villa') then 'giris'
    when floor in ('bodrum', 'kot-1', 'kot-2', 'kot-3') then 'bodrum'
    when floor = 'cati' then 'ust'
    when floor ~ '^[0-9]{1,3}$' and total_floors is not null and floor::integer >= total_floors then 'ust'
    when floor ~ '^[0-9]{1,3}$' then 'ara'
    else null
  end
) stored;

-- -----------------------------------------------------------------------------
-- Referans numarası (EKG-2026-0001) — organizasyon ve yıl bazında sıralı
-- -----------------------------------------------------------------------------
with numbered as (
  select p.id,
         o.reference_prefix,
         extract(year from p.created_at)::int as yr,
         row_number() over (partition by p.organization_id, extract(year from p.created_at) order by p.created_at, p.listing_no) as n
    from public.properties p
    join public.organizations o on o.id = p.organization_id
)
update public.properties p
   set reference_no = numbered.reference_prefix || '-' || numbered.yr || '-' || lpad(numbered.n::text, 4, '0')
  from numbered
 where numbered.id = p.id;

insert into public.organization_counters (organization_id, scope, period, value)
select organization_id, 'property', extract(year from created_at)::int, count(*)
  from public.properties
 group by organization_id, extract(year from created_at)::int
on conflict (organization_id, scope, period) do update set value = greatest(public.organization_counters.value, excluded.value);

alter table public.properties alter column reference_no set not null;
alter table public.properties add constraint properties_reference_no_key unique (reference_no);
alter table public.properties add constraint properties_reference_no_check check (reference_no ~ '^[A-Z]{2,5}-[0-9]{4}-[0-9]{4,}$');

-- -----------------------------------------------------------------------------
-- Yönlendirmeler: organizasyon kapsamlı
-- -----------------------------------------------------------------------------
alter table public.redirects add column organization_id uuid references public.organizations (id) on delete cascade;
update public.redirects set organization_id = (select id from public.organizations where slug = 'elvankent') where organization_id is null;
alter table public.redirects alter column organization_id set not null;
alter table public.redirects drop constraint if exists redirects_from_path_key;
alter table public.redirects add constraint redirects_org_from_path_key unique (organization_id, from_path);

-- -----------------------------------------------------------------------------
-- Slug: V1'deki "-100001" ekini kaldır, organizasyon içinde benzersiz yap,
-- eski adresler için kalıcı yönlendirme ekle.
-- -----------------------------------------------------------------------------
with stripped as (
  select id, organization_id, slug as old_slug, created_at,
         coalesce(nullif(regexp_replace(regexp_replace(slug, '-' || listing_no::text || '$', ''), '-+$', ''), ''), 'ilan') as base
    from public.properties
),
ranked as (
  select *, row_number() over (partition by organization_id, base order by created_at, id) as rn
    from stripped
)
update public.properties p
   set slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
  from ranked r
 where r.id = p.id;

insert into public.redirects (organization_id, from_path, to_path, status_code)
select p.organization_id, '/ilan/' || p.slug || '-' || p.listing_no, '/ilan/' || p.slug, 308
  from public.properties p
on conflict (organization_id, from_path) do update set to_path = excluded.to_path, status_code = 308;

alter table public.properties drop constraint if exists properties_slug_key;
alter table public.properties add constraint properties_org_slug_key unique (organization_id, slug);

alter table public.properties drop column listing_no;
drop sequence if exists public.property_listing_no_seq;

-- -----------------------------------------------------------------------------
-- İndeksler (organizasyon önekli)
-- -----------------------------------------------------------------------------
drop index if exists public.properties_public_idx;
drop index if exists public.properties_price_idx;
drop index if exists public.properties_district_idx;
drop index if exists public.properties_neighborhood_idx;
drop index if exists public.properties_featured_idx;
drop index if exists public.properties_type_idx;

create index properties_org_status_idx on public.properties (organization_id, status, published_at desc) where deleted_at is null;
create index properties_org_search_idx on public.properties (organization_id, listing_type, category, price) where deleted_at is null and status = 'published';
create index properties_org_location_idx on public.properties (organization_id, district_id, neighborhood_id) where deleted_at is null;
create index properties_org_created_idx on public.properties (organization_id, created_at desc);
create index properties_org_featured_idx on public.properties (organization_id, published_at desc)
  where deleted_at is null and status = 'published' and (is_featured or show_on_homepage);
create index properties_org_deleted_idx on public.properties (organization_id, deleted_at desc) where deleted_at is not null;
create index properties_type_idx on public.properties (property_type_id);

-- -----------------------------------------------------------------------------
-- Türkçe karakterleri normalize eden slug üretici (uygulamadaki slugify ile aynı
-- kurallar: ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u; harf/rakam dışı her şey "-").
-- -----------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from left(regexp_replace(
    translate(lower(replace(replace(coalesce(p_text, ''), 'İ', 'i'), 'I', 'ı')), 'çğıöşüâîûéë', 'cgiosuaiuee'),
    '[^a-z0-9]+', '-', 'g'), 120));
$$;

-- Organizasyon içinde benzersiz slug: çakışmada -2, -3 ... eklenir
create or replace function public.unique_slug(p_table text, p_org uuid, p_slug text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := coalesce(nullif(public.slugify(p_slug), ''), 'icerik');
  v_candidate text := v_base;
  v_n integer := 2;
  v_taken boolean;
begin
  loop
    execute format('select exists (select 1 from public.%I where organization_id = $1 and slug = $2 and id is distinct from $3)', p_table)
      into v_taken using p_org, v_candidate, p_id;
    exit when not v_taken;
    v_candidate := trim(both '-' from left(v_base, 114)) || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return v_candidate;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ana ilan tetikleyicisi: organizasyon kilidi, referans no, kategori,
-- konum tutarlılığı, durum geçişleri, yayın kontrol listesi, soft delete.
-- -----------------------------------------------------------------------------
create or replace function public.properties_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_prefix text;
  v_year integer;
  v_missing text[] := '{}';
  v_allowed boolean;
  v_max integer;
begin
  if tg_op = 'INSERT' then
    if v_actor is not null then
      new.published_at := null;
      new.price_previous := null;
      new.price_changed_at := null;
      new.price_dropped_at := null;
      new.deleted_at := null;
      new.deleted_by := null;
    end if;
    if v_actor is not null and new.status not in ('draft', 'pending') then
      raise exception 'invalid_initial_status' using errcode = 'P0001',
        hint = 'Yeni ilan taslak olarak oluşturulur; yayın kontrol listesinden sonra yayınlanır.';
    end if;

    select max_properties into v_max from public.org_plan(new.organization_id);
    if v_max is not null and (
      select count(*) from public.properties
       where organization_id = new.organization_id and deleted_at is null
    ) >= v_max then
      raise exception 'plan_limit_properties' using errcode = 'P0001',
        hint = 'Planınızın ilan limitine ulaşıldı.';
    end if;

    select reference_prefix into v_prefix from public.organizations where id = new.organization_id;
    v_year := extract(year from now())::int;
    new.reference_no := v_prefix || '-' || v_year || '-'
      || lpad(public.next_org_counter(new.organization_id, 'property', v_year)::text, 4, '0');
    new.created_by := coalesce(new.created_by, v_actor);
    new.status_changed_at := now();
  else
    if new.organization_id <> old.organization_id then
      raise exception 'organization_immutable' using errcode = '42501';
    end if;
    if new.reference_no <> old.reference_no then
      raise exception 'reference_no_immutable' using errcode = '42501';
    end if;
    -- Sistem tarafından yönetilen alanlar istemciden değiştirilemez
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.published_at := old.published_at;
    new.status_changed_at := old.status_changed_at;
    new.price_previous := old.price_previous;
    new.price_changed_at := old.price_changed_at;
    new.price_dropped_at := old.price_dropped_at;
    new.deleted_by := old.deleted_by;
    new.updated_by := coalesce(v_actor, new.updated_by);

    -- Çöp kutusundaki ilan düzenlenemez; yalnızca geri yüklenebilir
    if old.deleted_at is not null and new.deleted_at is not null then
      raise exception 'property_deleted' using errcode = 'P0001',
        hint = 'Bu ilan çöp kutusunda. Düzenlemek için önce geri yükleyin.';
    end if;
    if (old.deleted_at is null) <> (new.deleted_at is null) then
      if v_actor is not null and not public.has_org_permission(new.organization_id, 'properties.delete') then
        raise exception 'delete_forbidden' using errcode = '42501';
      end if;
      new.deleted_by := case when new.deleted_at is null then null else v_actor end;
    end if;
  end if;

  -- Slug: boşsa başlıktan üretilir; organizasyon içinde benzersiz yapılır
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.slugify(new.title);
  end if;
  if tg_op = 'INSERT' or new.slug <> old.slug then
    new.slug := public.unique_slug('properties', new.organization_id, coalesce(nullif(new.slug, ''), 'ilan'), new.id);
  end if;

  -- Kategori emlak tipinden gelir
  select pt.category into new.category from public.property_types pt where pt.id = new.property_type_id;
  if new.category is null then
    raise exception 'invalid_property_type' using errcode = '23503';
  end if;

  -- Konum tutarlılığı (il > ilçe > mahalle)
  if new.district_id is not null and not exists (
    select 1 from public.districts d where d.id = new.district_id and d.city_id = new.city_id
  ) then
    raise exception 'district_city_mismatch' using errcode = '23514', hint = 'İlçe seçilen ile ait değil.';
  end if;
  if new.neighborhood_id is not null and not exists (
    select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.district_id = new.district_id
  ) then
    raise exception 'neighborhood_district_mismatch' using errcode = '23514', hint = 'Mahalle seçilen ilçeye ait değil.';
  end if;

  -- Durum geçişleri
  if tg_op = 'UPDATE' and new.status <> old.status then
    v_allowed := case old.status
      when 'draft' then new.status in ('pending', 'published', 'archived')
      when 'pending' then new.status in ('draft', 'published', 'archived')
      when 'published' then new.status in ('draft', 'pending', 'sold', 'rented', 'archived')
      when 'sold' then new.status in ('published', 'archived')
      when 'rented' then new.status in ('published', 'archived')
      when 'archived' then new.status in ('draft', 'published')
      else false
    end;
    if not v_allowed then
      raise exception 'invalid_status_transition' using errcode = 'P0001',
        hint = format('"%s" durumundan "%s" durumuna geçilemez.', old.status, new.status);
    end if;
    -- Herkese açık görünürlüğü değiştiren geçişler yayın yetkisi ister
    if v_actor is not null
       and (old.status in ('published', 'sold', 'rented') or new.status in ('published', 'sold', 'rented'))
       and not public.has_org_permission(new.organization_id, 'properties.publish') then
      raise exception 'publish_forbidden' using errcode = '42501',
        hint = 'Yayındaki ilanların durumunu değiştirme yetkiniz yok.';
    end if;
    new.status_changed_at := now();
  end if;

  if new.status = 'sold' and new.listing_type <> 'sale' then
    raise exception 'sold_requires_sale' using errcode = 'P0001', hint = 'Yalnızca satılık ilanlar "Satıldı" olarak işaretlenebilir.';
  end if;
  if new.status = 'rented' and new.listing_type <> 'rent' then
    raise exception 'rented_requires_rent' using errcode = 'P0001', hint = 'Yalnızca kiralık ilanlar "Kiralandı" olarak işaretlenebilir.';
  end if;

  -- Yayın: yetki + kontrol listesi (uygulamadaki checklist ile aynı kurallar)
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if v_actor is not null and not public.has_org_permission(new.organization_id, 'properties.publish') then
      raise exception 'publish_forbidden' using errcode = '42501',
        hint = 'İlanı yayınlama yetkiniz yok. "Onaya gönder" seçeneğini kullanın.';
    end if;
    if char_length(coalesce(new.title, '')) < 10 then v_missing := array_append(v_missing, 'title'); end if;
    if char_length(coalesce(new.description, '')) < 50 then v_missing := array_append(v_missing, 'description'); end if;
    if coalesce(new.price, 0) <= 0 then v_missing := array_append(v_missing, 'price'); end if;
    if new.city_id is null or new.district_id is null then v_missing := array_append(v_missing, 'location'); end if;
    if tg_op = 'UPDATE' and not exists (
      select 1 from public.media_assets m
       where m.property_id = new.id and m.status = 'ready'
    ) then
      v_missing := array_append(v_missing, 'photo');
    end if;
    if cardinality(v_missing) > 0 then
      raise exception 'publish_checklist' using errcode = 'P0001',
        detail = array_to_string(v_missing, ','),
        hint = 'Yayınlamadan önce eksik alanları tamamlayın.';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;

  -- Fiyat değişimi: "Fiyat düştü" rozeti için önceki fiyat ve tarih
  if tg_op = 'UPDATE' and new.price is distinct from old.price and old.price is not null and new.price is not null then
    new.price_previous := old.price;
    new.price_changed_at := now();
    new.price_dropped_at := case
      when new.currency = old.currency and new.price < old.price then now()
      else null
    end;
  end if;

  return new;
end;
$$;

create trigger properties_before_write before insert or update on public.properties
  for each row execute function public.properties_before_write();

-- -----------------------------------------------------------------------------
-- Fiyat geçmişi
-- -----------------------------------------------------------------------------
create table public.property_price_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  old_price numeric(14, 2),
  new_price numeric(14, 2) not null,
  currency public.currency_code not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index property_price_history_property_idx on public.property_price_history (property_id, changed_at desc);

create or replace function public.properties_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Fiyat geçmişi
  if new.price is not null and (tg_op = 'INSERT' or new.price is distinct from old.price or new.currency <> old.currency) then
    insert into public.property_price_history (organization_id, property_id, old_price, new_price, currency, changed_by)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.price end, new.price, new.currency, (select auth.uid()));
  end if;

  -- Slug değişti: eski adresi yeni adrese kalıcı yönlendir, zincirleri düzleştir
  if tg_op = 'UPDATE' and new.slug <> old.slug then
    delete from public.redirects
     where organization_id = new.organization_id and from_path = '/ilan/' || new.slug;
    update public.redirects set to_path = '/ilan/' || new.slug
     where organization_id = new.organization_id and to_path = '/ilan/' || old.slug;
    if old.published_at is not null then
      insert into public.redirects (organization_id, from_path, to_path, status_code)
      values (new.organization_id, '/ilan/' || old.slug, '/ilan/' || new.slug, 308)
      on conflict (organization_id, from_path) do update set to_path = excluded.to_path, status_code = 308;
    end if;
  end if;
  return null;
end;
$$;

create trigger properties_after_write after insert or update on public.properties
  for each row execute function public.properties_after_write();

-- Kalıcı silme (çöp kutusundan): adres ilgili kategori sayfasına yönlenir
create or replace function public.properties_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text;
begin
  if old.published_at is null then
    return old;
  end if;
  v_target := case
    when old.category = 'arsa' then '/arsa'
    when old.category = 'ticari' then '/ticari'
    when old.listing_type = 'rent' then '/kiralik'
    else '/satilik'
  end;
  insert into public.redirects (organization_id, from_path, to_path, status_code)
  values (old.organization_id, '/ilan/' || old.slug, v_target, 301)
  on conflict (organization_id, from_path) do update set to_path = excluded.to_path, status_code = 301;
  update public.redirects set to_path = v_target
   where organization_id = old.organization_id and to_path = '/ilan/' || old.slug;
  return old;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bağlı tablolar: organization_id (ilandan devralınır)
-- -----------------------------------------------------------------------------
create or replace function public.inherit_property_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.property_id is null then
    if new.organization_id is null then
      raise exception 'organization_required' using errcode = '23502';
    end if;
    return new;
  end if;
  select p.organization_id into new.organization_id from public.properties p where p.id = new.property_id;
  if new.organization_id is null then
    raise exception 'invalid_property' using errcode = '23503';
  end if;
  return new;
end;
$$;

-- property_locations
alter table public.property_locations add column organization_id uuid references public.organizations (id) on delete cascade;
update public.property_locations l set organization_id = p.organization_id from public.properties p where p.id = l.property_id;
alter table public.property_locations alter column organization_id set not null;
create index property_locations_org_idx on public.property_locations (organization_id);
create trigger property_locations_org before insert or update on public.property_locations
  for each row execute function public.inherit_property_org();

-- property_features
alter table public.property_features add column organization_id uuid references public.organizations (id) on delete cascade;
update public.property_features f set organization_id = p.organization_id from public.properties p where p.id = f.property_id;
alter table public.property_features alter column organization_id set not null;
create index property_features_org_idx on public.property_features (organization_id);
create trigger property_features_org before insert or update on public.property_features
  for each row execute function public.inherit_property_org();

-- property_events
alter table public.property_events add column organization_id uuid references public.organizations (id) on delete cascade;
update public.property_events e set organization_id = p.organization_id from public.properties p where p.id = e.property_id;
alter table public.property_events alter column organization_id set not null;
drop index if exists public.property_events_created_idx;
create index property_events_org_created_idx on public.property_events (organization_id, created_at desc);
create index property_events_org_type_idx on public.property_events (organization_id, event_type, created_at desc);
create trigger property_events_org before insert on public.property_events
  for each row execute function public.inherit_property_org();

-- property_stats
alter table public.property_stats add column organization_id uuid references public.organizations (id) on delete cascade;
update public.property_stats s set organization_id = p.organization_id from public.properties p where p.id = s.property_id;
alter table public.property_stats alter column organization_id set not null;
create index property_stats_org_idx on public.property_stats (organization_id);
create trigger property_stats_org before insert on public.property_stats
  for each row execute function public.inherit_property_org();

-- favorites (giriş yapmış kullanıcılar)
alter table public.favorites add column organization_id uuid references public.organizations (id) on delete cascade;
update public.favorites f set organization_id = p.organization_id from public.properties p where p.id = f.property_id;
alter table public.favorites alter column organization_id set not null;
create index favorites_org_property_idx on public.favorites (organization_id, property_id);
create trigger favorites_org before insert on public.favorites
  for each row execute function public.inherit_property_org();

-- -----------------------------------------------------------------------------
-- Medya: property_images → media_assets
-- Depolama düzeni (bkz. 20260926000008_v2_storage.sql):
--   media-originals (özel):  organizations/{org}/properties/{property}/images/{id}/original.{ext}
--   media (herkese açık):     organizations/{org}/properties/{property}/images/{id}/w{genişlik}.webp
-- public_base '/' ile başlıyorsa varyantlar uygulamanın public/ klasöründedir (demo).
-- legacy_path: V1'de yüklenmiş tek dosyalık görseller ('property-images' kovası).
-- -----------------------------------------------------------------------------
alter table public.property_images rename to media_assets;
alter index public.property_images_property_idx rename to media_assets_property_idx;
alter index public.property_images_one_cover_idx rename to media_assets_one_cover_idx;
alter table public.media_assets rename constraint property_images_pkey to media_assets_pkey;
alter table public.media_assets rename constraint property_images_property_id_fkey to media_assets_property_id_fkey;
alter table public.media_assets rename constraint property_images_storage_path_check to media_assets_legacy_path_check;
alter table public.media_assets rename constraint property_images_width_check to media_assets_width_check;
alter table public.media_assets rename constraint property_images_height_check to media_assets_height_check;
alter table public.media_assets rename constraint property_images_blur_data_url_check to media_assets_blur_data_url_check;
alter table public.media_assets rename constraint property_images_alt_check to media_assets_alt_text_check;
alter table public.media_assets rename column alt to alt_text;
alter table public.media_assets rename column storage_path to legacy_path;
alter table public.media_assets alter column legacy_path drop not null;
alter table public.media_assets alter column property_id drop not null;

alter table public.media_assets
  add column organization_id uuid references public.organizations (id) on delete cascade,
  add column kind public.media_kind not null default 'property_photo',
  add column status public.media_status not null default 'ready',
  add column original_path text check (char_length(original_path) <= 400),
  add column public_base text check (char_length(public_base) <= 400),
  add column variant_widths smallint[] not null default '{}',
  add column mime_type text check (char_length(mime_type) <= 60),
  add column byte_size bigint check (byte_size >= 0),
  add column variants_byte_size bigint not null default 0 check (variants_byte_size >= 0),
  add column original_filename text check (char_length(original_filename) <= 200),
  add column error text check (char_length(error) <= 300),
  add column created_by uuid references auth.users (id) on delete set null,
  add column processed_at timestamptz,
  add column updated_at timestamptz not null default now();

update public.media_assets m set organization_id = p.organization_id from public.properties p where p.id = m.property_id;
alter table public.media_assets alter column organization_id set not null;

-- Demo illüstrasyonları: varyantlar public/demo/{ad}/w{genişlik}.webp altında
update public.media_assets
   set public_base = regexp_replace(legacy_path, '\.webp$', ''),
       variant_widths = '{320,640,960,1440,1920}',
       width = 1920,
       height = 1280,
       mime_type = 'image/webp',
       legacy_path = null
 where legacy_path like '/demo/%.webp';

alter table public.media_assets
  add constraint media_assets_ready_has_source check (status <> 'ready' or public_base is not null or legacy_path is not null),
  add constraint media_assets_property_kind check (kind <> 'property_photo' or property_id is not null);

create index media_assets_org_created_idx on public.media_assets (organization_id, created_at desc);
create index media_assets_status_idx on public.media_assets (status, created_at) where status <> 'ready';

create trigger media_assets_org before insert or update on public.media_assets
  for each row execute function public.inherit_property_org();
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

-- Kapak kaldırılır/silinirse ilk sıradaki hazır görsel kapak olur
create or replace function public.media_assets_ensure_cover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property uuid := coalesce(new.property_id, old.property_id);
begin
  if v_property is null then
    return null;
  end if;
  if not exists (select 1 from public.media_assets where property_id = v_property and is_cover) then
    update public.media_assets set is_cover = true
     where id = (
       select id from public.media_assets
        where property_id = v_property and status = 'ready'
        order by sort_order, created_at, id
        limit 1
     );
  end if;
  return null;
end;
$$;

-- Not: is_cover değişikliğinde tetiklenmez; kapak değişimi set_property_cover() ile
-- (önce eski kapak kaldırılır, sonra yenisi atanır) tek işlemde yapılır.
create trigger media_assets_ensure_cover after insert or delete or update of status on public.media_assets
  for each row execute function public.media_assets_ensure_cover();

-- Sosyal paylaşım görseli (ilan bazlı OG görseli; boşsa kapak kullanılır)
alter table public.properties add column og_media_id uuid references public.media_assets (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Konum senkronu: property_locations → properties (herkese açık koordinat)
-- (V1 ile aynı mantık; mahalle yoksa ilçe merkezi)
-- -----------------------------------------------------------------------------
create or replace function public.sync_public_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat numeric;
  v_lng numeric;
  v_hash integer;
begin
  if new.latitude is null or new.longitude is null or new.precision = 'neighborhood' then
    select coalesce(n.latitude, d.latitude), coalesce(n.longitude, d.longitude)
      into v_lat, v_lng
      from public.properties p
      left join public.districts d on d.id = p.district_id
      left join public.neighborhoods n on n.id = p.neighborhood_id
     where p.id = new.property_id;
    update public.properties
       set public_latitude = v_lat, public_longitude = v_lng, location_precision = 'neighborhood'
     where id = new.property_id;
  elsif new.precision = 'approximate' then
    -- İlana özgü, deterministik ~±200 m kaydırma: kesin adres açığa çıkmaz
    v_hash := abs(hashtext(new.property_id::text));
    v_lat := round(new.latitude + ((v_hash % 1000) / 1000.0 - 0.5) * 0.0036, 6);
    v_lng := round(new.longitude + (((v_hash / 1000) % 1000) / 1000.0 - 0.5) * 0.0046, 6);
    update public.properties
       set public_latitude = v_lat, public_longitude = v_lng, location_precision = 'approximate'
     where id = new.property_id;
  else
    update public.properties
       set public_latitude = new.latitude, public_longitude = new.longitude, location_precision = 'exact'
     where id = new.property_id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS: yeni tablolar
-- -----------------------------------------------------------------------------
alter table public.property_price_history enable row level security;

-- ---------------------------------------------------------------------------
-- 20260926000004_v2_crm.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 4 — Mini CRM: müşteriler, talepler (lead), aktiviteler, randevular,
-- müşteriye özel koleksiyonlar.
--
-- Model: Müşteri (kişi) ← birden çok Talep (ilgilendiği ilan, bütçe, durum,
-- kaynak). Web formları müşteriyi telefon/e-posta ile eşleştirir, yoksa
-- oluşturur. V1 contact_requests kayıtları bu yapıya taşınır.
-- =============================================================================

create type public.lead_status as enum ('new', 'contacted', 'meeting', 'appointment', 'follow_up', 'closed', 'cancelled');
create type public.lead_source as enum ('website', 'whatsapp', 'phone', 'listing', 'contact_form', 'appointment', 'manual', 'qr');
create type public.lead_intent as enum ('buy', 'rent', 'sell', 'let', 'valuation', 'other');
create type public.lead_activity_kind as enum ('note', 'status_change', 'call', 'whatsapp', 'email', 'meeting', 'system');
create type public.appointment_status as enum ('requested', 'confirmed', 'completed', 'cancelled');

-- -----------------------------------------------------------------------------
-- Müşteriler
-- phone_key: telefonun son 10 hanesi (0532..., +90532... aynı kişi sayılır)
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text check (char_length(phone) <= 30),
  phone_key text generated always as (
    nullif(right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10), '')
  ) stored,
  email text check (char_length(email) <= 160 and email = lower(email)),
  notes text check (char_length(notes) <= 4000),
  source public.lead_source not null default 'manual',
  kvkk_consent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint customers_reachable check (phone is not null or email is not null)
);

create index customers_org_created_idx on public.customers (organization_id, created_at desc) where deleted_at is null;
create index customers_org_phone_idx on public.customers (organization_id, phone_key) where phone_key is not null;
create index customers_org_email_idx on public.customers (organization_id, email) where email is not null;

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Talepler (lead)
-- -----------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  status public.lead_status not null default 'new',
  source public.lead_source not null default 'manual',
  intent public.lead_intent,
  message text check (char_length(message) <= 3000),
  budget_min numeric(14, 2) check (budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max >= 0),
  currency public.currency_code not null default 'TRY',
  desired_location text check (char_length(desired_location) <= 200),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  assigned_to uuid references auth.users (id) on delete set null,
  next_follow_up_at timestamptz,
  closed_at timestamptz,
  ip_hash text check (char_length(ip_hash) <= 128),
  user_agent text check (char_length(user_agent) <= 400),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leads_budget_range check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create index leads_org_status_idx on public.leads (organization_id, status, created_at desc) where deleted_at is null;
create index leads_org_created_idx on public.leads (organization_id, created_at desc);
create index leads_customer_idx on public.leads (customer_id);
create index leads_property_idx on public.leads (property_id) where property_id is not null;
create index leads_ip_idx on public.leads (organization_id, ip_hash, created_at desc) where ip_hash is not null;

create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.lead_activities (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind public.lead_activity_kind not null,
  body text check (char_length(body) <= 4000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Randevular (gösterim)
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes smallint not null default 30 check (duration_minutes between 15 and 480),
  status public.appointment_status not null default 'requested',
  note text check (char_length(note) <= 2000),
  assigned_to uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_org_scheduled_idx on public.appointments (organization_id, scheduled_at);
create index appointments_org_status_idx on public.appointments (organization_id, status, scheduled_at);
create index appointments_customer_idx on public.appointments (customer_id);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Müşteriye özel koleksiyonlar: /koleksiyon/{token}
-- token: sunucuda kriptografik rastgele üretilir (en az 32 karakter base64url)
-- -----------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  message text check (char_length(message) <= 2000),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collections_org_created_idx on public.collections (organization_id, created_at desc);

create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sort_order integer not null default 0,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (collection_id, property_id)
);

create index collection_items_org_idx on public.collection_items (organization_id);
create index collection_items_property_idx on public.collection_items (property_id);

-- -----------------------------------------------------------------------------
-- Kiracı tutarlılığı: bağlı kayıtlar aynı organizasyona ait olmalı
-- (istemci farklı organizasyondan bir müşteri/ilan kimliği gönderse bile)
-- -----------------------------------------------------------------------------
create or replace function public.crm_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'leads' then
    if not exists (select 1 from public.customers c where c.id = new.customer_id and c.organization_id = new.organization_id) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if new.property_id is not null and not exists (
      select 1 from public.properties p where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
      raise exception 'organization_immutable' using errcode = '42501';
    end if;
    if new.status in ('closed', 'cancelled') and (tg_op = 'INSERT' or old.status not in ('closed', 'cancelled')) then
      new.closed_at := now();
    elsif new.status not in ('closed', 'cancelled') then
      new.closed_at := null;
    end if;
  elsif tg_table_name = 'appointments' then
    if not exists (select 1 from public.customers c where c.id = new.customer_id and c.organization_id = new.organization_id) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if new.property_id is not null and not exists (
      select 1 from public.properties p where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if new.lead_id is not null and not exists (
      select 1 from public.leads l where l.id = new.lead_id and l.organization_id = new.organization_id
    ) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      if new.organization_id <> old.organization_id then
        raise exception 'organization_immutable' using errcode = '42501';
      end if;
      if new.status <> old.status and not (
           (old.status = 'requested' and new.status in ('confirmed', 'cancelled', 'completed'))
        or (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'requested'))
        or (old.status = 'cancelled' and new.status = 'requested')
      ) then
        raise exception 'invalid_status_transition' using errcode = 'P0001',
          hint = format('Randevu "%s" durumundan "%s" durumuna alınamaz.', old.status, new.status);
      end if;
    end if;
    if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
    if new.status = 'completed' and new.completed_at is null then new.completed_at := now(); end if;
    if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  elsif tg_table_name = 'collections' then
    if new.customer_id is not null and not exists (
      select 1 from public.customers c where c.id = new.customer_id and c.organization_id = new.organization_id
    ) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
      raise exception 'organization_immutable' using errcode = '42501';
    end if;
  elsif tg_table_name = 'collection_items' then
    select c.organization_id into new.organization_id from public.collections c where c.id = new.collection_id;
    if new.organization_id is null or not exists (
      select 1 from public.properties p where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'cross_tenant_reference' using errcode = '42501';
    end if;
  elsif tg_table_name = 'lead_activities' then
    select l.organization_id into new.organization_id from public.leads l where l.id = new.lead_id;
    if new.organization_id is null then
      raise exception 'invalid_lead' using errcode = '23503';
    end if;
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger leads_tenant_guard before insert or update on public.leads
  for each row execute function public.crm_tenant_guard();
create trigger appointments_tenant_guard before insert or update on public.appointments
  for each row execute function public.crm_tenant_guard();
create trigger collections_tenant_guard before insert or update on public.collections
  for each row execute function public.crm_tenant_guard();
create trigger collection_items_tenant_guard before insert or update on public.collection_items
  for each row execute function public.crm_tenant_guard();
create trigger lead_activities_tenant_guard before insert on public.lead_activities
  for each row execute function public.crm_tenant_guard();

-- Durum değişikliği lead geçmişine otomatik yazılır
create or replace function public.leads_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.lead_activities (organization_id, lead_id, kind, body, metadata, created_by)
    values (new.organization_id, new.id, 'status_change', null,
            jsonb_build_object('from', old.status, 'to', new.status), (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger leads_after_status_change after update of status on public.leads
  for each row execute function public.leads_after_status_change();

-- -----------------------------------------------------------------------------
-- V1 contact_requests → customers + leads (+ yönetici notu → aktivite)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  v_org uuid := (select id from public.organizations where slug = 'elvankent');
  v_customer uuid;
  v_lead uuid;
  v_phone_key text;
begin
  for r in select * from public.contact_requests order by created_at loop
    v_customer := null;
    v_phone_key := nullif(right(regexp_replace(coalesce(r.phone, ''), '[^0-9]', '', 'g'), 10), '');
    if v_phone_key is not null then
      select id into v_customer from public.customers
       where organization_id = v_org and phone_key = v_phone_key limit 1;
    end if;
    if v_customer is null and r.email is not null then
      select id into v_customer from public.customers
       where organization_id = v_org and email = lower(r.email) limit 1;
    end if;
    if v_customer is null then
      insert into public.customers (organization_id, full_name, phone, email, source, kvkk_consent_at, created_at)
      values (v_org, r.full_name, r.phone, lower(r.email),
              case r.source when 'property_detail' then 'listing'::public.lead_source else 'contact_form'::public.lead_source end,
              case when r.kvkk_consent then r.created_at end, r.created_at)
      returning id into v_customer;
    end if;

    insert into public.leads (organization_id, customer_id, property_id, status, source, message,
                              ip_hash, user_agent, created_at, updated_at)
    values (v_org, v_customer, r.property_id,
            case r.status when 'new' then 'new'::public.lead_status
                          when 'archived' then 'closed'::public.lead_status
                          else 'contacted'::public.lead_status end,
            case r.source when 'property_detail' then 'listing'::public.lead_source else 'contact_form'::public.lead_source end,
            r.message, r.ip_hash, r.user_agent, r.created_at, r.updated_at)
    returning id into v_lead;

    if r.admin_note is not null and btrim(r.admin_note) <> '' then
      insert into public.lead_activities (organization_id, lead_id, kind, body, created_at)
      values (v_org, v_lead, 'note', r.admin_note, r.updated_at);
    end if;
  end loop;
end;
$$;

drop table public.contact_requests;
drop type public.contact_status;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.appointments enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

-- ---------------------------------------------------------------------------
-- 20260926000005_v2_content.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 5 — İçerik: blog yazıları, düzenlenebilir sayfalar (Hakkımızda, KVKK,
-- gizlilik, çerez, kullanım koşulları, hizmetler) ve bölge (SEO) sayfaları.
--
-- Metinler Markdown olarak saklanır ve sunucuda güvenli bir alt küme ile
-- (HTML'e izin vermeden) işlenir. Hukuki sayfalar için veritabanında satır yoksa
-- uygulama, "hukuki danışman tarafından doğrulanmalıdır" uyarılı şablonu gösterir.
-- =============================================================================

create type public.content_status as enum ('draft', 'published');

-- -----------------------------------------------------------------------------
-- Blog / içerik yazıları
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 3 and 140),
  excerpt text check (char_length(excerpt) <= 300),
  body text not null default '' check (char_length(body) <= 50000),
  cover_media_id uuid references public.media_assets (id) on delete set null,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create index posts_org_published_idx on public.posts (organization_id, published_at desc)
  where status = 'published' and deleted_at is null;

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create or replace function public.posts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'organization_immutable' using errcode = '42501';
  end if;
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.slugify(new.title);
  end if;
  if tg_op = 'INSERT' or new.slug <> old.slug then
    new.slug := public.unique_slug('posts', new.organization_id, new.slug, new.id);
  end if;
  if new.status = 'published' then
    if char_length(btrim(new.body)) < 200 then
      raise exception 'publish_checklist' using errcode = 'P0001', detail = 'body',
        hint = 'Yazı yayınlanmadan önce en az 200 karakterlik içerik gerekir.';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  if new.cover_media_id is not null and not exists (
    select 1 from public.media_assets m where m.id = new.cover_media_id and m.organization_id = new.organization_id
  ) then
    raise exception 'cross_tenant_reference' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

-- -----------------------------------------------------------------------------
-- Düzenlenebilir sabit sayfalar
-- -----------------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key in ('about', 'services', 'kvkk', 'privacy', 'cookies', 'terms')),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) <= 60000),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  -- Hukuki metinler: yönetici "hukuk danışmanı inceledi" onayı verene kadar uyarı gösterilir
  legal_reviewed boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

-- V1 "Hakkımızda" metni (site_settings.about_text) varsayılan kiracının sayfasına taşınır
insert into public.pages (organization_id, key, title, body)
select o.id, 'about', 'Hakkımızda', s.about_text
  from public.organizations o
  join public.site_settings s on s.id = 1
 where o.slug = 'elvankent'
   and s.about_text is not null
   and btrim(s.about_text) <> ''
on conflict (organization_id, key) do nothing;

drop table public.site_settings;

-- -----------------------------------------------------------------------------
-- Bölge sayfaları: /bolgeler/{slug}
-- Kapsam: il (zorunlu) + isteğe bağlı ilçe + isteğe bağlı mahalle.
-- FAQ: [{ "q": "...", "a": "..." }] — uygulamada doğrulanır.
-- -----------------------------------------------------------------------------
create table public.region_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 2 and 80),
  city_id integer not null references public.cities (id) on delete restrict,
  district_id integer references public.districts (id) on delete restrict,
  neighborhood_id integer references public.neighborhoods (id) on delete restrict,
  intro text check (char_length(intro) <= 600),
  body text not null default '' check (char_length(body) <= 20000),
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 20),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  constraint region_pages_scope check (neighborhood_id is null or district_id is not null)
);

create index region_pages_org_idx on public.region_pages (organization_id, status, sort_order);

create trigger region_pages_updated_at before update on public.region_pages
  for each row execute function public.set_updated_at();

create or replace function public.region_pages_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'organization_immutable' using errcode = '42501';
  end if;
  if new.district_id is not null and not exists (
    select 1 from public.districts d where d.id = new.district_id and d.city_id = new.city_id
  ) then
    raise exception 'district_city_mismatch' using errcode = '23514';
  end if;
  if new.neighborhood_id is not null and not exists (
    select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.district_id = new.district_id
  ) then
    raise exception 'neighborhood_district_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger region_pages_before_write before insert or update on public.region_pages
  for each row execute function public.region_pages_before_write();

-- Varsayılan kiracı için gerçek bölgeler. Açıklamalar olgusal ve kısa tutuldu;
-- yönetim panelinden zenginleştirilmesi beklenir. SSS yanıtları sistemin
-- nasıl çalıştığını anlatır, bölge hakkında doğrulanmamış iddia içermez.
insert into public.region_pages (organization_id, slug, name, city_id, district_id, neighborhood_id, intro, faqs, status, sort_order)
select o.id, v.slug, v.name, c.id, d.id, n.id, v.intro, f.faqs, 'published', v.sort_order
  from public.organizations o
  join public.cities c on c.slug = 'ankara'
  cross join (values
    ('elvankent', 'Elvankent', 'etimesgut', 'elvankent',
     'Elvankent, Ankara''nın Etimesgut ilçesine bağlı bir mahalledir. Bu sayfada Elvankent''teki güncel satılık ve kiralık ilanları ve yayındaki ilanlara göre hesaplanan fiyat aralıklarını bulabilirsiniz.', 10),
    ('etimesgut', 'Etimesgut', 'etimesgut', null,
     'Etimesgut, Ankara''nın merkez ilçelerinden biridir. Etimesgut genelindeki güncel satılık ve kiralık ilanlar bu sayfada listelenir.', 20),
    ('yenimahalle', 'Yenimahalle', 'yenimahalle', null,
     'Yenimahalle, Ankara''nın merkez ilçelerinden biridir. Yenimahalle''deki güncel satılık ve kiralık ilanlar bu sayfada listelenir.', 30)
  ) as v(slug, name, district_slug, neighborhood_slug, intro, sort_order)
  join public.districts d on d.city_id = c.id and d.slug = v.district_slug
  left join public.neighborhoods n on n.district_id = d.id and n.slug = v.neighborhood_slug
  cross join (select '[
    {"q": "Bu sayfadaki ilanlar nasıl güncelleniyor?", "a": "İlanlar ofisimiz tarafından yayına alındıkça bu sayfada otomatik olarak listelenir; satılan veya kiralanan ilanlar listeden çıkar."},
    {"q": "Fiyat aralıkları nasıl hesaplanıyor?", "a": "Fiyat aralıkları, bu bölgede şu anda yayında olan ilanlarımızın fiyatlarından otomatik olarak hesaplanır. Bölgenin genel piyasa ortalamasını temsil etmez; güncel değerleme için bizimle iletişime geçebilirsiniz."},
    {"q": "Aradığım özellikte ilan yoksa ne yapabilirim?", "a": "Aradığınız kriterleri iletişim formu veya WhatsApp üzerinden bize iletebilirsiniz. Talebiniz kayda alınır ve uygun bir gayrimenkul olduğunda sizinle iletişime geçilir."}
  ]'::jsonb as faqs) as f
 where o.slug = 'elvankent'
on conflict (organization_id, slug) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.pages enable row level security;
alter table public.region_pages enable row level security;

-- ---------------------------------------------------------------------------
-- 20260926000006_v2_audit.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 6 — Denetim kaydı (audit log): kim, ne yaptı, ne zaman, neye?
--
-- Veri değişiklikleri TETİKLEYİCİLERLE kaydedilir; uygulama katmanı atlanarak
-- yapılan değişiklikler de iz bırakır. Oturum açma, yetkisiz erişim, dışa
-- aktarma gibi olaylar sunucudan log_security_event() ile yazılır.
-- ŞİFRE, TOKEN, OTURUM BİLGİSİ GİBİ HASSAS VERİLER KAYDEDİLMEZ; değişen alanların
-- yalnızca adları tutulur (fiyat ve durum geçişleri hariç).
-- Kayıtlar değiştirilemez: istemcilere yalnızca okuma yetkisi verilir.
-- =============================================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text check (char_length(actor_label) <= 200),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 80),
  target_label text check (char_length(target_label) <= 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip_hash text check (char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_org_action_idx on public.audit_logs (organization_id, action, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_platform_idx on public.audit_logs (created_at desc) where organization_id is null;

-- -----------------------------------------------------------------------------
-- Yardımcılar
-- -----------------------------------------------------------------------------
create or replace function public.audit_actor_label(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(coalesce(nullif(btrim(p.full_name), ''), u.email), 200)
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = p_user;
$$;

create or replace function public.write_audit(
  p_org uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, v_actor, public.audit_actor_label(v_actor), p_action, p_target_type, p_target_id,
          left(p_target_label, 200), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- İki kayıt arasında değişen sütun adları (gürültülü teknik alanlar hariç)
create or replace function public.audit_changed_fields(p_old jsonb, p_new jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(key order by key), '{}')
    from jsonb_each(p_new) as n(key, value)
   where n.value is distinct from p_old -> n.key
     and key not in ('updated_at', 'updated_by', 'status_changed_at', 'price_changed_at',
                     'price_dropped_at', 'price_previous', 'public_latitude', 'public_longitude',
                     'location_precision', 'floor_position', 'rooms_label');
$$;

-- -----------------------------------------------------------------------------
-- İlanlar
-- Otomatik kayıt (autosave) gürültüsünü önlemek için aynı kullanıcı aynı ilan
-- için 10 dakika içinde tek bir "property.updated" kaydı üretir.
-- -----------------------------------------------------------------------------
create or replace function public.audit_properties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_fields text[];
begin
  if tg_op = 'DELETE' then
    perform public.write_audit(old.organization_id, 'property.purged', 'property', old.id::text,
      old.reference_no || ' · ' || old.title, '{}'::jsonb);
    return old;
  end if;

  v_label := new.reference_no || ' · ' || new.title;

  if tg_op = 'INSERT' then
    perform public.write_audit(new.organization_id, 'property.created', 'property', new.id::text, v_label,
      jsonb_build_object('status', new.status));
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    perform public.write_audit(new.organization_id, 'property.deleted', 'property', new.id::text, v_label, '{}'::jsonb);
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    perform public.write_audit(new.organization_id, 'property.restored', 'property', new.id::text, v_label, '{}'::jsonb);
    return new;
  end if;

  if new.status <> old.status then
    perform public.write_audit(new.organization_id, 'property.status_changed', 'property', new.id::text, v_label,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.price is distinct from old.price or new.currency <> old.currency then
    perform public.write_audit(new.organization_id, 'property.price_changed', 'property', new.id::text, v_label,
      jsonb_build_object('from', old.price, 'to', new.price, 'currency', new.currency));
  end if;

  v_fields := array(
    select f from unnest(public.audit_changed_fields(to_jsonb(old), to_jsonb(new))) as f
     where f not in ('status', 'price', 'currency', 'published_at', 'deleted_at', 'deleted_by')
  );
  if cardinality(v_fields) > 0 and not exists (
    select 1 from public.audit_logs a
     where a.target_type = 'property' and a.target_id = new.id::text
       and a.action = 'property.updated'
       and a.actor_id is not distinct from (select auth.uid())
       and a.created_at > now() - interval '10 minutes'
  ) then
    perform public.write_audit(new.organization_id, 'property.updated', 'property', new.id::text, v_label,
      jsonb_build_object('fields', to_jsonb(v_fields)));
  end if;
  return new;
end;
$$;

create trigger audit_properties after insert or update or delete on public.properties
  for each row execute function public.audit_properties();

-- -----------------------------------------------------------------------------
-- Üyelikler (rol değişikliği, ekleme/çıkarma)
-- -----------------------------------------------------------------------------
create or replace function public.audit_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := public.audit_actor_label(coalesce(new.user_id, old.user_id));
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.organization_id, 'member.added', 'user', new.user_id::text, v_label,
      jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' then
    perform public.write_audit(old.organization_id, 'member.removed', 'user', old.user_id::text, v_label,
      jsonb_build_object('role', old.role));
  else
    if new.role <> old.role then
      perform public.write_audit(new.organization_id, 'member.role_changed', 'user', new.user_id::text, v_label,
        jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    if new.status <> old.status then
      perform public.write_audit(new.organization_id, 'member.status_changed', 'user', new.user_id::text, v_label,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  return null;
end;
$$;

create trigger audit_members after insert or update or delete on public.organization_members
  for each row execute function public.audit_members();

-- -----------------------------------------------------------------------------
-- Ayarlar, alan adları, içerik, CRM silmeleri, koleksiyonlar
-- -----------------------------------------------------------------------------
create or replace function public.audit_generic()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_fields text[];
begin
  v_org := coalesce((to_jsonb(new) ->> 'organization_id')::uuid, (to_jsonb(old) ->> 'organization_id')::uuid);

  if tg_table_name = 'organization_settings' then
    v_fields := public.audit_changed_fields(to_jsonb(old), to_jsonb(new));
    if cardinality(v_fields) > 0 then
      perform public.write_audit(v_org, 'settings.updated', 'settings', v_org::text, null,
        jsonb_build_object('fields', to_jsonb(v_fields)));
    end if;
  elsif tg_table_name = 'organization_domains' then
    perform public.write_audit(v_org,
      case tg_op when 'INSERT' then 'domain.added' when 'DELETE' then 'domain.removed' else 'domain.updated' end,
      'domain', coalesce(new.id, old.id)::text, coalesce(new.hostname, old.hostname), '{}'::jsonb);
  elsif tg_table_name in ('customers', 'leads') then
    if tg_op = 'DELETE' or (old.deleted_at is null and new.deleted_at is not null) then
      perform public.write_audit(v_org, case tg_table_name when 'customers' then 'customer.deleted' else 'lead.deleted' end,
        tg_table_name, coalesce(new.id, old.id)::text, null, '{}'::jsonb);
    end if;
  elsif tg_table_name = 'collections' then
    if tg_op = 'INSERT' then
      perform public.write_audit(v_org, 'collection.created', 'collection', new.id::text, new.title, '{}'::jsonb);
    elsif tg_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
      perform public.write_audit(v_org, 'collection.revoked', 'collection', new.id::text, new.title, '{}'::jsonb);
    elsif tg_op = 'DELETE' then
      perform public.write_audit(v_org, 'collection.deleted', 'collection', old.id::text, old.title, '{}'::jsonb);
    end if;
  elsif tg_table_name = 'pages' then
    perform public.write_audit(v_org, case tg_op when 'DELETE' then 'content.deleted' else 'content.updated' end,
      'pages', coalesce(new.id, old.id)::text, coalesce(new.title, old.title), jsonb_build_object('key', coalesce(new.key, old.key)));
  elsif tg_table_name in ('posts', 'region_pages') then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) ->> 'status') = 'published'
       and (to_jsonb(old) ->> 'status') is distinct from 'published' then
      perform public.write_audit(v_org, 'content.published', tg_table_name, new.id::text,
        coalesce(to_jsonb(new) ->> 'title', to_jsonb(new) ->> 'name'), '{}'::jsonb);
    elsif tg_op = 'DELETE' then
      perform public.write_audit(v_org, 'content.deleted', tg_table_name, old.id::text,
        coalesce(to_jsonb(old) ->> 'title', to_jsonb(old) ->> 'name'), '{}'::jsonb);
    end if;
  elsif tg_table_name = 'media_assets' then
    if tg_op = 'DELETE' then
      perform public.write_audit(v_org, 'media.deleted', 'media', old.id::text, old.original_filename,
        jsonb_build_object('property_id', old.property_id));
    end if;
  elsif tg_table_name = 'subscriptions' then
    perform public.write_audit(v_org, 'subscription.changed', 'subscription', coalesce(new.id, old.id)::text,
      coalesce(new.plan_id, old.plan_id),
      jsonb_build_object('status', coalesce(new.status, old.status)));
  elsif tg_table_name = 'organizations' then
    if tg_op = 'UPDATE' and new.status <> old.status then
      perform public.write_audit(new.id, 'organization.status_changed', 'organization', new.id::text, new.name,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  return null;
end;
$$;

create trigger audit_settings after update on public.organization_settings
  for each row execute function public.audit_generic();
create trigger audit_domains after insert or update or delete on public.organization_domains
  for each row execute function public.audit_generic();
create trigger audit_customers after update or delete on public.customers
  for each row execute function public.audit_generic();
create trigger audit_leads after update or delete on public.leads
  for each row execute function public.audit_generic();
create trigger audit_collections after insert or update or delete on public.collections
  for each row execute function public.audit_generic();
create trigger audit_posts after update or delete on public.posts
  for each row execute function public.audit_generic();
create trigger audit_region_pages after update or delete on public.region_pages
  for each row execute function public.audit_generic();
create trigger audit_pages after insert or update or delete on public.pages
  for each row execute function public.audit_generic();
create trigger audit_media after delete on public.media_assets
  for each row execute function public.audit_generic();
create trigger audit_subscriptions after insert or update on public.subscriptions
  for each row execute function public.audit_generic();
create trigger audit_organizations after update on public.organizations
  for each row execute function public.audit_generic();

-- -----------------------------------------------------------------------------
-- Sunucudan güvenlik olayları (oturum açma başarı/başarısızlık, yetkisiz erişim,
-- dışa aktarma, kullanıcı oluşturma). Sadece service_role çağırabilir.
-- -----------------------------------------------------------------------------
create or replace function public.log_security_event(
  p_org uuid,
  p_action text,
  p_actor uuid,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_metadata jsonb,
  p_ip_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata, ip_hash)
  values (p_org, p_actor, public.audit_actor_label(p_actor), p_action, left(p_target_type, 40), left(p_target_id, 80),
          left(p_target_label, 200), coalesce(p_metadata, '{}'::jsonb), left(p_ip_hash, 128));
end;
$$;

-- Saklama süresi: varsayılan 365 gün (cron ile çağrılır)
create or replace function public.purge_old_audit_logs(p_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.audit_logs where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 20260926000007_v2_security.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 7 — Güvenlik: kiracı kapsamlı RLS politikaları, yetkiler ve RPC'ler
--
-- İlkeler
--  1. Her kiracı tablosunda erişim organization_id + merkezi yetki ile sınırlı:
--       organization_id in (select public.user_org_ids('<izin>'))
--     Tenant A kullanıcısı Tenant B'nin hiçbir kaydını (ilan, müşteri, talep,
--     medya, analitik, log) göremez/değiştiremez. Bu kural veritabanındadır;
--     uygulama katmanı ayrıca kontrol eder (derinlemesine savunma).
--  2. Ziyaretçi (anon) yalnızca aktif organizasyonların herkese açık içeriğini
--     okur: yayındaki/satılmış/kiralanmış ilanlar, hazır görseller, ayarlar,
--     yayındaki yazı ve bölge sayfaları.
--  3. Form kaydı ve etkileşim olayları yalnızca sunucunun (service_role)
--     çağırabildiği fonksiyonlarla yazılır (hız sınırı + doğrulama içeride).
--  4. Süper admin (platform) işlemleri is_super_admin() ile veritabanında
--     doğrulanan SECURITY DEFINER fonksiyonlardır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ek yardımcılar
-- -----------------------------------------------------------------------------
-- Kullanıcının üye olduğu tüm organizasyonlar (organizasyon askıda olsa bile);
-- askıya alınan hesabın bilgilendirme ekranı için.
create or replace function public.member_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id from public.organization_members m
   where m.user_id = (select auth.uid()) and m.status = 'active';
$$;

-- Ayarlar: SEO alanları seo.manage, diğerleri settings.manage ister
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
  ) and not public.has_org_permission(new.organization_id, 'settings.manage') then
    raise exception 'settings_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organization_settings_guard before update on public.organization_settings
  for each row execute function public.organization_settings_guard();

-- CRM soft delete yalnızca leads.delete yetkisiyle
create or replace function public.crm_soft_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (old.deleted_at is null) <> (new.deleted_at is null)
     and not public.has_org_permission(new.organization_id, 'leads.delete') then
    raise exception 'delete_forbidden' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'organization_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger customers_soft_delete_guard before update on public.customers
  for each row execute function public.crm_soft_delete_guard();
create trigger leads_soft_delete_guard before update on public.leads
  for each row execute function public.crm_soft_delete_guard();

-- -----------------------------------------------------------------------------
-- Tüm tablolarda RLS açık (V1 tabloları zaten açık; yeniler önceki migration'larda)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.districts enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.property_types enable row level security;
alter table public.features enable row level security;
alter table public.properties enable row level security;
alter table public.property_locations enable row level security;
alter table public.property_features enable row level security;
alter table public.media_assets enable row level security;
alter table public.property_events enable row level security;
alter table public.property_stats enable row level security;
alter table public.favorites enable row level security;
alter table public.redirects enable row level security;

-- -----------------------------------------------------------------------------
-- Profiller
-- -----------------------------------------------------------------------------
create policy "profiles_select_self_or_team" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id from public.organization_members m
       where m.organization_id in (select public.user_org_ids())
    )
  );

create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Referans veriler (platform geneli): herkes okur
-- Mahalle: ilan ekleme yetkisi olan kullanıcı eksik mahalleyi ekleyebilir.
-- -----------------------------------------------------------------------------
create policy "cities_read" on public.cities for select using (true);
create policy "districts_read" on public.districts for select using (true);
create policy "neighborhoods_read" on public.neighborhoods for select using (true);
create policy "neighborhoods_insert_members" on public.neighborhoods for insert to authenticated
  with check (exists (select 1 from public.user_org_ids('properties.create')));
create policy "property_types_read" on public.property_types for select using (true);
create policy "features_read" on public.features for select using (true);

revoke insert, update, delete, truncate on public.cities, public.districts, public.neighborhoods,
  public.property_types, public.features from anon;
revoke insert, update, delete, truncate on public.cities, public.districts,
  public.property_types, public.features from authenticated;
revoke update, delete, truncate on public.neighborhoods from authenticated;

-- -----------------------------------------------------------------------------
-- Planlar, organizasyonlar, alan adları, abonelikler, üyelikler, yetkiler
-- -----------------------------------------------------------------------------
create policy "plans_read" on public.plans for select using (is_public or (select public.is_super_admin()));

create policy "organizations_public_read" on public.organizations for select
  using (status = 'active');
create policy "organizations_member_read" on public.organizations for select to authenticated
  using (id in (select public.member_org_ids()) or (select public.is_super_admin()));

create policy "domains_public_read" on public.organization_domains for select
  using (verified_at is not null and organization_id in (select public.active_org_ids()));
create policy "domains_member_read" on public.organization_domains for select to authenticated
  using (organization_id in (select public.user_org_ids('settings.manage')));

create policy "subscriptions_member_read" on public.subscriptions for select to authenticated
  using (organization_id in (select public.member_org_ids()));

create policy "members_read_team" on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or organization_id in (select public.user_org_ids()));
create policy "members_insert" on public.organization_members for insert to authenticated
  with check (organization_id in (select public.user_org_ids('users.manage')));
create policy "members_update" on public.organization_members for update to authenticated
  using (organization_id in (select public.user_org_ids('users.manage')))
  with check (organization_id in (select public.user_org_ids('users.manage')));
create policy "members_delete" on public.organization_members for delete to authenticated
  using (organization_id in (select public.user_org_ids('users.manage')));

create policy "role_permissions_read" on public.role_permissions for select to authenticated using (true);

create policy "settings_public_read" on public.organization_settings for select
  using (organization_id in (select public.active_org_ids()));
create policy "settings_member_read" on public.organization_settings for select to authenticated
  using (organization_id in (select public.member_org_ids()));
create policy "settings_update" on public.organization_settings for update to authenticated
  using (
    organization_id in (select public.user_org_ids('settings.manage'))
    or organization_id in (select public.user_org_ids('seo.manage'))
  )
  with check (
    organization_id in (select public.user_org_ids('settings.manage'))
    or organization_id in (select public.user_org_ids('seo.manage'))
  );

revoke all on public.plans, public.organizations, public.organization_domains, public.subscriptions,
  public.organization_members, public.role_permissions, public.organization_counters,
  public.organization_settings from anon;
grant select on public.plans, public.organizations, public.organization_domains, public.organization_settings to anon;
revoke insert, update, delete, truncate on public.plans, public.organizations, public.organization_domains,
  public.subscriptions, public.role_permissions, public.organization_counters from authenticated;
revoke select on public.organization_counters from authenticated;
revoke insert, delete, truncate on public.organization_settings from authenticated;

-- -----------------------------------------------------------------------------
-- İlanlar ve bağlı tablolar
-- -----------------------------------------------------------------------------
create policy "properties_public_read" on public.properties for select
  using (
    status in ('published', 'sold', 'rented')
    and deleted_at is null
    and organization_id in (select public.active_org_ids())
  );
create policy "properties_member_read" on public.properties for select to authenticated
  using (organization_id in (select public.user_org_ids('properties.read')));
create policy "properties_insert" on public.properties for insert to authenticated
  with check (organization_id in (select public.user_org_ids('properties.create')));
create policy "properties_update" on public.properties for update to authenticated
  using (organization_id in (select public.user_org_ids('properties.update')))
  with check (organization_id in (select public.user_org_ids('properties.update')));
create policy "properties_purge" on public.properties for delete to authenticated
  using (deleted_at is not null and organization_id in (select public.user_org_ids('properties.delete')));

-- Açık adres ve kesin koordinat: yalnızca organizasyon üyeleri
create policy "locations_member_read" on public.property_locations for select to authenticated
  using (organization_id in (select public.user_org_ids('properties.read')));
create policy "locations_member_write" on public.property_locations for all to authenticated
  using (organization_id in (select public.user_org_ids('properties.update')))
  with check (organization_id in (select public.user_org_ids('properties.update')));

-- Bağlı kayıtların görünürlüğü = ilanın görünürlüğü (alt sorguda ilan RLS'i uygulanır)
create policy "features_link_read" on public.property_features for select
  using (exists (select 1 from public.properties p where p.id = property_id));
create policy "features_link_write" on public.property_features for all to authenticated
  using (organization_id in (select public.user_org_ids('properties.update')))
  with check (organization_id in (select public.user_org_ids('properties.update')));

create policy "media_public_read" on public.media_assets for select
  using (
    status = 'ready'
    and organization_id in (select public.active_org_ids())
    and (property_id is null or exists (select 1 from public.properties p where p.id = property_id))
  );
create policy "media_member_read" on public.media_assets for select to authenticated
  using (organization_id in (select public.user_org_ids('properties.read')));
create policy "media_member_write" on public.media_assets for all to authenticated
  using (organization_id in (select public.user_org_ids('media.manage')))
  with check (organization_id in (select public.user_org_ids('media.manage')));

create policy "events_member_read" on public.property_events for select to authenticated
  using (organization_id in (select public.user_org_ids('analytics.read')));
create policy "stats_member_read" on public.property_stats for select to authenticated
  using (organization_id in (select public.user_org_ids('properties.read')));
create policy "price_history_member_read" on public.property_price_history for select to authenticated
  using (organization_id in (select public.user_org_ids('properties.read')));

create policy "favorites_own_read" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites_own_insert" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.properties p where p.id = property_id));
create policy "favorites_own_delete" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "redirects_public_read" on public.redirects for select
  using (organization_id in (select public.active_org_ids()));
create policy "redirects_member_write" on public.redirects for all to authenticated
  using (organization_id in (select public.user_org_ids('seo.manage')))
  with check (organization_id in (select public.user_org_ids('seo.manage')));

revoke all on public.property_locations, public.property_events, public.property_stats,
  public.property_price_history, public.favorites from anon;
revoke insert, update, delete, truncate on public.properties, public.property_features,
  public.media_assets, public.redirects from anon;
revoke insert, update, delete, truncate on public.property_events, public.property_stats,
  public.property_price_history from authenticated;
revoke update, truncate on public.favorites from authenticated;

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------
create policy "customers_read" on public.customers for select to authenticated
  using (organization_id in (select public.user_org_ids('leads.read')));
create policy "customers_insert" on public.customers for insert to authenticated
  with check (organization_id in (select public.user_org_ids('leads.create')));
create policy "customers_update" on public.customers for update to authenticated
  using (organization_id in (select public.user_org_ids('leads.update')))
  with check (organization_id in (select public.user_org_ids('leads.update')));
create policy "customers_delete" on public.customers for delete to authenticated
  using (organization_id in (select public.user_org_ids('leads.delete')));

create policy "leads_read" on public.leads for select to authenticated
  using (organization_id in (select public.user_org_ids('leads.read')));
create policy "leads_insert" on public.leads for insert to authenticated
  with check (organization_id in (select public.user_org_ids('leads.create')));
create policy "leads_update" on public.leads for update to authenticated
  using (organization_id in (select public.user_org_ids('leads.update')))
  with check (organization_id in (select public.user_org_ids('leads.update')));
create policy "leads_delete" on public.leads for delete to authenticated
  using (organization_id in (select public.user_org_ids('leads.delete')));

create policy "lead_activities_read" on public.lead_activities for select to authenticated
  using (organization_id in (select public.user_org_ids('leads.read')));
create policy "lead_activities_insert" on public.lead_activities for insert to authenticated
  with check (organization_id in (select public.user_org_ids('leads.update')));

create policy "appointments_read" on public.appointments for select to authenticated
  using (organization_id in (select public.user_org_ids('appointments.read')));
create policy "appointments_write" on public.appointments for all to authenticated
  using (organization_id in (select public.user_org_ids('appointments.manage')))
  with check (organization_id in (select public.user_org_ids('appointments.manage')));

create policy "collections_manage" on public.collections for all to authenticated
  using (organization_id in (select public.user_org_ids('collections.manage')))
  with check (organization_id in (select public.user_org_ids('collections.manage')));
create policy "collection_items_manage" on public.collection_items for all to authenticated
  using (organization_id in (select public.user_org_ids('collections.manage')))
  with check (organization_id in (select public.user_org_ids('collections.manage')));

revoke all on public.customers, public.leads, public.lead_activities, public.appointments,
  public.collections, public.collection_items from anon;
revoke update, delete, truncate on public.lead_activities from authenticated;

-- -----------------------------------------------------------------------------
-- İçerik
-- -----------------------------------------------------------------------------
create policy "posts_public_read" on public.posts for select
  using (
    status = 'published' and deleted_at is null and published_at <= now()
    and organization_id in (select public.active_org_ids())
  );
create policy "posts_member_all" on public.posts for all to authenticated
  using (organization_id in (select public.user_org_ids('content.manage')))
  with check (organization_id in (select public.user_org_ids('content.manage')));

create policy "pages_public_read" on public.pages for select
  using (organization_id in (select public.active_org_ids()));
create policy "pages_member_write" on public.pages for all to authenticated
  using (organization_id in (select public.user_org_ids('content.manage')))
  with check (organization_id in (select public.user_org_ids('content.manage')));

create policy "region_pages_public_read" on public.region_pages for select
  using (status = 'published' and organization_id in (select public.active_org_ids()));
create policy "region_pages_member_all" on public.region_pages for all to authenticated
  using (organization_id in (select public.user_org_ids('content.manage')))
  with check (organization_id in (select public.user_org_ids('content.manage')));

revoke insert, update, delete, truncate on public.posts, public.pages, public.region_pages from anon;

-- -----------------------------------------------------------------------------
-- Denetim kayıtları: yalnızca okuma (organizasyon: audit.read, platform: süper admin)
-- -----------------------------------------------------------------------------
create policy "audit_org_read" on public.audit_logs for select to authenticated
  using (organization_id in (select public.user_org_ids('audit.read')));
create policy "audit_platform_read" on public.audit_logs for select to authenticated
  using ((select public.is_super_admin()));

revoke all on public.audit_logs from anon;
revoke insert, update, delete, truncate on public.audit_logs from authenticated;

-- =============================================================================
-- RPC fonksiyonları
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Web formu → müşteri + talep (+ randevu). Sadece sunucu (service_role).
-- Hız sınırı: aynı IP özetinden organizasyon başına 10 dakikada 3, 24 saatte 10.
-- -----------------------------------------------------------------------------
create or replace function public.submit_lead(
  p_org uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_property_id uuid,
  p_source public.lead_source,
  p_intent public.lead_intent,
  p_details jsonb,
  p_appointment_at timestamptz,
  p_kvkk_consent boolean,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_lead uuid;
  v_property uuid;
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_email)), '');
  v_phone_key text;
begin
  if p_kvkk_consent is not true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.organizations where id = p_org and status = 'active') then
    raise exception 'invalid_organization' using errcode = 'P0001';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'contact_required' using errcode = 'P0001';
  end if;

  if p_ip_hash is not null then
    if (select count(*) from public.leads
         where organization_id = p_org and ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3
       or (select count(*) from public.leads
         where organization_id = p_org and ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 10 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  -- Sadece bu organizasyonun yayındaki ilanlarına bağlanabilir
  select p.id into v_property from public.properties p
   where p.id = p_property_id and p.organization_id = p_org
     and p.status = 'published' and p.deleted_at is null;

  if p_appointment_at is not null and (
       p_appointment_at < now() + interval '1 hour' or p_appointment_at > now() + interval '120 days'
     ) then
    raise exception 'invalid_appointment_time' using errcode = 'P0001';
  end if;

  v_phone_key := nullif(right(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), 10), '');
  if v_phone_key is not null then
    select id into v_customer from public.customers
     where organization_id = p_org and phone_key = v_phone_key and deleted_at is null
     order by created_at limit 1;
  end if;
  if v_customer is null and v_email is not null then
    select id into v_customer from public.customers
     where organization_id = p_org and email = v_email and deleted_at is null
     order by created_at limit 1;
  end if;

  if v_customer is null then
    insert into public.customers (organization_id, full_name, phone, email, source, kvkk_consent_at)
    values (p_org, left(btrim(p_full_name), 120), left(v_phone, 30), left(v_email, 160), p_source, now())
    returning id into v_customer;
  else
    update public.customers
       set kvkk_consent_at = now(),
           phone = coalesce(phone, left(v_phone, 30)),
           email = coalesce(email, left(v_email, 160))
     where id = v_customer;
  end if;

  insert into public.leads (organization_id, customer_id, property_id, status, source, intent, message,
                            details, ip_hash, user_agent)
  values (p_org, v_customer, v_property, 'new', p_source, p_intent, left(btrim(p_message), 3000),
          coalesce(p_details, '{}'::jsonb), left(p_ip_hash, 128), left(p_user_agent, 400))
  returning id into v_lead;

  if p_appointment_at is not null then
    insert into public.appointments (organization_id, property_id, customer_id, lead_id, scheduled_at, status, note)
    values (p_org, v_property, v_customer, v_lead, p_appointment_at, 'requested', left(btrim(p_message), 2000));
  end if;

  if v_property is not null then
    insert into public.property_events (property_id, event_type, session_hash)
    values (v_property, case when p_appointment_at is not null then 'appointment_request'::public.property_event_type
                             else 'contact_form'::public.property_event_type end, p_ip_hash);
    insert into public.property_stats (property_id, contact_form_count) values (v_property, 1)
    on conflict (property_id) do update set contact_form_count = public.property_stats.contact_form_count + 1;
  end if;

  return v_lead;
end;
$$;

-- -----------------------------------------------------------------------------
-- Etkileşim olayı (görüntülenme, arama, WhatsApp...). Sadece sunucu.
-- Aynı oturum: görüntülenme 30 dk, diğerleri 1 dk tekrar sayılmaz;
-- oturum başına dakikada en fazla 60 olay. Oturum özeti günlük değişir,
-- IP adresi saklanmaz.
-- -----------------------------------------------------------------------------
create or replace function public.track_event(
  p_property_id uuid,
  p_event public.property_event_type,
  p_session_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
begin
  if p_session_hash is null or char_length(p_session_hash) < 8 then
    return false;
  end if;
  if p_event in ('contact_form', 'appointment_request') then
    return false; -- yalnızca submit_lead üzerinden
  end if;
  if not exists (
    select 1 from public.properties p
      join public.organizations o on o.id = p.organization_id and o.status = 'active'
     where p.id = p_property_id and p.status in ('published', 'sold', 'rented') and p.deleted_at is null
  ) then
    return false;
  end if;
  if (select count(*) from public.property_events
       where session_hash = p_session_hash and created_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;

  v_window := case when p_event in ('view', 'qr_visit') then interval '30 minutes' else interval '1 minute' end;
  if exists (
    select 1 from public.property_events
     where property_id = p_property_id and event_type = p_event
       and session_hash = p_session_hash and created_at > now() - v_window
  ) then
    return false;
  end if;

  insert into public.property_events (property_id, event_type, session_hash)
  values (p_property_id, p_event, p_session_hash);

  insert into public.property_stats as s (property_id, view_count, phone_click_count, whatsapp_click_count, favorite_count, share_count)
  values (
    p_property_id,
    (p_event = 'view')::int, (p_event = 'phone_click')::int, (p_event = 'whatsapp_click')::int,
    (p_event = 'favorite_add')::int, (p_event = 'share')::int
  )
  on conflict (property_id) do update set
    view_count = s.view_count + excluded.view_count,
    phone_click_count = s.phone_click_count + excluded.phone_click_count,
    whatsapp_click_count = s.whatsapp_click_count + excluded.whatsapp_click_count,
    favorite_count = s.favorite_count + excluded.favorite_count,
    share_count = s.share_count + excluded.share_count;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Yönetim paneli özeti — SECURITY INVOKER: RLS uygulanır; kullanıcının yetkisi
-- olmayan veri (ör. leads.read yoksa talepler) sıfır olarak döner.
-- -----------------------------------------------------------------------------
create or replace function public.org_dashboard(p_org uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1);
begin
  if not exists (select 1 from public.user_org_ids() as x(id) where x.id = p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'properties', (
      select jsonb_build_object(
        'total', count(*) filter (where deleted_at is null),
        'draft', count(*) filter (where deleted_at is null and status = 'draft'),
        'pending', count(*) filter (where deleted_at is null and status = 'pending'),
        'published', count(*) filter (where deleted_at is null and status = 'published'),
        'sold', count(*) filter (where deleted_at is null and status = 'sold'),
        'rented', count(*) filter (where deleted_at is null and status = 'rented'),
        'archived', count(*) filter (where deleted_at is null and status = 'archived'),
        'trash', count(*) filter (where deleted_at is not null),
        'featured', count(*) filter (where deleted_at is null and status = 'published' and is_featured),
        'demo', count(*) filter (where deleted_at is null and is_demo),
        'new_in_period', count(*) filter (where deleted_at is null and created_at >= v_since)
      )
      from public.properties where organization_id = p_org
    ),
    'totals', (
      select jsonb_build_object(
        'views', coalesce(sum(view_count), 0),
        'favorites', coalesce(sum(favorite_count), 0),
        'whatsapp_clicks', coalesce(sum(whatsapp_click_count), 0),
        'phone_clicks', coalesce(sum(phone_click_count), 0)
      )
      from public.property_stats where organization_id = p_org
    ),
    'period', (
      select jsonb_build_object(
        'days', greatest(1, least(p_days, 365)),
        'views', count(*) filter (where event_type = 'view'),
        'unique_visitors', count(distinct session_hash) filter (where event_type = 'view'),
        'phone_clicks', count(*) filter (where event_type = 'phone_click'),
        'whatsapp_clicks', count(*) filter (where event_type = 'whatsapp_click'),
        'favorites', count(*) filter (where event_type = 'favorite_add'),
        'shares', count(*) filter (where event_type = 'share'),
        'qr_visits', count(*) filter (where event_type = 'qr_visit')
      )
      from public.property_events where organization_id = p_org and created_at >= v_since
    ),
    'leads', (
      select jsonb_build_object(
        'new', count(*) filter (where status = 'new' and deleted_at is null),
        'open', count(*) filter (where status not in ('closed', 'cancelled') and deleted_at is null),
        'in_period', count(*) filter (where created_at >= v_since and deleted_at is null)
      )
      from public.leads where organization_id = p_org
    ),
    'lead_sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'count', c) order by c desc)
        from (select source, count(*) as c from public.leads
               where organization_id = p_org and created_at >= v_since and deleted_at is null
               group by source) s
    ), '[]'::jsonb),
    'appointments', (
      select jsonb_build_object(
        'upcoming', count(*) filter (where status in ('requested', 'confirmed') and scheduled_at >= now()),
        'requested', count(*) filter (where status = 'requested' and scheduled_at >= now())
      )
      from public.appointments where organization_id = p_org
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views, 'visitors', d.visitors, 'leads', d.leads) order by d.day)
        from (
          select g.day::date as day,
                 (select count(*) from public.property_events e
                   where e.organization_id = p_org and e.event_type = 'view'
                     and e.created_at >= g.day and e.created_at < g.day + interval '1 day') as views,
                 (select count(distinct e.session_hash) from public.property_events e
                   where e.organization_id = p_org and e.event_type = 'view'
                     and e.created_at >= g.day and e.created_at < g.day + interval '1 day') as visitors,
                 (select count(*) from public.leads l
                   where l.organization_id = p_org and l.deleted_at is null
                     and l.created_at >= g.day and l.created_at < g.day + interval '1 day') as leads
            from generate_series(v_since, date_trunc('day', now()), interval '1 day') as g(day)
        ) d
    ), '[]'::jsonb),
    'top_viewed', coalesce((
      select jsonb_agg(t order by t.views desc)
        from (
          select p.id, p.reference_no, p.title, p.slug, count(*) as views
            from public.property_events e
            join public.properties p on p.id = e.property_id
           where e.organization_id = p_org and e.event_type = 'view' and e.created_at >= v_since
           group by p.id, p.reference_no, p.title, p.slug
           order by count(*) desc
           limit 5
        ) t
    ), '[]'::jsonb),
    'top_favorited', coalesce((
      select jsonb_agg(t order by t.favorites desc)
        from (
          select p.id, p.reference_no, p.title, p.slug, count(*) as favorites
            from public.property_events e
            join public.properties p on p.id = e.property_id
           where e.organization_id = p_org and e.event_type = 'favorite_add' and e.created_at >= v_since
           group by p.id, p.reference_no, p.title, p.slug
           order by count(*) desc
           limit 5
        ) t
    ), '[]'::jsonb),
    'popular_locations', coalesce((
      select jsonb_agg(t order by t.views desc)
        from (
          select d.name as district, n.name as neighborhood, count(*) as views
            from public.property_events e
            join public.properties p on p.id = e.property_id
            left join public.districts d on d.id = p.district_id
            left join public.neighborhoods n on n.id = p.neighborhood_id
           where e.organization_id = p_org and e.event_type = 'view' and e.created_at >= v_since
           group by d.name, n.name
           order by count(*) desc
           limit 6
        ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Benzer ilanlar — deterministik puanlama (en fazla 95):
--   emlak tipi aynı 30 / sadece kategori aynı 18
--   mahalle aynı 25 / ilçe aynı 15 / il aynı 5
--   fiyat yakınlığı ≤20, m² yakınlığı ≤10, oda sayısı aynı 10 / ±1 5
-- Aynı organizasyon, aynı ilan türü (satılık/kiralık), yalnızca yayındakiler.
-- -----------------------------------------------------------------------------
create or replace function public.similar_properties(p_property_id uuid, p_limit integer default 8)
returns table (id uuid, score numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select * from public.properties where id = p_property_id
  )
  select p.id,
         round(
           (case when p.property_type_id = b.property_type_id then 30 when p.category = b.category then 18 else 0 end)
         + (case when b.neighborhood_id is not null and p.neighborhood_id = b.neighborhood_id then 25
                 when p.district_id = b.district_id then 15
                 when p.city_id = b.city_id then 5 else 0 end)
         + (case when b.price > 0 and p.price > 0 and p.currency = b.currency
                 then 20 * greatest(0, 1 - abs(p.price - b.price) / b.price) else 0 end)
         + (case when b.gross_m2 > 0 and p.gross_m2 > 0
                 then 10 * greatest(0, 1 - abs(p.gross_m2 - b.gross_m2)::numeric / b.gross_m2) else 0 end)
         + (case when b.room_count is null or p.room_count is null then 0
                 when p.room_count = b.room_count then 10
                 when abs(p.room_count - b.room_count) = 1 then 5 else 0 end)
         , 2) as score
    from public.properties p
    cross join base b
   where p.organization_id = b.organization_id
     and p.id <> b.id
     and p.listing_type = b.listing_type
     and p.status = 'published'
     and p.deleted_at is null
   order by score desc, p.published_at desc nulls last, p.id
   limit least(greatest(p_limit, 1), 24);
$$;

-- -----------------------------------------------------------------------------
-- Bölge istatistikleri: yalnızca yayındaki ilanlardan, en az 3 ilan varsa.
-- (Az sayıda ilandan yanıltıcı "ortalama" üretilmez.)
-- -----------------------------------------------------------------------------
create or replace function public.region_price_stats(
  p_org uuid,
  p_city integer,
  p_district integer default null,
  p_neighborhood integer default null
)
returns table (
  listing_type public.listing_type,
  currency public.currency_code,
  listing_count bigint,
  min_price numeric,
  median_price numeric,
  max_price numeric,
  median_price_per_m2 numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.listing_type, p.currency, count(*),
         min(p.price), round(percentile_cont(0.5) within group (order by p.price)::numeric, 0), max(p.price),
         round(percentile_cont(0.5) within group (order by p.price / nullif(p.gross_m2, 0))::numeric, 0)
    from public.properties p
   where p.organization_id = p_org
     and p.status = 'published' and p.deleted_at is null
     and p.city_id = p_city
     and (p_district is null or p.district_id = p_district)
     and (p_neighborhood is null or p.neighborhood_id = p_neighborhood)
     and p.price > 0
   group by p.listing_type, p.currency
  having count(*) >= 3;
$$;

-- Bölge bazlı yayındaki ilan sayıları (ana sayfa "Bölgeler")
create or replace function public.region_listing_counts(p_org uuid)
returns table (
  city_slug text, city_name text,
  district_slug text, district_name text,
  neighborhood_slug text, neighborhood_name text,
  listing_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.slug, c.name, d.slug, d.name, n.slug, n.name, count(*)
    from public.properties p
    join public.cities c on c.id = p.city_id
    join public.districts d on d.id = p.district_id
    left join public.neighborhoods n on n.id = p.neighborhood_id
   where p.organization_id = p_org and p.status = 'published' and p.deleted_at is null
   group by c.slug, c.name, d.slug, d.name, n.slug, n.name
   order by count(*) desc;
$$;

-- -----------------------------------------------------------------------------
-- Müşteri koleksiyonu (herkese açık, token ile). Token 256 bit rastgeledir.
-- Süresi dolmuş / iptal edilmiş koleksiyon içerik döndürmez.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_collection(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_col public.collections;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select c.* into v_col
    from public.collections c
    join public.organizations o on o.id = c.organization_id and o.status = 'active'
   where c.token = p_token;

  if v_col.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_col.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'organization_id', v_col.organization_id);
  end if;
  if v_col.expires_at is not null and v_col.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'organization_id', v_col.organization_id);
  end if;

  update public.collections set view_count = view_count + 1, last_viewed_at = now() where id = v_col.id;

  return jsonb_build_object(
    'status', 'ok',
    'organization_id', v_col.organization_id,
    'title', v_col.title,
    'message', v_col.message,
    'created_at', v_col.created_at,
    'expires_at', v_col.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('property_id', i.property_id, 'note', i.note) order by i.sort_order, i.created_at)
        from public.collection_items i
        join public.properties p on p.id = i.property_id
       where i.collection_id = v_col.id
         and p.status in ('published', 'sold', 'rented') and p.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Medya: kapak ve sıralama (SECURITY INVOKER → media.manage RLS'i geçerli)
-- -----------------------------------------------------------------------------
create or replace function public.set_property_cover(p_media_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_property uuid;
begin
  select property_id into v_property from public.media_assets where id = p_media_id and status = 'ready';
  if v_property is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.media_assets set is_cover = false where property_id = v_property and is_cover and id <> p_media_id;
  update public.media_assets set is_cover = true where id = p_media_id;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.reorder_property_media(p_property_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing uuid[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_existing
    from public.media_assets where property_id = p_property_id and status = 'ready';
  if v_existing is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(p_ids) x) then
    raise exception 'media_set_mismatch' using errcode = 'P0001',
      hint = 'Fotoğraf listesi güncel değil; sayfayı yenileyip tekrar deneyin.';
  end if;
  update public.media_assets m
     set sort_order = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where m.id = o.id and m.property_id = p_property_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Toplu ilan işlemleri: her ilan ayrı alt işlemde; başarısız olanlar raporlanır.
-- SECURITY INVOKER: her güncelleme RLS + tetikleyici kurallarına tabidir.
-- -----------------------------------------------------------------------------
create or replace function public.bulk_property_action(p_ids uuid[], p_action text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_ok uuid[] := '{}';
  v_failed jsonb := '[]'::jsonb;
  v_msg text;
  v_detail text;
  v_hint text;
  v_count integer;
begin
  if p_action not in ('publish', 'archive', 'delete', 'restore', 'feature', 'unfeature', 'purge') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if cardinality(p_ids) > 100 then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;

  foreach v_id in array p_ids loop
    begin
      case p_action
        when 'publish' then update public.properties set status = 'published' where id = v_id and deleted_at is null;
        when 'archive' then update public.properties set status = 'archived' where id = v_id and deleted_at is null;
        when 'delete' then update public.properties set deleted_at = now() where id = v_id and deleted_at is null;
        when 'restore' then update public.properties set deleted_at = null where id = v_id and deleted_at is not null;
        when 'feature' then update public.properties set is_featured = true where id = v_id and deleted_at is null;
        when 'unfeature' then update public.properties set is_featured = false where id = v_id and deleted_at is null;
        when 'purge' then delete from public.properties where id = v_id and deleted_at is not null;
      end case;
      get diagnostics v_count = row_count;
      if v_count = 0 then
        v_failed := v_failed || jsonb_build_object('id', v_id, 'error', 'not_found_or_forbidden');
      else
        v_ok := v_ok || v_id;
      end if;
    exception when others then
      get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail, v_hint = pg_exception_hint;
      v_failed := v_failed || jsonb_build_object('id', v_id, 'error', v_msg, 'detail', v_detail, 'hint', v_hint);
    end;
  end loop;

  return jsonb_build_object('ok', to_jsonb(v_ok), 'failed', v_failed);
end;
$$;

-- -----------------------------------------------------------------------------
-- Ekip listesi (e-posta ve son giriş yalnızca users.manage yetkisiyle)
-- -----------------------------------------------------------------------------
create or replace function public.list_org_members(p_org uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.org_role,
  status public.member_status,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  password_change_required boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_manage boolean := public.has_org_permission(p_org, 'users.manage');
begin
  if not v_manage and not exists (select 1 from public.user_org_ids() as x(id) where x.id = p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.full_name,
           case when v_manage then u.email::text end,
           m.role, m.status, m.created_at,
           case when v_manage then u.last_sign_in_at end,
           case when v_manage then p.password_change_required end
      from public.organization_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id
     where m.organization_id = p_org
     order by m.created_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- Plan kullanımı ve depolama kotası
-- -----------------------------------------------------------------------------
create or replace function public.org_usage(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan record;
begin
  if not exists (select 1 from public.user_org_ids() as x(id) where x.id = p_org)
     and not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_plan from public.org_plan(p_org);
  return jsonb_build_object(
    'plan_id', v_plan.plan_id,
    'subscription_status', v_plan.subscription_status,
    'limits', jsonb_build_object(
      'users', v_plan.max_users, 'properties', v_plan.max_properties, 'storage_mb', v_plan.max_storage_mb),
    'features', jsonb_build_object(
      'crm', coalesce(v_plan.crm_enabled, false), 'analytics', coalesce(v_plan.analytics_enabled, false),
      'pdf', coalesce(v_plan.pdf_enabled, false), 'custom_domain', coalesce(v_plan.custom_domain_enabled, false)),
    'usage', jsonb_build_object(
      'users', (select count(*) from public.organization_members where organization_id = p_org and status = 'active'),
      'properties', (select count(*) from public.properties where organization_id = p_org and deleted_at is null),
      'storage_bytes', (select coalesce(sum(coalesce(byte_size, 0) + variants_byte_size), 0)
                          from public.media_assets where organization_id = p_org))
  );
end;
$$;

create or replace function public.media_upload_allowed(p_org uuid, p_bytes bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  if not public.has_org_permission(p_org, 'media.manage') then
    return false;
  end if;
  select max_storage_mb into v_limit from public.org_plan(p_org);
  if v_limit is null then
    return true;
  end if;
  -- Varyantlar için orijinalin ~%35'i kadar pay bırakılır
  return (
    select coalesce(sum(coalesce(byte_size, 0) + variants_byte_size), 0)
      from public.media_assets where organization_id = p_org
  ) + (p_bytes * 1.35)::bigint <= v_limit::bigint * 1024 * 1024;
end;
$$;

-- -----------------------------------------------------------------------------
-- Yarım kalmış yüklemeler (imzalı yükleme adresi 24 saatte geçersiz olur).
-- Sunucu dosyaları Storage API ile siler, ardından satırları kaldırır.
-- -----------------------------------------------------------------------------
create or replace function public.stale_media(p_older_than interval default interval '24 hours')
returns table (id uuid, organization_id uuid, original_path text, public_base text, variant_widths smallint[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.organization_id, m.original_path, m.public_base, m.variant_widths
    from public.media_assets m
   where m.status in ('pending', 'failed')
     and m.created_at < now() - p_older_than
   order by m.created_at
   limit 500;
$$;

-- Kullanıcı ilk girişte şifresini değiştirdiğinde kendi bayrağını temizler
create or replace function public.clear_password_change_required()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set password_change_required = false where id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Süper admin (platform) fonksiyonları — is_super_admin() veritabanında doğrulanır
-- -----------------------------------------------------------------------------
create or replace function public.assert_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.platform_organizations()
returns table (
  id uuid, slug text, name text, reference_prefix text, status public.org_status, is_default boolean,
  created_at timestamptz, plan_id text, subscription_status public.subscription_status,
  renewal_at timestamptz, trial_ends_at timestamptz,
  member_count bigint, property_count bigint, published_count bigint, storage_bytes bigint,
  leads_30d bigint, last_activity_at timestamptz, primary_domain text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select o.id, o.slug, o.name, o.reference_prefix, o.status, o.is_default, o.created_at,
           s.plan_id, s.status, s.renewal_at, s.trial_ends_at,
           (select count(*) from public.organization_members m where m.organization_id = o.id and m.status = 'active'),
           (select count(*) from public.properties p where p.organization_id = o.id and p.deleted_at is null),
           (select count(*) from public.properties p where p.organization_id = o.id and p.deleted_at is null and p.status = 'published'),
           (select coalesce(sum(coalesce(ma.byte_size, 0) + ma.variants_byte_size), 0)::bigint from public.media_assets ma where ma.organization_id = o.id),
           (select count(*) from public.leads l where l.organization_id = o.id and l.created_at > now() - interval '30 days'),
           (select max(a.created_at) from public.audit_logs a where a.organization_id = o.id),
           (select d.hostname from public.organization_domains d where d.organization_id = o.id and d.is_primary)
      from public.organizations o
      left join public.subscriptions s on s.organization_id = o.id and s.status in ('trialing', 'active', 'past_due')
     order by o.is_default desc, o.created_at;
end;
$$;

create or replace function public.platform_users(p_search text default null, p_limit integer default 100)
returns table (
  user_id uuid, email text, full_name text, is_super_admin boolean,
  created_at timestamptz, last_sign_in_at timestamptz, memberships jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select u.id, u.email::text, p.full_name, coalesce(p.is_super_admin, false), u.created_at, u.last_sign_in_at,
           coalesce((
             select jsonb_agg(jsonb_build_object('organization', o.name, 'slug', o.slug, 'role', m.role, 'status', m.status))
               from public.organization_members m join public.organizations o on o.id = m.organization_id
              where m.user_id = u.id
           ), '[]'::jsonb)
      from auth.users u
      left join public.profiles p on p.id = u.id
     where p_search is null
        or u.email ilike '%' || p_search || '%'
        or p.full_name ilike '%' || p_search || '%'
     order by u.created_at desc
     limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function public.platform_set_org_status(p_org uuid, p_status public.org_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if p_status <> 'active' and exists (select 1 from public.organizations where id = p_org and is_default) then
    raise exception 'default_org_must_stay_active' using errcode = 'P0001',
      hint = 'Varsayılan kiracı askıya alınamaz.';
  end if;
  update public.organizations set status = p_status where id = p_org;
end;
$$;

create or replace function public.platform_set_org_plan(p_org uuid, p_plan text, p_status public.subscription_status default 'active')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;
  update public.subscriptions set status = 'cancelled', cancelled_at = now()
   where organization_id = p_org and status in ('trialing', 'active', 'past_due');
  insert into public.subscriptions (organization_id, plan_id, status, started_at, trial_ends_at)
  values (p_org, p_plan, p_status, now(), case when p_status = 'trialing' then now() + interval '14 days' end);
end;
$$;

create or replace function public.platform_create_organization(
  p_slug text, p_name text, p_prefix text, p_plan text, p_owner uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  perform public.assert_super_admin();
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'invalid_plan' using errcode = 'P0001';
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
  return v_org;
end;
$$;

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
  if p_primary then
    update public.organization_domains set is_primary = false where organization_id = p_org and is_primary;
  end if;
  insert into public.organization_domains (organization_id, hostname, is_primary, verified_at)
  values (p_org, lower(btrim(p_hostname)), p_primary, now())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.platform_remove_domain(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  delete from public.organization_domains where id = p_id;
end;
$$;

create or replace function public.platform_update_plan(
  p_id text, p_name text, p_max_users integer, p_max_properties integer, p_max_storage_mb integer,
  p_crm boolean, p_analytics boolean, p_pdf boolean, p_custom_domain boolean, p_price numeric
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.plans
     set name = p_name, max_users = p_max_users, max_properties = p_max_properties,
         max_storage_mb = p_max_storage_mb, crm_enabled = p_crm, analytics_enabled = p_analytics,
         pdf_enabled = p_pdf, custom_domain_enabled = p_custom_domain, price_monthly = p_price
   where id = p_id;
  if not found then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;
  perform public.write_audit(null, 'plan.updated', 'plan', p_id, p_name, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fonksiyon yetkileri (varsayılan PUBLIC yetkisi kapatılır, sonra açıkça verilir)
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end;
$$;

-- RLS politikalarında kullanılan yardımcılar herkes tarafından çağrılabilir olmalı
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.active_org_ids() to anon, authenticated;
grant execute on function public.user_org_ids(text) to anon, authenticated;
grant execute on function public.member_org_ids() to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

-- Herkese açık okumalar
grant execute on function public.similar_properties(uuid, integer) to anon, authenticated;
grant execute on function public.region_price_stats(uuid, integer, integer, integer) to anon, authenticated;
grant execute on function public.region_listing_counts(uuid) to anon, authenticated;
grant execute on function public.get_public_collection(text) to anon, authenticated;

-- Oturum açmış üyeler (içeride RLS / yetki kontrolü var)
grant execute on function public.org_dashboard(uuid, integer) to authenticated;
grant execute on function public.set_property_cover(uuid) to authenticated;
grant execute on function public.reorder_property_media(uuid, uuid[]) to authenticated;
grant execute on function public.bulk_property_action(uuid[], text) to authenticated;
grant execute on function public.list_org_members(uuid) to authenticated;
grant execute on function public.org_usage(uuid) to authenticated;
grant execute on function public.media_upload_allowed(uuid, bigint) to authenticated;
grant execute on function public.clear_password_change_required() to authenticated;
grant execute on function public.org_plan(uuid) to anon, authenticated;

-- Platform (içeride is_super_admin() doğrulaması)
grant execute on function public.platform_organizations() to authenticated;
grant execute on function public.platform_users(text, integer) to authenticated;
grant execute on function public.platform_set_org_status(uuid, public.org_status) to authenticated;
grant execute on function public.platform_set_org_plan(uuid, text, public.subscription_status) to authenticated;
grant execute on function public.platform_create_organization(text, text, text, text, uuid) to authenticated;
grant execute on function public.platform_add_domain(uuid, text, boolean) to authenticated;
grant execute on function public.platform_remove_domain(uuid) to authenticated;
grant execute on function public.platform_update_plan(text, text, integer, integer, integer, boolean, boolean, boolean, boolean, numeric) to authenticated;

-- Tetikleyicilerin sahibinin (postgres) çağırdığı iç fonksiyonlar service_role dışında kapalı kalır:
-- write_audit, log_security_event, next_org_counter, submit_lead, track_event, stale_media, purge_old_audit_logs...

-- ---------------------------------------------------------------------------
-- 20260926000008_v2_storage.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 8 — Depolama (Supabase Storage): kiracı izolasyonlu medya kovaları
--
--   media-originals (ÖZEL, 50 MB): yüklenen orijinal dosya (4K ve üzeri).
--       Ziyaretçiye hiçbir zaman gönderilmez; yalnızca organizasyon üyeleri
--       kısa süreli imzalı adresle indirebilir. EXIF/GPS bilgisi burada kalır.
--   media (HERKESE AÇIK, 10 MB): sunucuda üretilen WebP varyantları
--       (320…2880 px). Meta veriler (EXIF/GPS) temizlenmiştir. Dosya yolları
--       rastgele UUID içerir; kova listelemesi yalnızca üyelere açıktır.
--   branding (HERKESE AÇIK, 2 MB): logo ve favicon (sunucuda PNG'ye dönüştürülür).
--   property-images (V1, eski): yalnızca geriye dönük okuma ve silme.
--
-- Yol düzeni (ilk iki klasör RLS ile doğrulanır):
--   organizations/{organization_id}/properties/{property_id}/images/{media_id}/original.{jpg|png|webp|avif}
--   organizations/{organization_id}/properties/{property_id}/images/{media_id}/w{genişlik}.webp
--   organizations/{organization_id}/branding/{dosya}.png
-- Tenant A, Tenant B'nin klasöründe OKUMA/YAZMA/GÜNCELLEME/SİLME yapamaz.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-originals', 'media-originals', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('media', 'media', true, 10485760, array['image/webp', 'image/jpeg', 'image/avif']),
  ('branding', 'branding', true, 2097152, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Eski kova: yeni yükleme kabul etmez
update storage.buckets set allowed_mime_types = array['image/webp'], file_size_limit = 1
 where id = 'property-images';

-- Orijinaller (özel)
create policy "media_originals_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );

-- Varyantlar (herkese açık okuma URL ile; API üzerinden listeleme/yazma üyelere)
create policy "media_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );

-- Marka görselleri
create policy "branding_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );

-- V1 kovası: ilanın organizasyonunda medya yetkisi olan silebilir (geçiş temizliği)
create policy "legacy_property_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = 'properties'
    and (storage.foldername(name))[2] in (
      select p.id::text from public.properties p
       where p.organization_id in (select x.id from public.user_org_ids('media.manage') as x(id))
    )
  );

-- ---------------------------------------------------------------------------
-- 20260926000009_v2_reference_data.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 9 — Referans veriler: "Diğer" kategorisi emlak tipleri
-- (Ticari kategori V1 "işyeri" tiplerini aynen kullanır.)
-- =============================================================================

insert into public.property_types (category, name, slug, sort_order) values
  ('diger', 'Turistik Tesis', 'turistik-tesis', 310),
  ('diger', 'Diğer', 'diger', 320)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 20260927000001_v2_platform_fixes.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- V2 / 10 — Platform düzeltmesi: süper admin'in yeni organizasyona sahip
-- (owner) üyeliği ekleyebilmesi.
--
-- Sorun: platform_create_organization() sahip üyeliğini eklerken
-- organization_members_guard tetikleyicisi, işlemi yapan kullanıcının (süper
-- admin) yeni organizasyonda zaten sahip olmasını bekliyordu ve işlem
-- 'owner_required' hatasıyla geri alınıyordu.
--
-- Düzeltme (yalnızca süper admin için):
--   • Sahip (owner) rolü kuralları uygulanmaz.
--   • Süper admin kendisini yeni bir organizasyona sahip olarak ekleyebilir (INSERT).
-- Plan kullanıcı limiti ve "son aktif sahip" koruması HERKES için geçerlidir.
-- Normal kullanıcıların davranışı değişmez. Süper adminler başka bir
-- organizasyonun üyelik tablosuna RLS nedeniyle doğrudan yazamaz; bu yol
-- platform_* fonksiyonları içindir.
--
-- Ayrıca organizasyonun kendisi silinirken (zincirleme silme) üyelik kuralları
-- atlanır; aksi halde organizasyon hiç silinemiyordu.
--
-- Mevcut verileri değiştirmez; yalnızca fonksiyonları ve yetkileri günceller
-- (create or replace / grant → tekrar çalıştırılması güvenlidir).
-- =============================================================================

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
  v_super boolean := false;
begin
  -- Organizasyonun kendisi siliniyorsa (zincirleme silme) üyelik kuralları uygulanmaz
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = v_org) then
    return old;
  end if;

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

  v_super := public.is_super_admin();

  if v_actor = v_target_user and not (v_super and tg_op = 'INSERT') then
    raise exception 'cannot_modify_self' using errcode = '42501',
      hint = 'Kendi rolünüzü veya üyeliğinizi değiştiremezsiniz.';
  end if;

  select m.role into v_actor_role from public.organization_members m
   where m.organization_id = v_org and m.user_id = v_actor and m.status = 'active';

  if not v_super and v_actor_role is distinct from 'owner' and (
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

-- =============================================================================
-- Organizasyon silinebilmeli (ör. KVKK kapsamında veri silme talebi).
--
-- Sorun: organizasyon silinirken zincirleme silinen alt kayıtların (alan adı,
-- üyelik, ilan, medya...) denetim tetikleyicileri, silinmekte olan
-- organizasyona ait yeni bir denetim kaydı yazmaya çalışıyor; yabancı anahtar
-- ihlali nedeniyle tüm silme işlemi geri alınıyordu.
-- Düzeltme: organizasyon artık yoksa o organizasyona kayıt yazılmaz (kayıtları
-- zaten organizasyonla birlikte silinir). Platform kayıtları (p_org null) ve
-- normal işlemler etkilenmez.
-- =============================================================================
create or replace function public.write_audit(
  p_org uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if p_org is not null and not exists (select 1 from public.organizations o where o.id = p_org) then
    return;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, v_actor, public.audit_actor_label(v_actor), p_action, p_target_type, p_target_id,
          left(p_target_label, 200), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- =============================================================================
-- Medya: anonim ziyaretçiye yalnızca görüntüleme için gereken sütunlar.
--
-- media_public_read politikası yayındaki ilanların hazır görsellerini herkese
-- açar; ancak tablo düzeyindeki SELECT yetkisi iç sütunları da (orijinal dosya
-- adı, özel depolama yolu, yükleyen kullanıcı, hata metni, dosya boyutu)
-- anonim kullanıcıya gösteriyordu. Sütun düzeyinde yetkiyle yalnızca sitede
-- kullanılan alanlar açık bırakılır. Oturum açmış kullanıcıların (yönetim
-- paneli) yetkileri değişmez.
-- =============================================================================
revoke select on public.media_assets from anon;
grant select (
  id, property_id, kind, status, public_base, legacy_path, variant_widths,
  width, height, blur_data_url, alt_text, sort_order, is_cover
) on public.media_assets to anon;

-- =============================================================================
-- Silinen ilanın adresi için yönlendirme: organizasyonun kendisi silinirken
-- (zincirleme silme) yönlendirme eklenmez; aksi halde silinmekte olan
-- organizasyona kayıt eklenmeye çalışılıyor ve organizasyon silinemiyordu.
-- =============================================================================
create or replace function public.properties_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text;
begin
  if old.published_at is null
     or not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  v_target := case
    when old.category = 'arsa' then '/arsa'
    when old.category = 'ticari' then '/ticari'
    when old.listing_type = 'rent' then '/kiralik'
    else '/satilik'
  end;
  insert into public.redirects (organization_id, from_path, to_path, status_code)
  values (old.organization_id, '/ilan/' || old.slug, v_target, 301)
  on conflict (organization_id, from_path) do update set to_path = excluded.to_path, status_code = 301;
  update public.redirects set to_path = v_target
   where organization_id = old.organization_id and to_path = '/ilan/' || old.slug;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- 20260928000001_stage3_notifications.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Stage 3 / 1 — Talep bildirimleri
--
-- • organization_notification_settings: bildirim alıcıları ve açma/kapama
--   (yalnızca ofisin ayar yetkisi olan kullanıcıları okur/yazar).
-- • notification_deliveries: gönderilen/başarısız bildirimlerin kaydı
--   (hangi talep için, hangi kanal, sonuç). İleride WhatsApp/webhook kanalları
--   aynı tabloya eklenir.
--
-- Yalnızca EKLEME yapar; mevcut veri ve politikalar değişmez. Tekrar
-- çalıştırılması güvenlidir (if not exists / create or replace).
-- =============================================================================

-- Bildirim ayarları ayrı tabloda tutulur: organization_settings herkese açık
-- okunur (site bilgileri), bildirim alıcı adresleri ise yalnızca ofisin ayar
-- yetkisi olan kullanıcılarına görünür.
create table if not exists public.organization_notification_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  notify_new_lead boolean not null default true,
  emails text[] not null default '{}' check (cardinality(emails) <= 5),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.organization_notification_settings enable row level security;

drop policy if exists org_notification_settings_select on public.organization_notification_settings;
create policy org_notification_settings_select on public.organization_notification_settings
  for select to authenticated
  using (organization_id in (select public.user_org_ids('settings.manage')));

drop policy if exists org_notification_settings_insert on public.organization_notification_settings;
create policy org_notification_settings_insert on public.organization_notification_settings
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids('settings.manage')));

drop policy if exists org_notification_settings_update on public.organization_notification_settings;
create policy org_notification_settings_update on public.organization_notification_settings
  for update to authenticated
  using (organization_id in (select public.user_org_ids('settings.manage')))
  with check (organization_id in (select public.user_org_ids('settings.manage')));

-- Denetim kaydı: bildirim alıcılarını değiştirmek (talepleri başka adrese
-- yönlendirmek) güvenlik açısından önemlidir; "settings.updated" olarak yazılır.
create or replace function public.audit_notification_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    v_fields := array['notify_new_lead', 'notify_emails'];
  else
    if new.notify_new_lead is distinct from old.notify_new_lead then v_fields := v_fields || 'notify_new_lead'; end if;
    if new.emails is distinct from old.emails then v_fields := v_fields || 'notify_emails'; end if;
  end if;
  if cardinality(v_fields) > 0 then
    perform public.write_audit(new.organization_id, 'settings.updated', 'settings', new.organization_id::text, null,
      jsonb_build_object('fields', to_jsonb(v_fields)));
  end if;
  return null;
end;
$$;

drop trigger if exists audit_notification_settings on public.organization_notification_settings;
create trigger audit_notification_settings after insert or update on public.organization_notification_settings
  for each row execute function public.audit_notification_settings();

revoke all on public.organization_notification_settings from anon;
revoke delete, truncate on public.organization_notification_settings from authenticated;
grant select, insert, update on public.organization_notification_settings to authenticated;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'webhook')),
  event text not null check (event in ('lead.created', 'test')),
  lead_id uuid references public.leads (id) on delete set null,
  recipients text[] not null default '{}',
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text not null,
  provider_message_id text,
  -- Kısa hata özeti; gizli anahtar veya kişisel veri yazılmaz
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_org_created_idx
  on public.notification_deliveries (organization_id, created_at desc);
create index if not exists notification_deliveries_lead_idx
  on public.notification_deliveries (lead_id) where lead_id is not null;

alter table public.notification_deliveries enable row level security;

-- Okuma: ayar yetkisi olan ofis kullanıcıları (kendi ofisi). Yazma yalnızca
-- sunucu (service_role) üzerinden yapılır; authenticated için yazma politikası yoktur.
drop policy if exists notification_deliveries_select on public.notification_deliveries;
create policy notification_deliveries_select on public.notification_deliveries
  for select to authenticated
  using (organization_id in (select public.user_org_ids('settings.manage')));

revoke all on public.notification_deliveries from anon;
revoke insert, update, delete on public.notification_deliveries from authenticated;
grant select on public.notification_deliveries to authenticated;

-- ---------------------------------------------------------------------------
-- 20260928000002_stage3_mfa.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Stage 3 / 2 — Yönetici iki adımlı doğrulama (MFA / TOTP)
--
-- Supabase Auth TOTP faktörlerini kullanır. Veritabanı katmanında zorunluluk:
--   1) Doğrulanmış MFA faktörü olan bir kullanıcı, oturumu "aal2" (kod girilmiş)
--      değilse hiçbir organizasyon verisine erişemez.
--   2) Organizasyon "yöneticiler için MFA zorunlu" ise sahip (owner) ve
--      yönetici (admin) rolündekiler aal2 olmadan erişemez.
-- Bu kurallar RLS'in merkezindeki user_org_ids() fonksiyonuna eklenir; böylece
-- tüm tablo ve depolama politikaları otomatik uygular (API'ye doğrudan istekle
-- atlatılamaz). Süper admin yetkisi (is_super_admin) için de 1. kural geçerlidir.
--
-- MFA kullanmayan ve zorunluluk olmayan kullanıcıların davranışı DEĞİŞMEZ.
-- Tekrar çalıştırılması güvenlidir.
-- =============================================================================

alter table public.organizations
  add column if not exists require_admin_mfa boolean not null default false;

-- Oturumun doğrulama seviyesi (JWT "aal" talebi). Talep yoksa aal1 sayılır.
create or replace function public.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1');
$$;

-- Kullanıcının doğrulanmış (kurulumu tamamlanmış) MFA faktörü var mı
create or replace function public.user_has_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
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
     )
     and (
       (select public.session_aal()) = 'aal2'
       or (
         not (select public.user_has_mfa())
         and not (o.require_admin_mfa and m.role in ('owner', 'admin'))
       )
     );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false)
     and ((select public.session_aal()) = 'aal2' or not (select public.user_has_mfa()));
$$;

-- Sahip, zorunluluğu açıp kapatabilir. Kilitlenmeyi önlemek için işlemi yapan
-- sahibin kendi oturumu aal2 olmalıdır (önce kendisi MFA kurmuş olmalı).
create or replace function public.set_require_admin_mfa(p_org uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org and m.user_id = (select auth.uid())
       and m.status = 'active' and m.role = 'owner'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select public.session_aal()) <> 'aal2' then
    raise exception 'mfa_required' using errcode = 'P0001';
  end if;
  update public.organizations set require_admin_mfa = p_value where id = p_org;
  perform public.write_audit(p_org, 'settings.updated', 'settings', p_org::text, null,
    jsonb_build_object('fields', jsonb_build_array('require_admin_mfa'), 'value', p_value));
end;
$$;

-- Ekip listesinde MFA durumu (yalnızca kullanıcı yönetimi yetkisi olanlar)
create or replace function public.org_member_mfa_status(p_org uuid)
returns table (user_id uuid, mfa_enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_org_permission(p_org, 'users.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id,
           exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
      from public.organization_members m
     where m.organization_id = p_org;
end;
$$;

revoke all on function public.set_require_admin_mfa(uuid, boolean) from public, anon;
revoke all on function public.org_member_mfa_status(uuid) from public, anon;
revoke all on function public.user_has_mfa() from public, anon;
grant execute on function public.set_require_admin_mfa(uuid, boolean) to authenticated;
grant execute on function public.org_member_mfa_status(uuid) to authenticated;
grant execute on function public.user_has_mfa() to authenticated;
grant execute on function public.session_aal() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 20260928000003_stage3_location_codes.sql
-- ---------------------------------------------------------------------------
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

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260926000002', 'v2_tenancy'),
  ('20260926000003', 'v2_properties'),
  ('20260926000004', 'v2_crm'),
  ('20260926000005', 'v2_content'),
  ('20260926000006', 'v2_audit'),
  ('20260926000007', 'v2_security'),
  ('20260926000008', 'v2_storage'),
  ('20260926000009', 'v2_reference_data'),
  ('20260927000001', 'v2_platform_fixes'),
  ('20260928000001', 'stage3_notifications'),
  ('20260928000002', 'stage3_mfa'),
  ('20260928000003', 'stage3_location_codes')
on conflict (version) do nothing;

-- API şema önbelleğini yenile
notify pgrst, 'reload schema';
