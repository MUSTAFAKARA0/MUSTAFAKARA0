-- =============================================================================
-- Medya depolama yuvaları — 3/5 UYGULAMA: supabase/pending/20261027000003_media_storage_slots.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): A (media_finalize_rpc) ve B (media_privileges) uygulanmış, 04'leri TAMAM · yeni kod production'da ·
-- 01 çıktısında DUR yok · 02 çıktısı saklandı · tam yedek alındı · bu adım için yazılı O-5 onayı var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem. Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz. lock_timeout 3 sn, statement_timeout 30 sn
--     (CREATE TRIGGER / CREATE POLICY storage.objects üzerinde kilit ister; 55P03'te hiçbir şey değişmemiştir, sakin anda tekrar).
--     Uygulama anında süren yüklemeler (kısa) kilidi bekletebilir; trafiğin az olduğu bir anda çalıştırın.
--   • Koruma: şema sürümü en az 20261018000001; A ve B kurulu ('apply B first'); çalıştıran rolün storage.objects üzerinde
--     TRIGGER hakkı var.
--   • Gövde supabase/pending/20261027000003_media_storage_slots.sql ile birebir aynıdır (birim testi LR-14 denetler).
--     Tekrar çalıştırılabilir. Veri değiştirmez; mevcut nesneler denetlenmez.
--   • Geri dönüş: 05 (C HER ZAMAN B'den önce geri alınır).
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
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir; önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
  if to_regclass('public.media_assets') is null or to_regclass('storage.objects') is null
     or to_regprocedure('public.user_org_ids(text)') is null then
    raise exception 'DUR: public.media_assets, storage.objects ya da user_org_ids yok';
  end if;
  if to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null then
    raise exception 'DUR: apply A first — media_finalize yok (media_finalize_rpc/03_apply.sql)';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal
                    and tgrelid = to_regclass('public.media_assets')) then
    raise exception 'DUR: apply B first — media_assets_pending_shape yok (media_privileges/03_apply.sql)';
  end if;
  if not has_table_privilege(current_user, 'storage.objects', 'trigger') then
    raise exception 'DUR: % rolünün storage.objects üzerinde TRIGGER hakkı yok; tetikleyici kurulamaz (README: sağlayıcı kısıtı)', current_user;
  end if;
end
$koruma$;

-- ---- 20261027000003_media_storage_slots (gövde, değiştirilmeden) ----------------
do $guard$
begin
  if to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null
     or not exists (select 1 from pg_trigger
                     where tgname = 'media_assets_pending_shape' and not tgisinternal
                       and tgrelid = to_regclass('public.media_assets')) then
    raise exception 'apply B first';
  end if;
end
$guard$;

-- Bakım penceresi: tek satır; istemcilere ve service_role'e kapalı (yalnız veritabanı sahibi açar)
create table if not exists public.media_overwrite_window (
  id boolean primary key default true check (id),
  open_until timestamptz not null
);
alter table public.media_overwrite_window enable row level security;
revoke all on table public.media_overwrite_window from public, anon, authenticated, service_role;

-- İç yardımcılar: yalnız yol eşleşmesi (kurum denetimi yok); istemcilere kapalı.
-- Kimlik yoldan yalnız birincil anahtar araması için alınır; yetki eşitliği satırın kendi original_path değeriyle.
create or replace function public.media_original_slot_org(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
    from public.media_assets m
   where m.id = (substring(p_name from
           '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/original$'
         ))::uuid
     and m.original_path = p_name
     and m.status = 'pending'
$$;

create or replace function public.media_variant_slot_org(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select regexp_match(p_name,
      '^(organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))/([A-Za-z0-9_]{8}(?:-r(?:90|180|270))?)/w[0-9]{1,4}\.webp$'
    ) as g
  )
  select m.organization_id
    from p
    join public.media_assets m on m.id = (p.g[2])::uuid
   where p.g is not null
     and m.original_path = p.g[1] || '/original'
     and m.public_base is distinct from p.g[1] || '/' || p.g[3]
$$;

revoke all on function public.media_original_slot_org(text) from public, anon, authenticated, service_role;
revoke all on function public.media_variant_slot_org(text) from public, anon, authenticated, service_role;

-- Politika yardımcıları (authenticated): yuva + çağıranın media.manage yetkili kurumu
create or replace function public.media_original_slot_open(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.media_original_slot_org(p_name) in (select x.id from public.user_org_ids('media.manage') as x(id)), false)
$$;

create or replace function public.media_variant_slot_open(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.media_variant_slot_org(p_name) in (select x.id from public.user_org_ids('media.manage') as x(id)), false)
$$;

revoke all on function public.media_original_slot_open(text) from public, anon, service_role;
revoke all on function public.media_variant_slot_open(text) from public, anon, service_role;
grant execute on function public.media_original_slot_open(text) to authenticated;
grant execute on function public.media_variant_slot_open(text) to authenticated;

-- Politikalar: 20260926000008_v2_storage.sql'deki kurum klasörü denetimi korunur, yuva şartı eklenir
drop policy if exists "media_originals_insert" on storage.objects;
create policy "media_originals_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  );
drop policy if exists "media_originals_update" on storage.objects;
create policy "media_originals_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  )
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  );
drop policy if exists "media_insert" on storage.objects;
create policy "media_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  );
drop policy if exists "media_update" on storage.objects;
create policy "media_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  );

-- Tetikleyici: imzalı adresle (RLS'siz) yapılan yazımı da yakalar
create or replace function public.media_storage_slot_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window boolean;
begin
  if new.bucket_id not in ('media-originals', 'media')
     and (tg_op = 'INSERT' or old.bucket_id not in ('media-originals', 'media')) then
    return new;
  end if;
  v_window := exists (select 1 from public.media_overwrite_window w
                       where w.open_until > now() and w.open_until <= now() + interval '1 day');
  if v_window then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Sahibi boş: service_role / sistem yazımı (geri yükleme --apply, testler); yeni nesne serbest
    if new.owner_id is null or new.name not like 'organizations/%' then
      return new;
    end if;
    if (new.bucket_id = 'media-originals' and public.media_original_slot_org(new.name) is not null)
       or (new.bucket_id = 'media' and public.media_variant_slot_org(new.name) is not null) then
      return new;
    end if;
    raise exception 'media_slot_closed' using errcode = '42501';
  end if;

  -- UPDATE (üzerine yazma ya da taşıma): eski ve yeni ad, kurum öneki altındaysa yuva ister (herkes için)
  if old.bucket_id in ('media-originals', 'media') and old.name like 'organizations/%'
     and not ((old.bucket_id = 'media-originals' and public.media_original_slot_org(old.name) is not null)
              or (old.bucket_id = 'media' and public.media_variant_slot_org(old.name) is not null)) then
    raise exception 'media_slot_closed' using errcode = '42501';
  end if;
  if new.bucket_id in ('media-originals', 'media') and new.name like 'organizations/%'
     and not ((new.bucket_id = 'media-originals' and public.media_original_slot_org(new.name) is not null)
              or (new.bucket_id = 'media' and public.media_variant_slot_org(new.name) is not null)) then
    raise exception 'media_slot_closed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.media_storage_slot_guard() from public, anon, authenticated, service_role;

drop trigger if exists media_storage_slot_guard on storage.objects;
create trigger media_storage_slot_guard
  before insert or update on storage.objects
  for each row execute function public.media_storage_slot_guard();

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

-- Aynı işlemde kontrol: beklenmeyen durum varsa her şey geri alınır
do $kontrol$
declare surum text;
begin
  if (select count(*) from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) <> 1 then
    raise exception 'KONTROL: media_storage_slot_guard tetikleyicisi tam bir kez yok; işlem geri alınıyor';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('media_originals_insert', 'media_originals_update', 'media_insert', 'media_update')
        and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'media_(original|variant)_slot_open') <> 4 then
    raise exception 'KONTROL: dört yazma politikası yuva şartını içermiyor; işlem geri alınıyor';
  end if;
  if has_function_privilege('anon', 'public.media_original_slot_open(text)', 'execute')
     or has_function_privilege('authenticated', 'public.media_original_slot_org(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.media_original_slot_open(text)', 'execute') then
    raise exception 'KONTROL: yuva fonksiyonu yetkileri beklenen değil; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'media_storage_slot_guard tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal) as deger;
