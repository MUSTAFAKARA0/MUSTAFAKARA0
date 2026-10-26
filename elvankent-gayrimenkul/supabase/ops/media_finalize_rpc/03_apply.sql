-- =============================================================================
-- Medya sonlandırma RPC'si — 3/5 UYGULAMA: supabase/pending/20261027000001_media_finalize_rpc.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): 01 çıktısında DUR yok · 02 çıktısı saklandı · tam yedek alındı ve doğrulandı ·
-- bu adım için yazılı O-5 onayı var. ESKİ KODLA ZARARSIZDIR (yalnız yeni nesne ekler). SIRA: A → yeni kod → kapı → B.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 3 sn, statement_timeout 30 sn. DROP/CREATE TRIGGER media_assets üzerinde güçlü tablo kilidi
--     ister: uzun bir işlem varsa 3 sn sonra 55P03 ile vazgeçer, site etkilenmez; 01'i yeniden çalıştırıp tekrar deneyin.
--   • Koruma: şema sürümü en az 20261018000001; gerekli nesneler var; fonksiyon sahibinin storage.objects üzerinde SELECT
--     hakkı ve RLS atlaması var. Bu betik karay_schema_version() değerini DEĞİŞTİRMEZ.
--   • Gövde supabase/pending/20261027000001_media_finalize_rpc.sql ile birebir aynıdır (birim testi LR-14 denetler).
--   • Tekrar çalıştırılabilir. Veri değiştirmez. Sondaki kontrol aynı işlemde çalışır: beklenen sonuç yoksa geri alınır.
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
  if to_regclass('public.media_assets') is null or to_regprocedure('public.org_plan(uuid)') is null
     or to_regprocedure('public.has_org_permission(uuid,text)') is null or to_regprocedure('public.is_super_admin()') is null
     or to_regclass('storage.objects') is null then
    raise exception 'DUR: public.media_assets ya da org_plan / has_org_permission / is_super_admin / storage.objects yok';
  end if;
  if not has_table_privilege(current_user, 'storage.objects', 'select')
     or not (select r.rolbypassrls from pg_roles r where r.rolname = current_user) then
    raise exception 'DUR: % rolünün storage.objects üzerinde SELECT hakkı ve RLS atlaması yok (her sonlandırma media_not_uploaded olur)', current_user;
  end if;
end
$koruma$;

-- ---- 20261027000001_media_finalize_rpc (gövde, değiştirilmeden) ----------------
create or replace function public.media_finalize(
  p_media uuid,
  p_expected_base text,
  p_public_base text,
  p_variant_widths smallint[],
  p_width integer,
  p_height integer,
  p_blur text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.media_assets%rowtype;
  v_canon text;
  v_rev text;
  v_lo text;
  v_hi text;
  v_found integer;
  v_orig bigint;
  v_var bigint;
  v_present integer;
  v_limit integer;
  v_others bigint;
  v_old bigint;
  v_new bigint;
  v_prev_timeout text;
begin
  -- 1. Kilitsiz okuma: satır yok ya da yetki yok → tek tip forbidden (kilit alınmaz)
  select * into r from public.media_assets where id = p_media;
  if not found
     or not (public.has_org_permission(r.organization_id, 'media.manage') or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Yalnız bağımsız değişkenlere bağlı girdi denetimi (kilitten önce)
  if p_public_base is null or char_length(p_public_base) > 400
     or p_variant_widths is null
     or coalesce(cardinality(p_variant_widths), 0) not between 1 and 6
     or exists (select 1 from unnest(p_variant_widths) w where w < 1 or w > 2880)
     or (select count(distinct w) from unnest(p_variant_widths) w) <> cardinality(p_variant_widths)
     or p_width is null or p_height is null or p_width <= 0 or p_height <= 0
     or char_length(p_blur) > 2000 then
    raise exception 'media_invalid_input' using errcode = 'P0001';
  end if;

  -- 2. Tek anahtar: kota kilidi; satır kilit altında FOR UPDATE ile yeniden okunur
  v_prev_timeout := current_setting('lock_timeout');
  perform set_config('lock_timeout', '5s', true);
  begin
    perform pg_advisory_xact_lock(hashtextextended('karay.quota:media_assets:' || r.organization_id::text, 0));
  exception when lock_not_available then
    raise exception 'media_busy' using errcode = '55P03', hint = 'Başka bir medya işlemi sürüyor; kısa süre sonra yeniden deneyin.';
  end;
  perform set_config('lock_timeout', v_prev_timeout, true);
  select * into r from public.media_assets where id = p_media for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 3. Yol: satırın kendi sütunlarından üretilen değerle eşitlik
  v_canon := case r.kind
    when 'property_photo' then
      case when r.property_id is null then null
           else 'organizations/' || r.organization_id::text || '/properties/' || r.property_id::text || '/images/' || r.id::text end
    when 'post_cover' then 'organizations/' || r.organization_id::text || '/content/' || r.id::text
    else null
  end;
  if v_canon is null or r.original_path is distinct from v_canon || '/original' then
    raise exception 'media_invalid_path' using errcode = 'P0001';
  end if;
  if not starts_with(p_public_base, v_canon || '/') then
    raise exception 'media_invalid_path' using errcode = 'P0001';
  end if;
  v_rev := substr(p_public_base, char_length(v_canon) + 2);
  if v_rev !~ '^[A-Za-z0-9_]{8}(-r(90|180|270))?$' then
    raise exception 'media_invalid_path' using errcode = 'P0001';
  end if;

  if r.public_base is distinct from p_expected_base then
    raise exception 'media_conflict' using errcode = 'P0001';
  end if;
  if p_public_base = r.public_base then
    raise exception 'media_invalid_input' using errcode = 'P0001';
  end if;

  -- 4. Gerçek boyut (storage.objects, (bucket_id, name COLLATE "C") indeksi)
  select count(*), coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
    into v_found, v_orig
    from storage.objects o
   where o.bucket_id = 'media-originals' and o.name = r.original_path;
  if v_found = 0 then
    raise exception 'media_not_uploaded' using errcode = 'P0001';
  end if;

  v_lo := p_public_base || '/';
  v_hi := p_public_base || '0';
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)
    into v_var
    from storage.objects o
   where o.bucket_id = 'media'
     and o.name collate "C" >= v_lo collate "C"
     and o.name collate "C" < v_hi collate "C";
  select count(*) into v_present
    from storage.objects o
   where o.bucket_id = 'media'
     and o.name = any (array(select p_public_base || '/w' || w::text || '.webp' from unnest(p_variant_widths) w));
  if v_present <> cardinality(p_variant_widths) then
    raise exception 'media_variants_missing' using errcode = 'P0001';
  end if;

  -- 5. Kota (satır hariç, gerçek değer)
  select max_storage_mb into v_limit from public.org_plan(r.organization_id);
  if v_limit is not null then
    select coalesce(sum(coalesce(m.byte_size, 0) + m.variants_byte_size), 0) into v_others
      from public.media_assets m where m.organization_id = r.organization_id and m.id <> r.id;
    v_old := coalesce(r.byte_size, 0) + r.variants_byte_size;
    v_new := v_orig + v_var;
    if r.status <> 'ready' then
      if v_others + v_new > v_limit::bigint * 1024 * 1024 then
        raise exception 'plan_limit_storage' using errcode = 'P0001', hint = 'Depolama alanı kotanız doldu.';
      end if;
    elsif v_new > v_old and v_others + v_new > v_limit::bigint * 1024 * 1024 then
      raise exception 'plan_limit_storage' using errcode = 'P0001', hint = 'Depolama alanı kotanız doldu.';
    end if;
  end if;

  -- 6. Tek UPDATE; önceki varyantlar kuyruğa (demo tabanları '/' ile başlar, atlanır)
  update public.media_assets
     set status = 'ready',
         byte_size = v_orig,
         variants_byte_size = v_var,
         public_base = p_public_base,
         variant_widths = p_variant_widths,
         width = p_width,
         height = p_height,
         blur_data_url = p_blur,
         processed_at = now(),
         error = null
   where id = r.id;

  if r.public_base is not null and left(r.public_base, 1) <> '/'
     and starts_with(r.public_base, 'organizations/' || r.organization_id::text || '/') and position('..' in r.public_base) = 0 then
    insert into public.media_file_queue (org_id, bucket, path)
    select r.organization_id, 'media', r.public_base || '/w' || w::text || '.webp'
      from unnest(r.variant_widths) w;
  end if;

  return jsonb_build_object(
    'previous_base', r.public_base,
    'previous_widths', to_jsonb(coalesce(r.variant_widths, '{}'::smallint[])),
    'byte_size', v_orig,
    'variants_byte_size', v_var
  );
end;
$$;

create or replace function public.media_mark_failed(p_media uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.media_assets where id = p_media;
  if not found
     or not (public.has_org_permission(v_org, 'media.manage') or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.media_assets
     set status = 'failed', error = left(p_error, 300)
   where id = p_media and status <> 'ready';
  return found;
end;
$$;

-- Dosya silme kuyruğu: yabancı anahtar YOK (organizasyon silinirken de satır eklenebilsin)
create table if not exists public.media_file_queue (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.media_file_queue enable row level security;
revoke all on table public.media_file_queue from public, anon, authenticated, service_role;
revoke all on sequence public.media_file_queue_id_seq from public, anon, authenticated, service_role;

create or replace function public.media_assets_enqueue_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_file_queue (org_id, bucket, path)
  select o.organization_id, 'media-originals', o.original_path
    from old_rows o
   where o.original_path is not null
     and starts_with(o.original_path, 'organizations/' || o.organization_id::text || '/') and position('..' in o.original_path) = 0
  union all
  select o.organization_id, 'media', o.public_base || '/w' || w::text || '.webp'
    from old_rows o
   cross join lateral unnest(o.variant_widths) w
   where o.public_base is not null and left(o.public_base, 1) <> '/'
     and starts_with(o.public_base, 'organizations/' || o.organization_id::text || '/') and position('..' in o.public_base) = 0;
  return null;
end;
$$;
revoke all on function public.media_assets_enqueue_files() from public, anon, authenticated, service_role;

drop trigger if exists media_assets_enqueue_files on public.media_assets;
create trigger media_assets_enqueue_files
  after delete on public.media_assets
  referencing old table as old_rows
  for each statement execute function public.media_assets_enqueue_files();

-- Dönüş türü değişti (org_id eklendi): create or replace türü değiştiremez, bu yüzden önce silinir (yalnız service_role çağırır)
drop function if exists public.media_queue_claim(integer);
create function public.media_queue_claim(p_limit integer)
returns table (id bigint, org_id uuid, bucket text, path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with c as (
    select q.id
      from public.media_file_queue q
     where q.claimed_at is null or q.claimed_at < now() - interval '5 minutes'
     order by q.id
     limit greatest(least(coalesce(p_limit, 0), 1000), 0)
       for update skip locked
  )
  update public.media_file_queue u
     set claimed_at = now()
    from c
   where u.id = c.id
  returning u.id, u.org_id, u.bucket, u.path;
end;
$$;

create or replace function public.media_queue_done(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.media_file_queue where id = any (p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Salt rapor: kurumun depolama durumu (satırsız yüklemeler, branding dahil)
create or replace function public.media_storage_report(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lo text := 'organizations/' || p_org::text || '/';
  v_hi text := 'organizations/' || p_org::text || '0';
  v_result jsonb;
begin
  if not ((select auth.role()) = 'service_role' or (select public.is_super_admin())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'org_id', p_org,
    'db_rows', (select count(*) from public.media_assets m where m.organization_id = p_org),
    'db_bytes', (select coalesce(sum(coalesce(m.byte_size, 0) + m.variants_byte_size), 0) from public.media_assets m where m.organization_id = p_org),
    'storage_bytes', (
      select coalesce(jsonb_object_agg(b.bucket_id, b.bytes), '{}'::jsonb) from (
        select o.bucket_id, sum(coalesce((o.metadata ->> 'size')::bigint, 0)) as bytes
          from storage.objects o
         where o.bucket_id in ('media', 'media-originals', 'branding')
           and o.name collate "C" >= v_lo collate "C" and o.name collate "C" < v_hi collate "C"
         group by o.bucket_id
      ) b),
    'orphan_originals', (
      select count(*) from storage.objects o
       where o.bucket_id = 'media-originals'
         and o.name collate "C" >= v_lo collate "C" and o.name collate "C" < v_hi collate "C"
         and not exists (select 1 from public.media_assets m where m.organization_id = p_org and m.original_path = o.name)),
    'orphan_variants', (
      select count(*) from storage.objects o
       where o.bucket_id = 'media'
         and o.name collate "C" >= v_lo collate "C" and o.name collate "C" < v_hi collate "C"
         and not exists (select 1 from public.media_assets m
                          where m.organization_id = p_org and m.public_base is not null and starts_with(o.name, m.public_base || '/')))
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.media_finalize(uuid, text, text, smallint[], integer, integer, text) from public, anon, service_role;
grant execute on function public.media_finalize(uuid, text, text, smallint[], integer, integer, text) to authenticated;
revoke all on function public.media_mark_failed(uuid, text) from public, anon, service_role;
grant execute on function public.media_mark_failed(uuid, text) to authenticated;
revoke all on function public.media_queue_claim(integer) from public, anon, authenticated;
grant execute on function public.media_queue_claim(integer) to service_role;
revoke all on function public.media_queue_done(bigint[]) from public, anon, authenticated;
grant execute on function public.media_queue_done(bigint[]) to service_role;
revoke all on function public.media_storage_report(uuid) from public, anon;
grant execute on function public.media_storage_report(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare adet int; yetkili int; surum text; tablo int;
begin
  select count(*) into adet from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.proconfig @> array['search_path=""']
     and p.proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files');
  if adet <> 6 then
    raise exception 'KONTROL: security definer + boş search_path fonksiyon sayısı % (beklenen 6); işlem geri alınıyor', adet;
  end if;
  select count(*) into adet from pg_trigger
   where tgname = 'media_assets_enqueue_files' and not tgisinternal and tgrelid = to_regclass('public.media_assets');
  if adet <> 1 then
    raise exception 'KONTROL: media_assets_enqueue_files sayısı % (beklenen 1); işlem geri alınıyor', adet;
  end if;
  select count(*) into tablo from pg_class c where c.oid = to_regclass('public.media_file_queue') and c.relrowsecurity;
  if tablo <> 1 then
    raise exception 'KONTROL: media_file_queue yok ya da RLS kapalı; işlem geri alınıyor';
  end if;
  select count(*) into yetkili
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    left join pg_roles r on r.oid = a.grantee
   where c.oid = to_regclass('public.media_file_queue') and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'));
  if yetkili <> 0 then
    raise exception 'KONTROL: media_file_queue anon/authenticated/service_role/PUBLIC için yetkili; işlem geri alınıyor';
  end if;
  select count(*) into yetkili
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
   where p.pronamespace = 'public'::regnamespace and a.privilege_type = 'EXECUTE'
     and ((p.proname in ('media_finalize', 'media_mark_failed') and (a.grantee = 0 or r.rolname in ('anon', 'service_role')))
       or (p.proname in ('media_queue_claim', 'media_queue_done') and (a.grantee = 0 or r.rolname in ('anon', 'authenticated')))
       or (p.proname = 'media_storage_report' and (a.grantee = 0 or r.rolname = 'anon'))
       or (p.proname = 'media_assets_enqueue_files' and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'))));
  if yetkili <> 0 then
    raise exception 'KONTROL: fonksiyon yürütme yetkileri beklenen değil (% ihlal); işlem geri alınıyor', yetkili;
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'A fonksiyon sayısı' as alan,
       (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace
          and proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files')) as deger;
