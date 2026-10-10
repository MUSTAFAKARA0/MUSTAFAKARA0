-- =============================================================================
-- DEMO KURULUM 1/4 — V1 şeması
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
-- Otomatik üretildi (npm run demo:sql) — elle düzenlemeyin; kaynak: supabase/migrations
-- Boş, yeni bir Supabase projesinde SQL Editor > New query > yapıştır > Run.
-- =============================================================================

-- Güvenlik: yalnızca BOŞ veritabanında çalışır (canlı veritabanında V1 tabloları vardır → durur)
do $demo_guard$
begin
  if exists (select 1 from pg_tables where schemaname = 'public') then
    raise exception 'DURDURULDU: public şemasında tablo var. Bu dosya yalnızca YENİ ve BOŞ demo projesi içindir.';
  end if;
end
$demo_guard$;

-- DEMO işareti (sonraki dosyalar bunu arar). API'ye açık olmayan ayrı şemada tutulur.
create schema elvankent_demo;
revoke all on schema elvankent_demo from public;
create table elvankent_demo.environment (
  id int primary key default 1 check (id = 1),
  purpose text not null default 'DEMO — gerçek müşteri/ilan verisi içermez',
  created_at timestamptz not null default now()
);
insert into elvankent_demo.environment default values;

-- ---------------------------------------------------------------------------
-- 20260922000001_schema.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 20260922000002_security.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Elvankent Gayrimenkul — Güvenlik: RLS politikaları, yetkiler, RPC fonksiyonları
--
-- İlke: Ziyaretçi (anon) sadece yayındaki ilanları ve herkese açık referans
-- verilerini OKUR. Tüm yazma işlemleri ya yöneticiye (is_admin) ya da yalnızca
-- sunucunun çağırabildiği (service_role) fonksiyonlara açıktır.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Yetki kontrolü: veritabanı seviyesinde admin doğrulaması
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS'i tüm tablolarda aç
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.cities enable row level security;
alter table public.districts enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.property_types enable row level security;
alter table public.features enable row level security;
alter table public.properties enable row level security;
alter table public.property_locations enable row level security;
alter table public.property_features enable row level security;
alter table public.property_images enable row level security;
alter table public.property_events enable row level security;
alter table public.property_stats enable row level security;
alter table public.contact_requests enable row level security;
alter table public.favorites enable row level security;
alter table public.redirects enable row level security;

-- -----------------------------------------------------------------------------
-- Profiller: kullanıcı kendi profilini görür; rolünü DEĞİŞTİREMEZ.
-- -----------------------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
-- Sadece ad/telefon güncellenebilir; role sütunu kolon yetkisiyle kilitli.
grant update (full_name, phone) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Herkese açık referans verileri: okuma serbest, yazma sadece admin
-- -----------------------------------------------------------------------------
create policy "site_settings_public_read" on public.site_settings for select using (true);
create policy "site_settings_admin_update" on public.site_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "cities_public_read" on public.cities for select using (true);
create policy "cities_admin_write" on public.cities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "districts_public_read" on public.districts for select using (true);
create policy "districts_admin_write" on public.districts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "neighborhoods_public_read" on public.neighborhoods for select using (true);
create policy "neighborhoods_admin_write" on public.neighborhoods for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "property_types_public_read" on public.property_types for select using (true);
create policy "property_types_admin_write" on public.property_types for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "features_public_read" on public.features for select using (true);
create policy "features_admin_write" on public.features for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "redirects_public_read" on public.redirects for select using (true);
create policy "redirects_admin_write" on public.redirects for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Ziyaretçinin referans tablolara yazma yetkisi hiç olmasın (RLS'e ek savunma)
revoke insert, update, delete, truncate on
  public.site_settings, public.cities, public.districts, public.neighborhoods,
  public.property_types, public.features, public.redirects
from anon;

-- -----------------------------------------------------------------------------
-- İlanlar: ziyaretçi sadece 'active' ilanları görür
-- -----------------------------------------------------------------------------
create policy "properties_public_read_active" on public.properties
  for select using (status = 'active' or (select public.is_admin()));

create policy "properties_admin_insert" on public.properties for insert to authenticated
  with check ((select public.is_admin()));
create policy "properties_admin_update" on public.properties for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "properties_admin_delete" on public.properties for delete to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.properties from anon;

create policy "property_features_public_read" on public.property_features for select using (
  exists (select 1 from public.properties p where p.id = property_id and (p.status = 'active' or (select public.is_admin())))
);
create policy "property_features_admin_write" on public.property_features for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, update, delete, truncate on public.property_features from anon;

create policy "property_images_public_read" on public.property_images for select using (
  exists (select 1 from public.properties p where p.id = property_id and (p.status = 'active' or (select public.is_admin())))
);
create policy "property_images_admin_write" on public.property_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, update, delete, truncate on public.property_images from anon;

-- Açık adres ve kesin koordinat: SADECE admin
create policy "property_locations_admin_all" on public.property_locations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.property_locations from anon;

-- İstatistikler: sadece admin okur; yazma yalnızca track_property_event ile
create policy "property_events_admin_read" on public.property_events for select to authenticated
  using ((select public.is_admin()));
create policy "property_stats_admin_read" on public.property_stats for select to authenticated
  using ((select public.is_admin()));
revoke all on public.property_events, public.property_stats from anon;
revoke insert, update, delete, truncate on public.property_events, public.property_stats from authenticated;

-- İletişim talepleri: sadece admin okur/günceller/siler; ekleme yalnızca RPC ile
create policy "contact_requests_admin_read" on public.contact_requests for select to authenticated
  using ((select public.is_admin()));
create policy "contact_requests_admin_update" on public.contact_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "contact_requests_admin_delete" on public.contact_requests for delete to authenticated
  using ((select public.is_admin()));
revoke all on public.contact_requests from anon;
revoke insert, truncate on public.contact_requests from authenticated;

-- Favoriler: üye kendi kayıtlarını yönetir
create policy "favorites_own_select" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites_own_insert" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "favorites_own_delete" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.favorites from anon;

-- Sıra (sequence) kullanımı sadece ilan ekleyebilenler için
revoke all on sequence public.property_listing_no_seq from anon;

-- -----------------------------------------------------------------------------
-- RPC: İletişim talebi kaydı (sadece sunucu / service_role çağırabilir)
-- Hız sınırı: aynı IP özetinden 10 dakikada 3, 24 saatte 10 talep.
-- -----------------------------------------------------------------------------
create or replace function public.submit_contact_request(
  p_full_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_property_id uuid,
  p_source text,
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
  v_id uuid;
  v_property uuid;
begin
  if p_kvkk_consent is not true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  if p_ip_hash is not null then
    if (select count(*) from public.contact_requests
         where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3
       or (select count(*) from public.contact_requests
         where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 10 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  -- Sadece yayındaki ilanlara bağlanabilir
  select p.id into v_property from public.properties p
   where p.id = p_property_id and p.status = 'active';

  insert into public.contact_requests (
    property_id, full_name, phone, email, message, source, kvkk_consent, ip_hash, user_agent
  ) values (
    v_property, btrim(p_full_name), nullif(btrim(p_phone), ''), nullif(lower(btrim(p_email)), ''),
    btrim(p_message), coalesce(p_source, 'contact_page'), true, p_ip_hash, left(p_user_agent, 400)
  )
  returning id into v_id;

  if v_property is not null then
    insert into public.property_events (property_id, event_type, session_hash)
    values (v_property, 'contact_form', p_ip_hash);
    insert into public.property_stats (property_id, contact_form_count) values (v_property, 1)
    on conflict (property_id) do update set contact_form_count = public.property_stats.contact_form_count + 1;
  end if;

  return v_id;
end;
$$;

revoke all on function public.submit_contact_request(text, text, text, text, uuid, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, uuid, text, boolean, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- RPC: İlan etkileşim olayı (görüntülenme, arama, WhatsApp...)
-- Tekrarlı sayımı önler: aynı oturum için görüntülenme 30 dk, diğerleri 1 dk.
-- Oturum başına dakikada en fazla 60 olay.
-- -----------------------------------------------------------------------------
create or replace function public.track_property_event(
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
  if p_event = 'contact_form' then
    return false; -- yalnızca submit_contact_request üzerinden
  end if;
  if not exists (select 1 from public.properties where id = p_property_id and status = 'active') then
    return false;
  end if;
  if (select count(*) from public.property_events
       where session_hash = p_session_hash and created_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;

  v_window := case when p_event = 'view' then interval '30 minutes' else interval '1 minute' end;
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

revoke all on function public.track_property_event(uuid, public.property_event_type, text) from public, anon, authenticated;
grant execute on function public.track_property_event(uuid, public.property_event_type, text) to service_role;

-- -----------------------------------------------------------------------------
-- RPC: Yönetim paneli özet istatistikleri (sadece admin)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.properties),
    'active', (select count(*) from public.properties where status = 'active'),
    'passive', (select count(*) from public.properties where status in ('passive', 'sold', 'rented')),
    'draft', (select count(*) from public.properties where status = 'draft'),
    'featured', (select count(*) from public.properties where is_featured and status = 'active'),
    'demo', (select count(*) from public.properties where is_demo),
    'total_views', (select coalesce(sum(view_count), 0) from public.property_stats),
    'new_contacts', (select count(*) from public.contact_requests where status = 'new'),
    'period', jsonb_build_object(
      'views', (select count(*) from public.property_events where event_type = 'view' and created_at >= v_since),
      'phone_clicks', (select count(*) from public.property_events where event_type = 'phone_click' and created_at >= v_since),
      'whatsapp_clicks', (select count(*) from public.property_events where event_type = 'whatsapp_click' and created_at >= v_since),
      'contact_forms', (select count(*) from public.contact_requests where created_at >= v_since),
      'favorites', (select count(*) from public.property_events where event_type = 'favorite_add' and created_at >= v_since),
      'shares', (select count(*) from public.property_events where event_type = 'share' and created_at >= v_since)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'views', d.views, 'leads', d.leads) order by d.day)
      from (
        select g.day::date as day,
          (select count(*) from public.property_events e
            where e.event_type = 'view' and e.created_at >= g.day and e.created_at < g.day + interval '1 day') as views,
          (select count(*) from public.property_events e
            where e.event_type in ('phone_click', 'whatsapp_click', 'contact_form')
              and e.created_at >= g.day and e.created_at < g.day + interval '1 day') as leads
        from generate_series(date_trunc('day', v_since), date_trunc('day', now()), interval '1 day') as g(day)
      ) d
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_stats(integer) from public, anon;
grant execute on function public.admin_dashboard_stats(integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RPC: Bölge bazlı aktif ilan sayıları (Popüler Bölgeler, bölge sayfaları)
-- -----------------------------------------------------------------------------
create or replace function public.region_listing_counts()
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
   where p.status = 'active'
   group by c.slug, c.name, d.slug, d.name, n.slug, n.name
   order by count(*) desc;
$$;

grant execute on function public.region_listing_counts() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Fonksiyonların varsayılan PUBLIC yetkisini kapat (trigger fonksiyonları)
-- -----------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_public_location() from public, anon, authenticated;
revoke all on function public.properties_after_delete() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 20260922000003_storage.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Elvankent Gayrimenkul — Supabase Storage kovaları ve erişim politikaları
-- property-images: ilan fotoğrafları (herkese açık okuma, sadece admin yazma)
-- branding: logo vb. marka görselleri (herkese açık okuma, sadece admin yazma)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-images', 'property-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/avif']),
  ('branding', 'branding', true, 2097152, array['image/webp', 'image/png', 'image/svg+xml', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "site_images_admin_select" on storage.objects for select to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()))
  with check (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 20260922000004_reference_data.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Elvankent Gayrimenkul — Referans veriler
-- Konumlar, emlak tipleri, özellik kataloğu ve varsayılan site ayarları.
-- Koordinatlar bölge merkezini temsil eden YAKLAŞIK değerlerdir; ilan konumu
-- yönetim panelinde harita üzerinden ayrıca işaretlenir.
-- =============================================================================

insert into public.site_settings (id, business_name, tagline, about_text)
values (
  1,
  'Elvankent Gayrimenkul',
  'Elvankent ve Etimesgut''ta güvenilir emlak danışmanlığı',
  'Elvankent Gayrimenkul, Etimesgut ve çevresinde konut, iş yeri ve arsa alım-satım ile kiralama süreçlerinde danışmanlık hizmeti sunar. Bölgeyi yakından tanıyan bir ekip olarak, her ilanı yerinde inceler, doğru fiyatlandırma ve şeffaf iletişim ilkesiyle hareket ederiz.' || E'\n\n' ||
  'Amacımız; alıcı, satıcı, kiracı ve mülk sahibinin sürecin her adımında ne olduğunu bildiği, sürprizsiz ve güvenli bir gayrimenkul deneyimi sunmaktır. Tapu işlemlerinden kira sözleşmesine kadar gerekli adımlarda yanınızdayız.'
)
on conflict (id) do nothing;

-- İl
insert into public.cities (name, slug, latitude, longitude) values
  ('Ankara', 'ankara', 39.933400, 32.859700)
on conflict (slug) do nothing;

-- İlçeler
insert into public.districts (city_id, name, slug, latitude, longitude)
select c.id, v.name, v.slug, v.lat, v.lng
from public.cities c
cross join (values
  ('Etimesgut', 'etimesgut', 39.956700, 32.677800),
  ('Sincan', 'sincan', 39.969700, 32.583600),
  ('Yenimahalle', 'yenimahalle', 39.966700, 32.808300),
  ('Çankaya', 'cankaya', 39.900000, 32.860000),
  ('Keçiören', 'kecioren', 39.980000, 32.865000)
) as v(name, slug, lat, lng)
where c.slug = 'ankara'
on conflict (city_id, slug) do nothing;

-- Etimesgut mahalleleri
insert into public.neighborhoods (district_id, name, slug, latitude, longitude)
select d.id, v.name, v.slug, v.lat, v.lng
from public.districts d
join public.cities c on c.id = d.city_id and c.slug = 'ankara'
cross join (values
  ('Elvankent', 'elvankent', 39.948000, 32.624000),
  ('Eryaman', 'eryaman', 39.978000, 32.640000),
  ('Bağlıca', 'baglica', 39.900000, 32.629000),
  ('Topçu', 'topcu', 39.956000, 32.666000),
  ('Piyade', 'piyade', 39.951000, 32.680000),
  ('Süvari', 'suvari', 39.962000, 32.656000),
  ('Şehit Osman Avcı', 'sehit-osman-avci', 39.969000, 32.630000),
  ('Yeşilova', 'yesilova', 39.952000, 32.640000),
  ('Alsancak', 'alsancak', 39.960000, 32.690000),
  ('Atakent', 'atakent', 39.967000, 32.688000),
  ('Ahimesut', 'ahimesut', 39.953000, 32.663000),
  ('Tunahan', 'tunahan', 39.974000, 32.675000),
  ('Güzelkent', 'guzelkent', 39.961000, 32.642000),
  ('Yapracık', 'yapracik', 39.933000, 32.595000),
  ('Göksu', 'goksu', 39.979000, 32.610000)
) as v(name, slug, lat, lng)
where d.slug = 'etimesgut'
on conflict (district_id, slug) do nothing;

-- Emlak tipleri
insert into public.property_types (category, name, slug, sort_order) values
  ('konut', 'Daire', 'daire', 10),
  ('konut', 'Rezidans', 'rezidans', 20),
  ('konut', 'Müstakil Ev', 'mustakil-ev', 30),
  ('konut', 'Villa', 'villa', 40),
  ('konut', 'Dubleks', 'dubleks', 50),
  ('isyeri', 'Dükkan / Mağaza', 'dukkan', 110),
  ('isyeri', 'Ofis / Büro', 'ofis', 120),
  ('isyeri', 'Depo', 'depo', 130),
  ('isyeri', 'İmalathane / Atölye', 'atolye', 140),
  ('isyeri', 'Komple Bina', 'bina', 150),
  ('arsa', 'Konut İmarlı Arsa', 'konut-arsasi', 210),
  ('arsa', 'Ticari İmarlı Arsa', 'ticari-arsa', 220),
  ('arsa', 'Tarla', 'tarla', 230),
  ('arsa', 'Bağ & Bahçe', 'bag-bahce', 240),
  ('arsa', 'Sanayi Arsası', 'sanayi-arsasi', 250)
on conflict (slug) do nothing;

-- Özellik kataloğu
insert into public.features (key, label, feature_group, sort_order) values
  -- İç özellikler
  ('ankastre_mutfak', 'Ankastre mutfak', 'ic', 10),
  ('amerikan_mutfak', 'Amerikan mutfak', 'ic', 20),
  ('ebeveyn_banyosu', 'Ebeveyn banyosu', 'ic', 30),
  ('giyinme_odasi', 'Giyinme odası', 'ic', 40),
  ('vestiyer', 'Vestiyer', 'ic', 50),
  ('kiler', 'Kiler', 'ic', 60),
  ('celik_kapi', 'Çelik kapı', 'ic', 70),
  ('laminat_parke', 'Laminat / parke zemin', 'ic', 80),
  ('pvc_isicam', 'PVC doğrama & ısıcam', 'ic', 90),
  ('dusakabin', 'Duşakabin', 'ic', 100),
  ('beyaz_esya', 'Beyaz eşya', 'ic', 110),
  ('goruntulu_diafon', 'Görüntülü diafon', 'ic', 120),
  ('alarm', 'Hırsız alarmı', 'ic', 130),
  ('somine', 'Şömine', 'ic', 140),
  ('teras', 'Teras', 'ic', 150),
  ('fiber_internet', 'Fiber internet altyapısı', 'ic', 160),
  -- Dış özellikler
  ('guvenlik_24', '7/24 güvenlik', 'dis', 10),
  ('kamera', 'Kamera sistemi', 'dis', 20),
  ('kapici', 'Kapıcı', 'dis', 30),
  ('yuzme_havuzu', 'Yüzme havuzu', 'dis', 40),
  ('spor_alani', 'Spor alanı', 'dis', 50),
  ('oyun_parki', 'Çocuk oyun parkı', 'dis', 60),
  ('jenerator', 'Jeneratör', 'dis', 70),
  ('su_deposu', 'Su deposu', 'dis', 80),
  ('isi_yalitimi', 'Isı yalıtımı', 'dis', 90),
  ('ses_yalitimi', 'Ses yalıtımı', 'dis', 100),
  ('bahce', 'Bahçe', 'dis', 110),
  ('deprem_yonetmeligi', 'Deprem yönetmeliğine uygun', 'dis', 120),
  ('engelli_uygun', 'Engelli erişimine uygun', 'dis', 130),
  -- Muhit
  ('avm', 'Alışveriş merkezi', 'muhit', 10),
  ('market', 'Market', 'muhit', 20),
  ('okul', 'Okul', 'muhit', 30),
  ('hastane', 'Hastane / sağlık ocağı', 'muhit', 40),
  ('park', 'Park', 'muhit', 50),
  ('cami', 'Cami', 'muhit', 60),
  ('eczane', 'Eczane', 'muhit', 70),
  ('spor_salonu', 'Spor salonu', 'muhit', 80),
  -- Ulaşım
  ('banliyo', 'Banliyö / Başkentray', 'ulasim', 10),
  ('metro', 'Metro', 'ulasim', 20),
  ('yht', 'Hızlı tren (YHT) garı', 'ulasim', 30),
  ('otobus', 'Otobüs durağı', 'ulasim', 40),
  ('ana_cadde', 'Ana caddeye yakın', 'ulasim', 50),
  ('cevre_yolu', 'Çevre yoluna yakın', 'ulasim', 60)
on conflict (key) do nothing;

-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20260922000001', 'schema'),
  ('20260922000002', 'security'),
  ('20260922000003', 'storage'),
  ('20260922000004', 'reference_data')
on conflict (version) do nothing;
