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
