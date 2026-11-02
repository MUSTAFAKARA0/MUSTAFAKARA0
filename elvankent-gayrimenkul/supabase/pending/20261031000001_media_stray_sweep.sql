-- =============================================================================
-- WP-A2 / D · Başıboş medya dosyaları listesi (KI-38) · sayfalı, kalıcı imleçli tarama (KI-39)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_stray_sweep/ betikleriyle alınır. A (20261027000001) gerekir ('apply A first'); B ve C'den bağımsızdır.
--
-- media_stray_objects(p_limit, p_scan) (yalnız service_role; günlük cron /api/cron/media-cleanup çağırır ve siler):
--   • media: kurum klasöründe kanonik adlı (…/<kimlik>/<sürüm>/w<genişlik>.webp) varyant; satırı yok ya da satırın GÜNCEL
--     tabanında değil; 1 saatten eski (süren işleme ve döndürme korunur). C'nin sınırladığı sayılmayan ek tabanlar ve
--     doğrudan silinen satırların kuyruğa girmemiş ek tabanları böylece temizlenir.
--   • media-originals: kurum klasöründe kanonik adlı (…/<kimlik>/original) orijinal; o kimlikte satır yok; 24 saatten eski
--     (stale_media temizliğiyle aynı süre).
--   • Kanonik olmayan adlar, demo ve diğer kovalar listelenmez (bilinmeyen dosya silinmez). org_id yoldaki kurumdur;
--     cron yalnız 'organizations/<org_id>/' ile başlayan ve '..' içermeyen yolları siler (queueItemIsSafe).
--   • Sayfalama (KI-39): her çağrı her kovada imleçten (media_stray_cursor.last_name) SONRAKİ en çok p_scan nesneye bakar
--     (varsayılan 2000, en az 1, en çok 10000; ad sırası, storage.objects (bucket_id, name COLLATE "C") indeksi). Çağrı
--     süresi kova boyutundan bağımsızdır. Kovanın sonuna gelinince imleç başa döner: passes + 1, last_pass_at ve
--     pass_started_at = şimdi. pass_started_at eskidikçe (tur bitmiyor) cron bunu izlemeye bildirir.
--   • En çok p_limit satır (en çok 1000), iki kova arasında yarı yarıya; bir kovanın payı dolunca imleç son listelenen
--     nesnede durur (atlanan yok). İmleç satırı FOR UPDATE kilitlenir: eşzamanlı iki süpürme aynı sayfayı almaz.
--     Silinemeyen dosya sonraki turda yeniden listelenir. Payı 0 olan kovaya bakılmaz, imleci oynamaz (p_limit 0: hiçbiri).
--   • Kova sürümlemesi (versioning) açık olmamalı: silme işaretleri listelenir ve C UPDATE'leri reddeder (C 01 14. satır).
--
-- Tekrar çalıştırılabilir. Medya verisine ve dosyalara dokunmaz; yalnız kendi imleç tablosuna yazar.
-- GERİ DÖNÜŞ:
--   drop function if exists public.media_stray_objects(integer, integer);
--   drop function if exists public.media_stray_objects(integer);
--   drop table if exists public.media_stray_cursor;
-- =============================================================================

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
