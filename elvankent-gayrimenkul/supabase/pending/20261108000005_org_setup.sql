-- =============================================================================
-- PILOT · Yeni ofisin ilk kurulumu ve tek seferlik tasarım seçimi (I)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin yazılı onayı ve
-- supabase/ops/org_setup/ betikleriyle alınır. Başka bekleyen dosyaya bağlı değildir (20261004000001 tasarım ailesi
-- yetkileri ve site_apply_design canlıda vardır).
--
-- Amaç: KARAYS konsolundan açılan YENİ ofisin sahibi ilk girişte odaklı bir kurulum akışına (/admin/kurulum) yönlenir:
-- hoş geldiniz → ofis bilgileri → tasarım (yalnız izinli aileler) → önizleme → tamamla. Onayda seçilen aile mevcut
-- site_apply_design ile sitenin TASARIM bölümlerine yazılır (taslak + yayın sürümü; sitenin ziyaretçiye açık/kapalı
-- durumu (site_status) DEĞİŞMEZ) ve kurulum tamamlanır. Tamamlanınca tasarım ailesi ve temel tema paketi ofis
-- kullanıcıları için KİLİTLENİR; yalnız KARAYS süper yöneticisi kilidi açabilir (yeniden seçim) — denetim kaydıyla.
--
--   1) organization_setup              : ofis başına kurulum durumu (sunucu tarafı; tarayıcı belleği değil)
--        state  setup_pending → theme_selection_pending → theme_selected → setup_completed
--               setup_completed → reopened_by_platform (KARAYS) → … → setup_completed
--        origin legacy (bu dosyadan ÖNCE var olan ofisler: tamamlanmış sayılır, kilitlenmez, akışa yönlenmez)
--               onboarding (konsoldan açılan yeni ofis ya da KARAYS'in yeniden açtığı kurulum — legacy ofis yeniden
--               açılıp tamamlanınca onboarding olur ve kilitlenir)
--   2) organization_setup_init         : organizations INSERT tetikleyicisi — yalnız süper yönetici oturumu
--                                        (platform_create_organization; Organizasyonlar › Yeni ve Yeni Site Oluştur
--                                        sihirbazı) yeni ofise 'setup_pending' satırı açar. service_role / demo verisi /
--                                        test kurulumları satır almaz (eski davranış).
--   3) org_setup_progress              : sahip (settings.manage) adımı ve aday aileyi kaydeder (devam edebilme)
--   4) org_setup_complete              : sahip seçimi onaylar; aile ZORUNLU (family_required); satır kilidi (FOR UPDATE)
--                                        ile tek kazanan; tamamlanmış kurulumda 'setup_completed' (tekrar / eski istek)
--   5) platform_reopen_org_setup       : yalnız süper yönetici; kurulumu yeniden açar (write_audit)
--   6) site_configs_design_lock        : site_configs BEFORE UPDATE — kilitli ofiste süper yönetici olmayan oturum
--                                        taslağa / yayına YENİ bir tema (theme) ya da tasarım ailesi (style.origin.family)
--                                        yazamaz (site_save_draft, site_apply_design, site_rollback hangisi olursa).
--                                        Mevcut taslak ↔ yayın değerleri arasında yayınlama / taslağı geri alma serbest.
--                                        Renkler, yazı tipi, bileşen stilleri, marka, logo, iletişim, sayfa metinleri,
--                                        header/menü/footer, ana sayfa, SEO, ilan ve CRM kilitlenmez.
--
-- Kilit süresi: tetikleyiciler (organizations ve site_configs üzerinde kısa SHARE ROW EXCLUSIVE kilit) işlemin SONUNDA
-- kurulur; var olan tetikleyici yalnız gerçekten varsa (pg_trigger) kaldırılır. Tablo oluşturma auth.users ve
-- organizations'a yabancı anahtar için kısa SHARE ROW EXCLUSIVE kilit alır.
--
-- Mevcut veri: organizasyonlar, site yapılandırmaları ve izinler DEĞİŞMEZ. Yalnız organization_setup'a, var olan her
-- ofis için 'setup_completed' + origin 'legacy' satırı eklenir (kimse akışa zorlanmaz). Tekrar çalıştırılabilir
-- (var olan satırlara dokunulmaz).
--
-- GERİ DÖNÜŞ: (05_rollback.sql — kurulum durumu kaybolur; site yapılandırmaları ve seçilmiş tasarımlar KALIR)
--   drop trigger if exists site_configs_design_lock on public.site_configs;
--   drop trigger if exists organization_setup_init on public.organizations;
--   drop function if exists public.platform_reopen_org_setup(uuid, text);
--   drop function if exists public.org_setup_complete(uuid, text, jsonb);
--   drop function if exists public.org_setup_progress(uuid, integer, text);
--   drop function if exists public.site_configs_design_lock();
--   drop function if exists public.organization_setup_init();
--   drop table if exists public.organization_setup;
-- =============================================================================

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
