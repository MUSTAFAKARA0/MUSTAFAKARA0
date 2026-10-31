-- =============================================================================
-- WP-A2 / C · Depolama yuvaları: satırsız yükleme ve sonlandırma sonrası üzerine yazma engeli (KI-37)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_storage_slots/ betikleriyle alınır. Tasarım: docs/drafts/wpa2/TASARIM.md (§4 d, §10 M1).
-- Sıra: A → yeni kod → B → C. B uygulanmadan C uygulanmaz (aşağıdaki koruma 'apply B first').
-- Geri alma: C, B'den ÖNCE geri alınır (C, B'nin kanonik yol kuralına dayanır).
--
-- Yerel ölçüm (storage-api v1.82.1, tests/security/media-storage-slots.test.mjs başlığı):
--   • Storage, oturum isteğinde ve İMZALAMA (createSignedUploadUrl) anında RLS'yi geri alınan bir deneme yazımıyla
--     denetler; imzalı adresle yapılan ASIL yükleme RLS'yi atlar (veritabanına service_role olarak yazar, token 2 saat).
--   • Bu yüzden iki katman: (1) politika imzalama/istek anında yuva ister, (2) BEFORE INSERT OR UPDATE tetikleyicisi
--     imzalı adresle sonradan yapılan yazımı da reddeder.
--
-- Etki:
--   • media-originals INSERT/UPDATE (authenticated): ad, çağıranın kurumundaki BEKLEYEN (pending) satırın original_path
--     değerine birebir eşit olmalı (media_original_slot_open). Satırsız, kanonik olmayan, failed ya da ready satırın
--     orijinali imzalanamaz ve yazılamaz.
--   • media INSERT/UPDATE (authenticated): ad <satır klasörü>/<sürüm>/w<genişlik>.webp ve satır çağıranın kurumunda
--     olmalı; satırın GÜNCEL (sonlanmış) tabanına yazılamaz (media_variant_slot_open). Yeni tabana yazım (işleme,
--     döndürme) açık.
--   • Tetikleyici media_storage_slot_guard (storage.objects, yalnız 'organizations/' altı, iki kova):
--       INSERT, sahibi dolu (kullanıcının oturumu ya da imzalı adresi): yukarıdaki yuva kuralları (kurum denetimi
--         olmadan; sahibi boş = service_role/sistem, ör. geri yükleme --apply, serbest).
--       UPDATE (üzerine yazma, taşıma), herkes: orijinal için bekleyen satır; varyant için güncel taban dışı yuva.
--       Bakım penceresi (public.media_overwrite_window, en çok 24 saat, yalnız SQL Editor/postgres açar) UPDATE'i ve
--       sahibi dolu INSERT'i serbest bırakır: tam geri yükleme sonrası `restore:storage --apply --overwrite` için.
--   • SELECT/DELETE politikaları değişmez. Veri değiştirmez; mevcut nesneler denetlenmez.
--
-- Hata: 'media_slot_closed' (42501). Tekrar çalıştırılabilir.
-- GERİ DÖNÜŞ: (05_rollback.sql; C HER ZAMAN B'den önce geri alınır; dört politika 20260926000008_v2_storage.sql'deki
-- hâliyle, aşağıdaki drop'lardan sonra 05'te yeniden kurulur)
--   drop trigger if exists media_storage_slot_guard on storage.objects;
--   drop policy if exists "media_originals_insert" on storage.objects;
--   drop policy if exists "media_originals_update" on storage.objects;
--   drop policy if exists "media_insert" on storage.objects;
--   drop policy if exists "media_update" on storage.objects;
--   drop function if exists public.media_storage_slot_guard();
--   drop function if exists public.media_original_slot_open(text);
--   drop function if exists public.media_variant_slot_open(text);
--   drop function if exists public.media_original_slot_org(text);
--   drop function if exists public.media_variant_slot_org(text);
--   drop table if exists public.media_overwrite_window;
-- =============================================================================

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
