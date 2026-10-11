-- =============================================================================
-- V2 / 5 — İçerik: blog yazıları, düzenlenebilir sayfalar (Hakkımızda, KVKK,
-- gizlilik, çerez, kullanım koşulları, hizmetler) ve bölge (SEO) sayfaları.
--
-- Metinler Markdown olarak saklanır ve sunucuda güvenli bir alt küme ile
-- (HTML'e izin vermeden) işlenir. Hukuki sayfalar için veritabanında satır yoksa
-- uygulama, "hukuki danışman tarafından doğrulanmalıdır" uyarılı şablonu gösterir.
-- =============================================================================

create type public.content_status as enum ('draft', 'published');

-- -----------------------------------------------------------------------------
-- Blog / içerik yazıları
-- -----------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 3 and 140),
  excerpt text check (char_length(excerpt) <= 300),
  body text not null default '' check (char_length(body) <= 50000),
  cover_media_id uuid references public.media_assets (id) on delete set null,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create index posts_org_published_idx on public.posts (organization_id, published_at desc)
  where status = 'published' and deleted_at is null;

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create or replace function public.posts_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'organization_immutable' using errcode = '42501';
  end if;
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.slugify(new.title);
  end if;
  if tg_op = 'INSERT' or new.slug <> old.slug then
    new.slug := public.unique_slug('posts', new.organization_id, new.slug, new.id);
  end if;
  if new.status = 'published' then
    if char_length(btrim(new.body)) < 200 then
      raise exception 'publish_checklist' using errcode = 'P0001', detail = 'body',
        hint = 'Yazı yayınlanmadan önce en az 200 karakterlik içerik gerekir.';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  if new.cover_media_id is not null and not exists (
    select 1 from public.media_assets m where m.id = new.cover_media_id and m.organization_id = new.organization_id
  ) then
    raise exception 'cross_tenant_reference' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

-- -----------------------------------------------------------------------------
-- Düzenlenebilir sabit sayfalar
-- -----------------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key in ('about', 'services', 'kvkk', 'privacy', 'cookies', 'terms')),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) <= 60000),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  -- Hukuki metinler: yönetici "hukuk danışmanı inceledi" onayı verene kadar uyarı gösterilir
  legal_reviewed boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

-- V1 "Hakkımızda" metni (site_settings.about_text) varsayılan kiracının sayfasına taşınır
insert into public.pages (organization_id, key, title, body)
select o.id, 'about', 'Hakkımızda', s.about_text
  from public.organizations o
  join public.site_settings s on s.id = 1
 where o.slug = 'elvankent'
   and s.about_text is not null
   and btrim(s.about_text) <> ''
on conflict (organization_id, key) do nothing;

drop table public.site_settings;

-- -----------------------------------------------------------------------------
-- Bölge sayfaları: /bolgeler/{slug}
-- Kapsam: il (zorunlu) + isteğe bağlı ilçe + isteğe bağlı mahalle.
-- FAQ: [{ "q": "...", "a": "..." }] — uygulamada doğrulanır.
-- -----------------------------------------------------------------------------
create table public.region_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 2 and 80),
  city_id integer not null references public.cities (id) on delete restrict,
  district_id integer references public.districts (id) on delete restrict,
  neighborhood_id integer references public.neighborhoods (id) on delete restrict,
  intro text check (char_length(intro) <= 600),
  body text not null default '' check (char_length(body) <= 20000),
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 20),
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 200),
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  constraint region_pages_scope check (neighborhood_id is null or district_id is not null)
);

create index region_pages_org_idx on public.region_pages (organization_id, status, sort_order);

create trigger region_pages_updated_at before update on public.region_pages
  for each row execute function public.set_updated_at();

create or replace function public.region_pages_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'organization_immutable' using errcode = '42501';
  end if;
  if new.district_id is not null and not exists (
    select 1 from public.districts d where d.id = new.district_id and d.city_id = new.city_id
  ) then
    raise exception 'district_city_mismatch' using errcode = '23514';
  end if;
  if new.neighborhood_id is not null and not exists (
    select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.district_id = new.district_id
  ) then
    raise exception 'neighborhood_district_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger region_pages_before_write before insert or update on public.region_pages
  for each row execute function public.region_pages_before_write();

-- Varsayılan kiracı için gerçek bölgeler. Açıklamalar olgusal ve kısa tutuldu;
-- yönetim panelinden zenginleştirilmesi beklenir. SSS yanıtları sistemin
-- nasıl çalıştığını anlatır, bölge hakkında doğrulanmamış iddia içermez.
insert into public.region_pages (organization_id, slug, name, city_id, district_id, neighborhood_id, intro, faqs, status, sort_order)
select o.id, v.slug, v.name, c.id, d.id, n.id, v.intro, f.faqs, 'published', v.sort_order
  from public.organizations o
  join public.cities c on c.slug = 'ankara'
  cross join (values
    ('elvankent', 'Elvankent', 'etimesgut', 'elvankent',
     'Elvankent, Ankara''nın Etimesgut ilçesine bağlı bir mahalledir. Bu sayfada Elvankent''teki güncel satılık ve kiralık ilanları ve yayındaki ilanlara göre hesaplanan fiyat aralıklarını bulabilirsiniz.', 10),
    ('etimesgut', 'Etimesgut', 'etimesgut', null,
     'Etimesgut, Ankara''nın merkez ilçelerinden biridir. Etimesgut genelindeki güncel satılık ve kiralık ilanlar bu sayfada listelenir.', 20),
    ('yenimahalle', 'Yenimahalle', 'yenimahalle', null,
     'Yenimahalle, Ankara''nın merkez ilçelerinden biridir. Yenimahalle''deki güncel satılık ve kiralık ilanlar bu sayfada listelenir.', 30)
  ) as v(slug, name, district_slug, neighborhood_slug, intro, sort_order)
  join public.districts d on d.city_id = c.id and d.slug = v.district_slug
  left join public.neighborhoods n on n.district_id = d.id and n.slug = v.neighborhood_slug
  cross join (select '[
    {"q": "Bu sayfadaki ilanlar nasıl güncelleniyor?", "a": "İlanlar ofisimiz tarafından yayına alındıkça bu sayfada otomatik olarak listelenir; satılan veya kiralanan ilanlar listeden çıkar."},
    {"q": "Fiyat aralıkları nasıl hesaplanıyor?", "a": "Fiyat aralıkları, bu bölgede şu anda yayında olan ilanlarımızın fiyatlarından otomatik olarak hesaplanır. Bölgenin genel piyasa ortalamasını temsil etmez; güncel değerleme için bizimle iletişime geçebilirsiniz."},
    {"q": "Aradığım özellikte ilan yoksa ne yapabilirim?", "a": "Aradığınız kriterleri iletişim formu veya WhatsApp üzerinden bize iletebilirsiniz. Talebiniz kayda alınır ve uygun bir gayrimenkul olduğunda sizinle iletişime geçilir."}
  ]'::jsonb as faqs) as f
 where o.slug = 'elvankent'
on conflict (organization_id, slug) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.pages enable row level security;
alter table public.region_pages enable row level security;
