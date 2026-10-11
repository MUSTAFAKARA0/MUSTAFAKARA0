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
