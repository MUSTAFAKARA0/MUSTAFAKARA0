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
