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
