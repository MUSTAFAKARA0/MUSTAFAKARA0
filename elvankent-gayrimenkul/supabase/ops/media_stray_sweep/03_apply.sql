-- =============================================================================
-- Başıboş medya dosyaları — 3/5 UYGULAMA: supabase/pending/20261031000001_media_stray_sweep.sql (tek işlem)
--
-- ÖN KOŞUL: A (media_finalize_rpc) uygulanmış · 01 çıktısında DUR yok · 02 çıktısı saklandı · yazılı O-5 onayı var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak Run · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış: tek işlem; lock_timeout 3 sn, statement_timeout 30 sn. Yalnız fonksiyon ekler (yalnız service_role çağırır);
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

create or replace function public.media_stray_objects(p_limit integer)
returns table (bucket text, path text, org_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with variants as (
    select o.bucket_id::text as bucket, o.name::text as path, (g[1])::uuid as org_id
      from storage.objects o
     cross join lateral regexp_match(o.name,
       '^organizations/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/[A-Za-z0-9_]{8}(?:-r(?:90|180|270))?/w[0-9]{1,4}\.webp$') as g
      left join public.media_assets m on m.id = (g[2])::uuid
     where o.bucket_id = 'media'
       and o.name like 'organizations/%'
       and g is not null
       and o.created_at < now() - interval '1 hour'
       and (m.id is null or m.public_base is distinct from regexp_replace(o.name, '/[^/]+$', ''))
  ),
  originals as (
    select o.bucket_id::text as bucket, o.name::text as path, (g[1])::uuid as org_id
      from storage.objects o
     cross join lateral regexp_match(o.name,
       '^organizations/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/original$') as g
     where o.bucket_id = 'media-originals'
       and o.name like 'organizations/%'
       and g is not null
       and o.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.media_assets m where m.id = (g[2])::uuid)
  )
  select * from (select * from variants union all select * from originals) s
   limit greatest(0, least(coalesce(p_limit, 0), 1000))
$$;

revoke all on function public.media_stray_objects(integer) from public, anon, authenticated;
grant execute on function public.media_stray_objects(integer) to service_role;

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if to_regprocedure('public.media_stray_objects(integer)') is null
     or has_function_privilege('anon', 'public.media_stray_objects(integer)', 'execute')
     or has_function_privilege('authenticated', 'public.media_stray_objects(integer)', 'execute')
     or not has_function_privilege('service_role', 'public.media_stray_objects(integer)', 'execute') then
    raise exception 'KONTROL: media_stray_objects yok ya da yetkileri beklenen değil; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'media_stray_objects var' as alan, (to_regprocedure('public.media_stray_objects(integer)') is not null)::text as deger;
