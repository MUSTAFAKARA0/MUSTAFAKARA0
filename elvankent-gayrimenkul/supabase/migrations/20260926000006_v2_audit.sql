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
