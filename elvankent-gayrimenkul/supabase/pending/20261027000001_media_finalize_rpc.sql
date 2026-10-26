-- =============================================================================
-- WP-A2 / A · Medya sonlandırma RPC'si, dosya silme kuyruğu ve depolama raporu
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_finalize_rpc/ betikleriyle alınır. Tasarım: docs/drafts/wpa2/TASARIM.md (§1-§9, §8 geçerli).
-- ESKİ KODLA ZARARSIZDIR: yalnız yeni nesne ekler, mevcut yetki ve davranışa dokunmaz. Yayın sırası: A → kod → kapı → B.
--
-- Düzeltilenler (KI-36):
--   1. Döndürmede fotoğraf kaybı: media_finalize tek işlemde sonlandırır; hata satırı değiştirmez, ready satır asla
--      düşürülmez (media_mark_failed ready satırı atlar). Orijinal silinmez.
--   2. Doğrudan silme dosyaları bırakırdı: AFTER DELETE (deyim düzeyi) tetikleyici dosya yollarını kuyruğa alır;
--      boşaltma yalnız service_role fonksiyonlarıyla (media_queue_claim / media_queue_done).
--   3. Eşzamanlı iki döndürme: media_finalize satırı kota kilidi altında okur; p_expected_base uyuşmazsa media_conflict.
--
-- Arayüz (donmuş, TASARIM §9):
--   media_finalize(p_media uuid, p_expected_base text, p_public_base text, p_variant_widths smallint[], p_width int,
--                  p_height int, p_blur text) returns jsonb  (authenticated)
--     -> {previous_base, previous_widths, byte_size, variants_byte_size}. p_expected_base NULL = yeni yükleme;
--     p_blur NULL kabul edilir. Hatalar (message): forbidden (42501), media_conflict, media_not_uploaded,
--     media_variants_missing, media_invalid_path, media_invalid_input, media_busy (55P03, kota kilidi 5 sn içinde alınamadı), plan_limit_storage (P0001).
--     p_width / p_height NULL olamaz (media_invalid_input); p_blur NULL olabilir.
--   media_mark_failed(p_media uuid, p_error text) returns boolean  (authenticated; ready satırda false)
--   media_queue_claim(p_limit int) returns table (id bigint, org_id uuid, bucket text, path text)  (yalnız service_role)
--   media_queue_done(p_ids bigint[]) returns integer  (yalnız service_role)
--   media_storage_report(p_org uuid) returns jsonb  (service_role, süper admin; aksi forbidden)
--
-- Kuyruk kirası: media_queue_claim, claimed_at boş ya da 5 dakikadan eski satırları FOR UPDATE SKIP LOCKED ile seçer,
-- claimed_at = now() yazar ve döndürür; üst üste binen cron çalışmaları aynı satırı hemen yeniden almaz (ikinci çağrı
-- 0 satır). Başarıyla silinen kimlikler için media_queue_done çağrılır (satırı siler); silinemeyenler kira bitince
-- yeniden verilir. Boşaltma tekrarlanabilir. '/' ile başlayan demo tabanları ve legacy_path satırları kuyruğa alınmaz.
--
-- Doğrulama: yol, satırın KENDİ sütunlarından üretilen değerle eşitlik olarak denetlenir (ayrıştırma yok):
--   property_photo: organizations/<org>/properties/<property>/images/<id>/original
--   post_cover:     organizations/<org>/content/<id>/original        (kind general reddedilir)
-- Varyant boyutu: storage.objects (bucket_id, name COLLATE "C") indeksiyle aralık koşulu; p_public_base önce
-- <klasör>/<rev> düzenli ifadesinden geçer. Fonksiyon sahibinin storage.objects üzerinde SELECT hakkı ve RLS'yi
-- aşması (rolbypassrls) gerekir; yoksa her çağrı media_not_uploaded olur (03 ve B/01 denetler).
-- Kota (gerçek boyut, 1,35 payı yok): ready değilse others + new > limit red; ready (döndürme) ise yalnız new > old
-- ve others + new > limit red → plan_limit_storage; işlem geri alınır, satır değişmez.
--
-- Kuyruk güvenliği: dosya yolu ancak 'organizations/<kurum>/' ile başlıyorsa ve '..' içermiyorsa kuyruğa alınır (tetikleyici ve
-- media_finalize'ın önceki taban kuyruğu). B öncesi bir üye kendi satırının yol sütunlarını başka kurumun önekine çevirip satırı
-- silerek o kurumun dosyalarını sildiremez. B uygulanmadan önce media_privileges/01 kurum dışı yol sayısının 0 olmasını ister.
--
-- KALAN RİSK (bu turda C dosyası YOK) — C, kriter 7 için YAYIN KOŞULUDUR:
--   • Üyeler sonlandırmadan SONRA da kendi kurumlarının depolama nesnelerinin üzerine yazabilir (storage UPDATE/upsert
--     politikaları); kayıtlı boyut gerçek boyuttan sonradan sapabilir.
--   • Satırsız doğrudan yüklemeler (organizations/<org>/ altına depolama API'siyle, media_assets satırı olmadan) mümkün
--     kalır ve kotaya sayılmaz; media_storage_report ile yalnız TESPİT edilir, engellenmez.
--   • Önleme 20261027000003_media_storage_slots.sql (depolama "yuva" politikası, C) ile ayrı iş; imzalama davranışı yerelde
--     kanıtlanmadan çıkmaz. Ayrıca branding kovası plan kotası dışındadır (rapor gösterir).
--
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- GERİ DÖNÜŞ:
--   (önce B geri alınmış olmalı; kuyrukta satır varken tablo silinmez, 05 durur)
--   drop function if exists public.media_finalize(uuid, text, text, smallint[], integer, integer, text);
--   drop function if exists public.media_mark_failed(uuid, text);
--   drop function if exists public.media_queue_claim(integer);
--   drop function if exists public.media_queue_done(bigint[]);
--   drop function if exists public.media_storage_report(uuid);
--   drop trigger if exists media_assets_enqueue_files on public.media_assets;
--   drop function if exists public.media_assets_enqueue_files();
--   drop table if exists public.media_file_queue;
-- =============================================================================

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
