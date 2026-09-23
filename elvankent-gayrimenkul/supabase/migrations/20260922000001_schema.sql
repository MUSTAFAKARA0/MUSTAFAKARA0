-- =============================================================================
-- Elvankent Gayrimenkul — Veritabanı şeması
-- Tablolar, enum tipleri, indeksler ve veri bütünlüğü tetikleyicileri.
-- Güvenlik (RLS) politikaları: 20260922000002_security.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum tipleri
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'agent', 'member');
create type public.listing_type as enum ('sale', 'rent');
create type public.property_category as enum ('konut', 'isyeri', 'arsa');
create type public.property_status as enum ('draft', 'active', 'passive', 'sold', 'rented');
create type public.currency_code as enum ('TRY', 'USD', 'EUR');
create type public.location_precision as enum ('exact', 'approximate', 'neighborhood');
create type public.contact_status as enum ('new', 'read', 'replied', 'archived');
create type public.property_event_type as enum (
  'view', 'phone_click', 'whatsapp_click', 'contact_form', 'favorite_add', 'share'
);

-- -----------------------------------------------------------------------------
-- Ortak yardımcılar
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Kullanıcı profilleri (auth.users ile 1-1)
-- role: 'admin' yönetim paneline erişir. 'agent' ve 'member' ileride
-- danışman profilleri ve müşteri üyelikleri için ayrılmıştır.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role public.user_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Yeni auth kullanıcısı için otomatik profil (varsayılan rol: member)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Site ayarları (tek satır). Kodda sabit yazılmayan işletme bilgileri.
-- -----------------------------------------------------------------------------
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Elvankent Gayrimenkul' check (char_length(business_name) between 2 and 120),
  tagline text check (char_length(tagline) <= 200),
  phone text check (char_length(phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  email text check (char_length(email) <= 160),
  address text check (char_length(address) <= 400),
  working_hours text check (char_length(working_hours) <= 400),
  logo_url text check (char_length(logo_url) <= 500),
  about_text text check (char_length(about_text) <= 6000),
  office_latitude numeric(9, 6),
  office_longitude numeric(9, 6),
  instagram_url text check (char_length(instagram_url) <= 300),
  facebook_url text check (char_length(facebook_url) <= 300),
  x_url text check (char_length(x_url) <= 300),
  youtube_url text check (char_length(youtube_url) <= 300),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  updated_at timestamptz not null default now()
);

create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Konum hiyerarşisi: il > ilçe > mahalle
-- -----------------------------------------------------------------------------
create table public.cities (
  id serial primary key,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now()
);

create table public.districts (
  id serial primary key,
  city_id integer not null references public.cities (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.neighborhoods (
  id serial primary key,
  district_id integer not null references public.districts (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  created_at timestamptz not null default now(),
  unique (district_id, slug)
);

create index districts_city_idx on public.districts (city_id);
create index neighborhoods_district_idx on public.neighborhoods (district_id);

-- -----------------------------------------------------------------------------
-- Emlak tipleri (kategori: konut / işyeri / arsa)
-- -----------------------------------------------------------------------------
create table public.property_types (
  id serial primary key,
  category public.property_category not null,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0
);

-- -----------------------------------------------------------------------------
-- Özellik kataloğu (çoklu seçim: iç/dış/muhit/ulaşım/güvenlik...)
-- -----------------------------------------------------------------------------
create table public.features (
  id serial primary key,
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 2 and 60),
  feature_group text not null check (feature_group in ('ic', 'dis', 'muhit', 'ulasim')),
  sort_order integer not null default 0
);

-- -----------------------------------------------------------------------------
-- İlanlar
-- -----------------------------------------------------------------------------
create sequence public.property_listing_no_seq start with 100001;

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  listing_no bigint not null unique default nextval('public.property_listing_no_seq'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),

  -- Genel bilgiler
  title text not null check (char_length(title) between 10 and 120),
  description text not null check (char_length(description) between 30 and 10000),
  listing_type public.listing_type not null,
  property_type_id integer not null references public.property_types (id) on delete restrict,
  category public.property_category not null, -- property_type'tan tetikleyici ile doldurulur
  status public.property_status not null default 'draft',
  is_featured boolean not null default false,
  is_demo boolean not null default false,

  -- Fiyat
  price numeric(14, 2) not null check (price >= 0 and price < 1000000000000),
  currency public.currency_code not null default 'TRY',
  price_negotiable boolean not null default false,
  dues numeric(12, 2) check (dues >= 0),       -- aidat (aylık)
  deposit numeric(14, 2) check (deposit >= 0), -- depozito (kiralık)

  -- Konum (herkese açık kısım). Açık adres ve kesin koordinat property_locations'da.
  city_id integer not null references public.cities (id) on delete restrict,
  district_id integer not null references public.districts (id) on delete restrict,
  neighborhood_id integer references public.neighborhoods (id) on delete set null,
  public_latitude numeric(9, 6),
  public_longitude numeric(9, 6),
  location_precision public.location_precision not null default 'approximate',

  -- Temel özellikler
  gross_m2 integer check (gross_m2 > 0 and gross_m2 < 10000000),
  net_m2 integer check (net_m2 > 0 and net_m2 < 10000000),
  room_count smallint check (room_count between 0 and 50),
  living_room_count smallint check (living_room_count between 0 and 10),
  rooms_label text generated always as (
    case when room_count is null then null
      else room_count::text || '+' || coalesce(living_room_count, 0)::text end
  ) stored,
  building_age smallint check (building_age between 0 and 200),
  floor text check (char_length(floor) <= 30),
  total_floors smallint check (total_floors between 0 and 200),
  bathroom_count smallint check (bathroom_count between 0 and 20),
  balcony_count smallint check (balcony_count between 0 and 20),

  -- Detay özellikler
  heating text check (char_length(heating) <= 40),
  has_elevator boolean,
  parking text check (char_length(parking) <= 40),
  is_furnished boolean,
  in_complex boolean,
  complex_name text check (char_length(complex_name) <= 120),
  has_air_conditioning boolean,
  credit_eligible boolean,
  deed_status text check (char_length(deed_status) <= 40),
  usage_status text check (char_length(usage_status) <= 40),
  facades text[] not null default '{}',
  views text[] not null default '{}',
  swap_available boolean,

  -- Arsa detayları
  zoning_status text check (char_length(zoning_status) <= 40),
  block_no text check (char_length(block_no) <= 20),   -- ada
  parcel_no text check (char_length(parcel_no) <= 20),  -- parsel
  floor_area_ratio numeric(5, 2) check (floor_area_ratio >= 0), -- KAKS / emsal
  height_limit text check (char_length(height_limit) <= 30),     -- gabari

  -- SEO / meta
  meta_description text check (char_length(meta_description) <= 300),

  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_public_idx on public.properties (status, listing_type, category, created_at desc);
create index properties_price_idx on public.properties (price);
create index properties_district_idx on public.properties (district_id);
create index properties_neighborhood_idx on public.properties (neighborhood_id);
create index properties_featured_idx on public.properties (is_featured) where status = 'active';
create index properties_type_idx on public.properties (property_type_id);

create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Kategori, slug soneki ve yayın tarihi bütünlüğü
create or replace function public.properties_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_suffix text;
begin
  select pt.category into new.category from public.property_types pt where pt.id = new.property_type_id;
  if new.category is null then
    raise exception 'Geçersiz emlak tipi' using errcode = '23503';
  end if;

  -- İlçe il ile, mahalle ilçe ile tutarlı olmalı
  if not exists (select 1 from public.districts d where d.id = new.district_id and d.city_id = new.city_id) then
    raise exception 'İlçe seçilen ile ait değil' using errcode = '23514';
  end if;
  if new.neighborhood_id is not null and not exists (
    select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.district_id = new.district_id
  ) then
    raise exception 'Mahalle seçilen ilçeye ait değil' using errcode = '23514';
  end if;

  -- Slug her zaman ilan numarası ile biter → çakışma imkânsız
  v_suffix := '-' || new.listing_no::text;
  if new.slug is null or new.slug = '' then
    new.slug := 'ilan';
  end if;
  if right(new.slug, char_length(v_suffix)) <> v_suffix then
    new.slug := left(regexp_replace(new.slug, '-+$', ''), 120) || v_suffix;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger properties_before_write before insert or update on public.properties
  for each row execute function public.properties_before_write();

-- -----------------------------------------------------------------------------
-- Özel konum bilgisi (sadece yönetici). Herkese açık koordinat, hassasiyet
-- ayarına göre tetikleyici ile properties tablosuna yazılır.
-- -----------------------------------------------------------------------------
create table public.property_locations (
  property_id uuid primary key references public.properties (id) on delete cascade,
  address text check (char_length(address) <= 400),
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  precision public.location_precision not null default 'approximate',
  updated_at timestamptz not null default now()
);

create trigger property_locations_updated_at before update on public.property_locations
  for each row execute function public.set_updated_at();

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
    -- Mahalle (yoksa ilçe) merkezini göster
    select coalesce(n.latitude, d.latitude), coalesce(n.longitude, d.longitude)
      into v_lat, v_lng
      from public.properties p
      join public.districts d on d.id = p.district_id
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

create trigger property_locations_sync after insert or update on public.property_locations
  for each row execute function public.sync_public_location();

-- -----------------------------------------------------------------------------
-- İlan özellikleri (çoka-çok)
-- -----------------------------------------------------------------------------
create table public.property_features (
  property_id uuid not null references public.properties (id) on delete cascade,
  feature_id integer not null references public.features (id) on delete cascade,
  primary key (property_id, feature_id)
);

create index property_features_feature_idx on public.property_features (feature_id);

-- -----------------------------------------------------------------------------
-- İlan fotoğrafları
-- storage_path: Supabase Storage 'property-images' içindeki yol
-- ('/' ile başlıyorsa uygulamanın public/ klasöründeki yerel dosya — demo verisi).
-- -----------------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 400),
  width integer check (width > 0),
  height integer check (height > 0),
  blur_data_url text check (char_length(blur_data_url) <= 2000),
  alt text check (char_length(alt) <= 200),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index property_images_property_idx on public.property_images (property_id, sort_order);
create unique index property_images_one_cover_idx on public.property_images (property_id) where is_cover;

-- -----------------------------------------------------------------------------
-- İstatistik: olay kaydı + ilan başına sayaçlar
-- -----------------------------------------------------------------------------
create table public.property_events (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  event_type public.property_event_type not null,
  session_hash text check (char_length(session_hash) <= 128),
  created_at timestamptz not null default now()
);

create index property_events_property_idx on public.property_events (property_id, event_type, created_at desc);
create index property_events_created_idx on public.property_events (created_at desc);
create index property_events_session_idx on public.property_events (session_hash, created_at desc);

create table public.property_stats (
  property_id uuid primary key references public.properties (id) on delete cascade,
  view_count integer not null default 0,
  phone_click_count integer not null default 0,
  whatsapp_click_count integer not null default 0,
  contact_form_count integer not null default 0,
  favorite_count integer not null default 0,
  share_count integer not null default 0
);

-- -----------------------------------------------------------------------------
-- İletişim talepleri
-- -----------------------------------------------------------------------------
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 160),
  message text not null check (char_length(message) between 5 and 3000),
  source text not null default 'contact_page' check (source in ('contact_page', 'property_detail')),
  status public.contact_status not null default 'new',
  admin_note text check (char_length(admin_note) <= 2000),
  kvkk_consent boolean not null default false,
  ip_hash text check (char_length(ip_hash) <= 128),
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_requests_reachable check (phone is not null or email is not null)
);

create index contact_requests_created_idx on public.contact_requests (created_at desc);
create index contact_requests_ip_idx on public.contact_requests (ip_hash, created_at desc);
create index contact_requests_status_idx on public.contact_requests (status);

create trigger contact_requests_updated_at before update on public.contact_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Favoriler (üye kullanıcılar için; ziyaretçi favorileri tarayıcıda tutulur)
-- -----------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- -----------------------------------------------------------------------------
-- 301/302 yönlendirmeleri (eski URL'ler, silinen ilanlar)
-- -----------------------------------------------------------------------------
create table public.redirects (
  id bigint generated always as identity primary key,
  from_path text not null unique check (from_path ~ '^/' and char_length(from_path) <= 400),
  to_path text not null check (to_path ~ '^/' and char_length(to_path) <= 400),
  status_code smallint not null default 301 check (status_code in (301, 302, 307, 308)),
  created_at timestamptz not null default now(),
  constraint redirects_no_self check (from_path <> to_path)
);

-- Silinen ilanın adresi 404 yerine ilgili kategori sayfasına 301 ile yönlenir
create or replace function public.properties_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text;
begin
  v_target := case
    when old.category = 'arsa' then '/arsa'
    when old.category = 'isyeri' then '/isyeri'
    when old.listing_type = 'rent' then '/kiralik'
    else '/satilik'
  end;
  insert into public.redirects (from_path, to_path, status_code)
  values ('/ilan/' || old.slug, v_target, 301)
  on conflict (from_path) do update set to_path = excluded.to_path;
  return old;
end;
$$;

create trigger properties_after_delete after delete on public.properties
  for each row execute function public.properties_after_delete();
