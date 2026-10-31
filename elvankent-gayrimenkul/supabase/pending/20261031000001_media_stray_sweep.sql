-- =============================================================================
-- WP-A2 / D · Başıboş medya dosyaları listesi (KI-38)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_stray_sweep/ betikleriyle alınır. A (20261027000001) gerekir ('apply A first'); B ve C'den bağımsızdır.
--
-- media_stray_objects(p_limit) (yalnız service_role; günlük cron /api/cron/media-cleanup çağırır ve siler):
--   • media: kurum klasöründe kanonik adlı (…/<kimlik>/<sürüm>/w<genişlik>.webp) varyant; satırı yok ya da satırın GÜNCEL
--     tabanında değil; 1 saatten eski (süren işleme ve döndürme korunur). C'nin sınırladığı sayılmayan ek tabanlar ve
--     doğrudan silinen satırların kuyruğa girmemiş ek tabanları böylece temizlenir.
--   • media-originals: kurum klasöründe kanonik adlı (…/<kimlik>/original) orijinal; o kimlikte satır yok; 24 saatten eski
--     (stale_media temizliğiyle aynı süre).
--   • Kanonik olmayan adlar, demo ve diğer kovalar listelenmez (bilinmeyen dosya silinmez). org_id yoldaki kurumdur;
--     cron yalnız 'organizations/<org_id>/' ile başlayan ve '..' içermeyen yolları siler (queueItemIsSafe).
--   • En çok 1000 satır; sırasız (her çalışma bir sonrakinde devam eder).
--
-- Tekrar çalıştırılabilir. Veri değiştirmez (yalnız okur).
-- GERİ DÖNÜŞ:
--   drop function if exists public.media_stray_objects(integer);
-- =============================================================================

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
