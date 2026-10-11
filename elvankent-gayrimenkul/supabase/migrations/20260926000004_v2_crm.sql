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
