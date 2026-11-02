-- =============================================================================
-- Başıboş medya dosyaları — 3/5 UYGULAMA: supabase/pending/20261031000001_media_stray_sweep.sql (tek işlem)
--
-- ÖN KOŞUL: A (media_finalize_rpc) uygulanmış · 01 çıktısında DUR yok · 02 çıktısı saklandı · yazılı O-5 onayı var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak Run · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış: tek işlem; lock_timeout 3 sn, statement_timeout 30 sn. İmleç tablosu media_stray_cursor (2 satır, RLS açık,
-- service_role yalnız okur) ve fonksiyon media_stray_objects(p_limit, p_scan) eklenir (yalnız service_role çağırır);
-- dosya SİLMEZ: silmeyi yeni kodun günlük cron'u (/api/cron/media-cleanup) yapar. Gövde pending dosyayla birebir (LR-14).
-- Geri dönüş: 05.
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
  if to_regclass('public.media_assets') is null or to_regclass('storage.objects') is null then
    raise exception 'DUR: public.media_assets ya da storage.objects yok';
  end if;
  if to_regprocedure('public.media_queue_claim(integer)') is null then
    raise exception 'DUR: apply A first — media_queue_claim yok (media_finalize_rpc/03_apply.sql)';
  end if;
end
$koruma$;

-- ---- 20261031000001_media_stray_sweep (gövde, değiştirilmeden) ----------------
do $guard$
begin
  if to_regprocedure('public.media_queue_claim(integer)') is null
     or to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null then
    raise exception 'apply A first';
  end if;
end
$guard$;

-- Kalıcı imleç: kova başına bir satır. Yalnız fonksiyon yazar; service_role yalnız okur (izleme)
create table if not exists public.media_stray_cursor (
  bucket text primary key check (bucket in ('media', 'media-originals')),
  last_name text collate "C" not null default '',
  passes bigint not null default 0,
  pass_started_at timestamptz not null default now(),
  last_pass_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.media_stray_cursor enable row level security;
revoke all on table public.media_stray_cursor from public, anon, authenticated, service_role;
grant select on table public.media_stray_cursor to service_role;
insert into public.media_stray_cursor (bucket) values ('media'), ('media-originals') on conflict (bucket) do nothing;

-- Önceki (sayfasız, tek parametreli) sürüm kaldırılır: PostgREST iki aşırı yükleme arasında seçim yapamaz
drop function if exists public.media_stray_objects(integer);

create or replace function public.media_stray_objects(p_limit integer, p_scan integer default 2000)
returns table (bucket text, path text, org_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit integer := greatest(0, least(coalesce(p_limit, 0), 1000));
  v_scan integer := greatest(1, least(coalesce(p_scan, 2000), 10000));
  v_bucket text;
  v_share integer;
  v_cursor text;
  v_last text;
  v_seen integer;
  v_found integer;
  v_hit boolean;
  v_g text[];
  r record;
begin
  foreach v_bucket in array array['media', 'media-originals'] loop
    -- Her kova kendi payını alır (varyant birikimi orijinalleri aç bırakmaz; K-23 DB #3)
    v_share := case when v_bucket = 'media' then v_limit / 2 + v_limit % 2 else v_limit / 2 end;
    continue when v_share = 0;

    insert into public.media_stray_cursor as c (bucket) values (v_bucket) on conflict on constraint media_stray_cursor_pkey do nothing;
    select c.last_name into v_cursor from public.media_stray_cursor c where c.bucket = v_bucket for update;
    v_last := v_cursor;
    v_seen := 0;
    v_found := 0;

    for r in
      select o.name, o.created_at
        from storage.objects o
       where o.bucket_id = v_bucket
         and o.name collate "C" > v_cursor
       order by o.name collate "C"
       limit v_scan
    loop
      v_seen := v_seen + 1;
      v_last := r.name;
      if v_bucket = 'media' then
        v_g := regexp_match(r.name,
          '^organizations/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[A-Za-z0-9_]{8}(?:-r(?:90|180|270))?/w[0-9]{1,4}\.webp$');
        v_hit := v_g is not null
          and r.created_at < now() - interval '1 hour'
          and not exists (select 1 from public.media_assets m
                           where m.id = (v_g[2])::uuid
                             and m.public_base = regexp_replace(r.name, '/[^/]+$', ''));
      else
        v_g := regexp_match(r.name,
          '^organizations/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/original$');
        v_hit := v_g is not null
          and r.created_at < now() - interval '24 hours'
          and not exists (select 1 from public.media_assets m where m.id = (v_g[2])::uuid);
      end if;
      if v_hit then
        bucket := v_bucket;
        path := r.name;
        org_id := (v_g[1])::uuid;
        return next;
        v_found := v_found + 1;
        -- Pay doldu: imleç bu nesnede durur, sonraki çağrı buradan devam eder
        exit when v_found >= v_share;
      end if;
    end loop;

    if v_seen < v_scan and v_found < v_share then
      -- Kovanın sonu: tur tamam, imleç başa döner
      update public.media_stray_cursor c
         set last_name = '', passes = c.passes + 1, last_pass_at = now(), pass_started_at = now(), updated_at = now()
       where c.bucket = v_bucket;
    else
      update public.media_stray_cursor c
         set last_name = v_last, updated_at = now()
       where c.bucket = v_bucket;
    end if;
  end loop;
end
$$;

revoke all on function public.media_stray_objects(integer, integer) from public, anon, authenticated;
grant execute on function public.media_stray_objects(integer, integer) to service_role;

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if to_regprocedure('public.media_stray_objects(integer,integer)') is null
     or to_regprocedure('public.media_stray_objects(integer)') is not null
     or has_function_privilege('anon', 'public.media_stray_objects(integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.media_stray_objects(integer,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.media_stray_objects(integer,integer)', 'execute') then
    raise exception 'KONTROL: media_stray_objects yok ya da yetkileri beklenen değil; işlem geri alınıyor';
  end if;
  if to_regclass('public.media_stray_cursor') is null
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public.media_stray_cursor'::regclass)
     or has_table_privilege('anon', 'public.media_stray_cursor', 'select')
     or has_table_privilege('authenticated', 'public.media_stray_cursor', 'select')
     or has_table_privilege('service_role', 'public.media_stray_cursor', 'update')
     or (select count(*) from public.media_stray_cursor) <> 2 then
    raise exception 'KONTROL: media_stray_cursor yok, RLS kapalı, yetkileri ya da satırları beklenen değil; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'media_stray_objects var' as alan, (to_regprocedure('public.media_stray_objects(integer,integer)') is not null)::text as deger
union all
select 'media_stray_cursor satır sayısı', (select count(*)::text from public.media_stray_cursor);
