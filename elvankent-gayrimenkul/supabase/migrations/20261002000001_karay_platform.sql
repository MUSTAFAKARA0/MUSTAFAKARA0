-- =============================================================================
-- KARAY platform sahibi: kurumsal ayarlar + KARAY talepleri (potansiyel müşteri)
--
-- 1) platform_settings (tek satır): KARAY'ın herkese açık şirket/ürün sayfasında
--    (/karay) gösterilen iletişim bilgileri, sosyal hesaplar, SEO ve talep bildirim
--    adresleri. Varsayılanlar BOŞTUR (uydurma iletişim bilgisi yok); süper admin
--    Platform › KARAY ayarları ekranından doldurur.
-- 2) platform_leads: KARAY sayfasındaki "Bilgi al / Demo talep et" formu. Kiracı
--    talepleri (public.leads, organization_id zorunlu) ile HİÇBİR ortak tablo veya
--    fonksiyon paylaşmaz: KARAY'a gelen emlakçı adayı bir ofisin CRM'ine, bir ofisin
--    müşterisi KARAY'a düşmez.
--
-- Güvenlik: iki tabloda da RLS açık. Okuma/güncelleme yalnızca süper admin; tabloya
-- doğrudan ekleme yok. Talep yalnızca submit_platform_lead() ile eklenir (doğrulama +
-- IP özetine göre hız sınırı + genel taşma sınırı). Herkese açık sayfa yalnızca
-- public_platform_profile() ile gösterilebilir alanları okur (bildirim adresleri hariç).
--
-- Tekrar çalıştırılabilir; mevcut veriyi değiştirmez. Geri dönüş: dosya sonunda.
-- =============================================================================

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'KARAY' check (char_length(company_name) between 2 and 80),
  tagline text check (char_length(tagline) <= 160),
  contact_email text check (contact_email is null or (char_length(contact_email) <= 160 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  contact_phone text check (char_length(contact_phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  address text check (char_length(address) <= 240),
  city text check (char_length(city) <= 80),
  website_url text check (website_url is null or (char_length(website_url) <= 300 and website_url ~ '^https://')),
  linkedin_url text check (linkedin_url is null or (char_length(linkedin_url) <= 300 and linkedin_url ~ '^https://')),
  instagram_url text check (instagram_url is null or (char_length(instagram_url) <= 300 and instagram_url ~ '^https://')),
  x_url text check (x_url is null or (char_length(x_url) <= 300 and x_url ~ '^https://')),
  youtube_url text check (youtube_url is null or (char_length(youtube_url) <= 300 and youtube_url ~ '^https://')),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  indexable boolean not null default true,
  lead_notify_emails text[] not null default '{}' check (cardinality(lead_notify_emails) <= 5),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_admin_read on public.platform_settings;
create policy platform_settings_admin_read on public.platform_settings
  for select to authenticated using ((select public.is_super_admin()));

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings
  for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);

-- Herkese açık KARAY sayfası için gösterilebilir alanlar (bildirim adresleri HARİÇ)
create or replace function public.public_platform_profile()
returns table (
  company_name text, tagline text, contact_email text, contact_phone text, whatsapp text,
  address text, city text, website_url text, linkedin_url text, instagram_url text, x_url text,
  youtube_url text, seo_title text, seo_description text, indexable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.company_name, s.tagline, s.contact_email, s.contact_phone, s.whatsapp, s.address, s.city,
         s.website_url, s.linkedin_url, s.instagram_url, s.x_url, s.youtube_url, s.seo_title,
         s.seo_description, s.indexable
    from public.platform_settings s
   where s.id;
$$;

-- -----------------------------------------------------------------------------
-- KARAY talepleri
-- -----------------------------------------------------------------------------
create table if not exists public.platform_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'info' check (kind in ('info', 'demo')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text check (email is null or (char_length(email) <= 160 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  phone text check (char_length(phone) <= 30),
  company text check (char_length(company) <= 160),
  city text check (char_length(city) <= 80),
  message text check (char_length(message) <= 3000),
  kvkk_consent boolean not null check (kvkk_consent),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  note text check (char_length(note) <= 2000),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  ip_hash text check (char_length(ip_hash) <= 64),
  user_agent text check (char_length(user_agent) <= 400),
  constraint platform_leads_contact_check check (email is not null or phone is not null)
);

create index if not exists platform_leads_created_idx on public.platform_leads (created_at desc);
create index if not exists platform_leads_status_idx on public.platform_leads (status, created_at desc);
create index if not exists platform_leads_ip_idx on public.platform_leads (ip_hash, created_at desc);
create index if not exists platform_leads_handled_by_idx on public.platform_leads (handled_by);

alter table public.platform_leads enable row level security;

drop policy if exists platform_leads_admin_read on public.platform_leads;
create policy platform_leads_admin_read on public.platform_leads
  for select to authenticated using ((select public.is_super_admin()));

drop policy if exists platform_leads_admin_update on public.platform_leads;
create policy platform_leads_admin_update on public.platform_leads
  for update to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

-- Talep ekleme: yalnızca bu fonksiyonla (doğrudan INSERT politikası yok)
create or replace function public.submit_platform_lead(
  p_kind text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_city text,
  p_message text,
  p_kvkk_consent boolean,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_kvkk_consent, false) is not true then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if nullif(btrim(p_email), '') is null and nullif(btrim(p_phone), '') is null then
    raise exception 'contact_required' using errcode = '22023';
  end if;
  -- Hız sınırı: aynı IP özeti 10 dakikada 3, 24 saatte 10 talep; genel taşma: saatte 300
  if p_ip_hash is not null and (
       (select count(*) from public.platform_leads where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3
    or (select count(*) from public.platform_leads where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 10) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.platform_leads where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.platform_leads (kind, full_name, email, phone, company, city, message, kvkk_consent, ip_hash, user_agent)
  values (case when p_kind = 'demo' then 'demo' else 'info' end,
          btrim(p_full_name), lower(nullif(btrim(p_email), '')), nullif(btrim(p_phone), ''),
          nullif(btrim(p_company), ''), nullif(btrim(p_city), ''), nullif(btrim(p_message), ''),
          true, left(p_ip_hash, 64), left(p_user_agent, 400))
  returning id into v_id;
  return v_id;
end;
$$;

-- Süper admin: talep durumu / notu (denetim kaydına platform düzeyinde yazılır)
create or replace function public.platform_update_lead(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.assert_super_admin();
  if p_status not in ('new', 'contacted', 'qualified', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select status into v_old from public.platform_leads where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.platform_leads
     set status = p_status, note = left(nullif(btrim(p_note), ''), 2000),
         handled_by = (select auth.uid()), handled_at = now()
   where id = p_id;
  perform public.write_audit(null, 'platform.lead_updated', 'platform_lead', p_id::text, p_status,
    jsonb_build_object('old_status', v_old, 'new_status', p_status));
end;
$$;

revoke all on function public.public_platform_profile() from public;
grant execute on function public.public_platform_profile() to anon, authenticated, service_role;
revoke all on function public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text) from public;
grant execute on function public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text) to anon, authenticated, service_role;
revoke all on function public.platform_update_lead(uuid, text, text) from public, anon;
grant execute on function public.platform_update_lead(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse; KARAY sayfası kod tarafında varsayılanlarla çalışmaya devam eder):
--   drop function if exists public.platform_update_lead(uuid, text, text),
--     public.submit_platform_lead(text, text, text, text, text, text, text, boolean, text, text),
--     public.public_platform_profile();
--   drop table if exists public.platform_leads;      -- DİKKAT: KARAY talepleri silinir (önce yedek alın)
--   drop table if exists public.platform_settings;
--   notify pgrst, 'reload schema';
-- =============================================================================
