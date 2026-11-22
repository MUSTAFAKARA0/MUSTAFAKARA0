-- =============================================================================
-- İlk kurulum ve tasarım kilidi — 3/5 UYGULAMA: supabase/pending/20261108000005_org_setup.sql (tek işlem)
--
-- ÖN KOŞUL: 01'de DUR yok · 02 saklandı · tam yedek alındı · sahibin yazılı onayı.
-- Yeni tablo + üç fonksiyon + iki tetikleyici (gövdenin SONUNDA; organizations ve site_configs kilidi kısa kalır).
-- Var olan her ofis "kurulum tamamlandı (legacy)" işaretlenir; site yapılandırmaları, izinler ve organizasyonlar DEĞİŞMEZ.
-- DİKKAT: 05 ile geri alındıktan sonra 03 yeniden uygulanırsa, o sırada onboarding kökenli (yeni açılmış) ofisler de
-- legacy + tamamlandı işaretlenir (kurulum durumu 05'te silinmiştir); gerekirse KARAYS konsoldan "yeniden aç" der.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir', surum;
  end if;
  if to_regclass('public.site_configs') is null or to_regclass('public.organizations') is null
     or to_regprocedure('public.site_apply_design(uuid,text,jsonb)') is null
     or to_regprocedure('public.org_design_family_access(uuid)') is null
     or to_regprocedure('public.has_org_permission(uuid,text)') is null
     or to_regprocedure('public.assert_super_admin()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.member_org_ids()') is null
     or to_regprocedure('public.write_audit(uuid,text,text,text,text,jsonb)') is null then
    raise exception 'DUR: gerekli nesne yok (site_configs, organizations, site_apply_design, org_design_family_access, has_org_permission, assert_super_admin, is_super_admin, member_org_ids, write_audit)';
  end if;
end
$koruma$;

-- ---- 20261108000005_org_setup ----------------------------------------------------
create table if not exists public.organization_setup (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  state text not null default 'setup_pending'
    check (state in ('setup_pending', 'theme_selection_pending', 'theme_selected', 'setup_completed', 'reopened_by_platform')),
  origin text not null default 'onboarding' check (origin in ('legacy', 'onboarding')),
  step smallint not null default 0 check (step between 0 and 4),
  selected_family text check (selected_family is null or selected_family ~ '^[a-z0-9-]{1,40}$'),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists organization_setup_completed_by_idx on public.organization_setup (completed_by) where completed_by is not null;
create index if not exists organization_setup_reopened_by_idx on public.organization_setup (reopened_by) where reopened_by is not null;

-- RLS: okuma yalnız o ofisin üyelerine ve süper yöneticiye; doğrudan yazma YOK (yalnız aşağıdaki fonksiyonlar)
alter table public.organization_setup enable row level security;
drop policy if exists "organization_setup_read" on public.organization_setup;
create policy "organization_setup_read" on public.organization_setup for select to authenticated
  using (organization_id in (select public.member_org_ids()) or (select public.is_super_admin()));
revoke all on public.organization_setup from public, anon;
revoke insert, update, delete, truncate on public.organization_setup from authenticated;
grant select on public.organization_setup to authenticated;
grant all on public.organization_setup to service_role;

-- Var olan her ofis: kurulum tamamlanmış (legacy) — akışa yönlenmez, tasarımı kilitlenmez
insert into public.organization_setup (organization_id, state, origin, step, completed_at)
select o.id, 'setup_completed', 'legacy', 4, now() from public.organizations o
on conflict (organization_id) do nothing;

-- Yeni ofis: yalnız KARAYS süper yöneticisi oturumuyla açılan (platform_create_organization) ofis kurulum bekler
create or replace function public.organization_setup_init()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and public.is_super_admin() then
    insert into public.organization_setup (organization_id) values (new.id)
    on conflict (organization_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.organization_setup_init() from public, anon, authenticated, service_role;

-- Tasarım kilidi: kurulumu tamamlanmış (onboarding) ofiste süper yönetici olmayan oturum yeni tema / aile yazamaz.
-- Kapsam: yalnız theme ve style.origin.family (aile + temel tema paketi); diğer bölümler ve anahtarlar serbest.
create or replace function public.site_configs_design_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_draft_theme jsonb := old.draft -> 'theme';
  v_old_pub_theme jsonb := old.published -> 'theme';
  v_old_draft_family jsonb := old.draft -> 'style' -> 'origin' -> 'family';
  v_old_pub_family jsonb := old.published -> 'style' -> 'origin' -> 'family';
begin
  -- Ucuz karşılaştırma önce: tema ve aile değişmediyse (yazımların çoğu) başka denetim yok
  if (new.draft -> 'theme') is not distinct from v_old_draft_theme
     and (new.published -> 'theme') is not distinct from v_old_pub_theme
     and (new.draft -> 'style' -> 'origin' -> 'family') is not distinct from v_old_draft_family
     and (new.published -> 'style' -> 'origin' -> 'family') is not distinct from v_old_pub_family then
    return new;
  end if;
  if (select auth.uid()) is null or public.is_super_admin() then
    return new;
  end if;
  if not exists (select 1 from public.organization_setup s
                  where s.organization_id = new.organization_id and s.state = 'setup_completed' and s.origin = 'onboarding') then
    return new;
  end if;
  -- Yalnız var olan iki değer arasında geçiş (yayınla: taslak → yayın; taslağı geri al: yayın → taslak)
  if ((new.draft -> 'theme') is not distinct from v_old_draft_theme or (new.draft -> 'theme') is not distinct from v_old_pub_theme)
     and ((new.published -> 'theme') is not distinct from v_old_pub_theme or (new.published -> 'theme') is not distinct from v_old_draft_theme)
     and ((new.draft -> 'style' -> 'origin' -> 'family') is not distinct from v_old_draft_family
          or (new.draft -> 'style' -> 'origin' -> 'family') is not distinct from v_old_pub_family)
     and ((new.published -> 'style' -> 'origin' -> 'family') is not distinct from v_old_pub_family
          or (new.published -> 'style' -> 'origin' -> 'family') is not distinct from v_old_draft_family) then
    return new;
  end if;
  raise exception 'design_locked' using errcode = '42501',
    hint = 'Tasarım ailesi ve tema ilk kurulumda seçildi; değiştirmek için KARAYS ile iletişime geçin.';
end;
$$;
revoke all on function public.site_configs_design_lock() from public, anon, authenticated, service_role;

-- Sahip: kurulum adımını ve aday aileyi kaydeder (tarayıcı kapanınca kalınan yerden devam)
create or replace function public.org_setup_progress(p_org uuid, p_step integer, p_family text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_setup;
  v_family text;
  v_state text;
begin
  if (select auth.uid()) is null or p_org is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_step is null or p_step < 0 or p_step > 4 then
    raise exception 'invalid_setup_step' using errcode = '22023';
  end if;
  select * into v_row from public.organization_setup s where s.organization_id = p_org for update;
  if not found then
    raise exception 'setup_not_required' using errcode = 'P0002';
  end if;
  if v_row.state = 'setup_completed' then
    raise exception 'setup_completed' using errcode = '55000';
  end if;
  if p_family is not null and not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = p_family) then
    raise exception 'family_not_allowed' using errcode = '42501';
  end if;
  v_family := coalesce(p_family, v_row.selected_family);
  v_state := case when p_step >= 2 and v_family is not null then 'theme_selected'
                  when p_step >= 2 then 'theme_selection_pending'
                  when v_row.state = 'reopened_by_platform' then 'reopened_by_platform'
                  else 'setup_pending' end;
  update public.organization_setup
     set state = v_state, step = p_step, selected_family = v_family, updated_at = now()
   where organization_id = p_org;
  return v_state;
end;
$$;

-- Sahip: seçimi onaylar. Aile zorunludur (izinli aile yoksa kurulum tamamlanamaz, kilitlenmez; KARAYS aile açar).
-- Tasarım mevcut site_apply_design ile yazılır (aile izni, bölüm doğrulaması, sürüm, denetim orada); ardından kurulum
-- tamamlanır. Hepsi tek işlem: bir adım düşerse hiçbiri kalmaz.
create or replace function public.org_setup_complete(p_org uuid, p_family text, p_sections jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_setup;
  v_version integer;
begin
  if (select auth.uid()) is null or p_org is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.organization_setup s where s.organization_id = p_org for update;
  if not found then
    raise exception 'setup_not_required' using errcode = 'P0002';
  end if;
  if v_row.state = 'setup_completed' then
    raise exception 'setup_completed' using errcode = '55000';
  end if;
  if p_family is null then
    raise exception 'family_required' using errcode = '22023';
  end if;
  v_version := public.site_apply_design(p_org, p_family, p_sections);
  update public.organization_setup
     set state = 'setup_completed', step = 4, selected_family = p_family,
         completed_at = now(), completed_by = (select auth.uid()), updated_at = now()
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.setup_completed', 'site', p_org::text, p_family,
    jsonb_build_object('family', p_family, 'version', v_version, 'reopened', v_row.reopened_at is not null));
  return v_version;
end;
$$;

-- KARAYS süper yöneticisi: tek seferlik seçimi yeniden açar (sahip bir sonraki girişte tasarım adımına yönlenir).
-- Önceki tamamlanma bilgisi denetim kaydında kalır; satırda temizlenir.
create or replace function public.platform_reopen_org_setup(p_org uuid, p_reason text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_setup;
  v_family text;
begin
  perform public.assert_super_admin();
  if p_org is null or not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.organization_setup s where s.organization_id = p_org for update;
  if found and v_row.state <> 'setup_completed' then
    return v_row.state;
  end if;
  select c.published -> 'style' -> 'origin' ->> 'family' into v_family from public.site_configs c where c.organization_id = p_org;
  if v_family is null or v_family !~ '^[a-z0-9-]{1,40}$' then
    v_family := null;
  end if;
  insert into public.organization_setup (organization_id, state, origin, step, selected_family, reopened_at, reopened_by)
  values (p_org, 'reopened_by_platform', 'onboarding', 2, v_family, now(), (select auth.uid()))
  on conflict (organization_id) do update
     set state = 'reopened_by_platform', origin = 'onboarding', step = 2, selected_family = excluded.selected_family,
         completed_at = null, completed_by = null,
         reopened_at = excluded.reopened_at, reopened_by = excluded.reopened_by, updated_at = now();
  perform public.write_audit(p_org, 'site.setup_reopened', 'site', p_org::text, v_family,
    jsonb_build_object('previous_state', v_row.state, 'previous_origin', v_row.origin, 'previous_family', v_row.selected_family,
                       'previous_completed_at', v_row.completed_at, 'previous_completed_by', v_row.completed_by,
                       'reason', left(nullif(trim(p_reason), ''), 200)));
  return 'reopened_by_platform';
end;
$$;

revoke all on function public.org_setup_progress(uuid, integer, text) from public, anon, service_role;
revoke all on function public.org_setup_complete(uuid, text, jsonb) from public, anon, service_role;
revoke all on function public.platform_reopen_org_setup(uuid, text) from public, anon, service_role;
grant execute on function public.org_setup_progress(uuid, integer, text) to authenticated;
grant execute on function public.org_setup_complete(uuid, text, jsonb) to authenticated;
grant execute on function public.platform_reopen_org_setup(uuid, text) to authenticated;

-- Tetikleyiciler EN SONDA (organizations / site_configs kilidi işlemin sonuna kadar kısa kalır); var olan yalnız
-- gerçekten varsa kaldırılır (yoksa tabloya kilit alınmaz)
do $tetik$
begin
  if exists (select 1 from pg_trigger where tgname = 'organization_setup_init' and tgrelid = to_regclass('public.organizations') and not tgisinternal) then
    drop trigger organization_setup_init on public.organizations;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'site_configs_design_lock' and tgrelid = to_regclass('public.site_configs') and not tgisinternal) then
    drop trigger site_configs_design_lock on public.site_configs;
  end if;
end
$tetik$;
create trigger organization_setup_init
  after insert on public.organizations
  for each row execute function public.organization_setup_init();
create trigger site_configs_design_lock
  before update of draft, published on public.site_configs
  for each row execute function public.site_configs_design_lock();

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if to_regclass('public.organization_setup') is null
     or (select count(*) from pg_trigger where tgname in ('organization_setup_init', 'site_configs_design_lock') and not tgisinternal) <> 2
     or exists (select 1 from public.organizations o where not exists (select 1 from public.organization_setup s where s.organization_id = o.id))
     or has_function_privilege('anon', 'public.org_setup_complete(uuid,text,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.org_setup_complete(uuid,text,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.platform_reopen_org_setup(uuid,text)', 'execute')
     or has_table_privilege('authenticated', 'public.organization_setup', 'update') then
    raise exception 'KONTROL: organization_setup, tetikleyiciler, satırlar ya da yetkiler beklenen değil; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

select 'organization_setup' as alan, (select count(*)::text from public.organization_setup) as deger;
