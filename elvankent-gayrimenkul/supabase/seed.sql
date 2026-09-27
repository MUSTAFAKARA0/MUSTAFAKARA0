-- =============================================================================
-- DEMO ilanları (varsayılan kiracı: Elvankent Gayrimenkul)
--
-- Bu dosyadaki TÜM ilanlar is_demo = true olarak işaretlidir, başlıkları "DEMO –"
-- ile başlar ve GERÇEK BİR MÜLKÜ TEMSİL ETMEZ. Fiyatlar ve özellikler örnek
-- amaçlıdır; görseller public/demo altındaki bilgisayar çizimi illüstrasyonlardır.
-- Yönetim paneli > Ayarlar > Demo ilanlar > "Demo ilanları kaldır" ile tek tıkla çöp
-- kutusuna taşınabilir (İlanlar > Çöp kutusu üzerinden kalıcı silinebilir).
-- Dosya tekrar çalıştırılabilir: demo ilan varsa hiçbir şey yapmaz.
-- =============================================================================

create or replace function pg_temp.demo_images(p_property uuid, p_images text[], p_alts text[])
returns void
language plpgsql
as $$
declare
  i integer;
begin
  for i in 1 .. array_length(p_images, 1) loop
    insert into public.media_assets (
      property_id, kind, status, public_base, variant_widths, width, height, mime_type,
      alt_text, sort_order, is_cover, original_filename
    ) values (
      p_property, 'property_photo', 'ready', '/demo/' || p_images[i], '{320,640,960,1440,1920}', 1920, 1280, 'image/webp',
      p_alts[i] || ' (demo görsel)', i - 1, i = 1, p_images[i] || '.webp'
    );
  end loop;
end;
$$;

create or replace function pg_temp.demo_location(p_property uuid, p_lat numeric, p_lng numeric, p_precision public.location_precision)
returns void
language sql
as $$
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
  values (p_property, 'Demo adres – gerçek adres değildir', p_lat, p_lng, p_precision);
$$;

create or replace function pg_temp.demo_features(p_property uuid, p_keys text[])
returns void
language sql
as $$
  insert into public.property_features (property_id, feature_id)
  select p_property, id from public.features where key = any (p_keys);
$$;

do $$
declare
  v_org uuid;
  v_city integer;
  v_etimesgut integer;
  v_yenimahalle integer;
  v_sincan integer;
  v_id uuid;
  v_disclaimer text := E'\n\nBu bir DEMO ilandır; gerçek bir mülkü temsil etmez. Sitenin nasıl göründüğünü göstermek için eklenmiştir.';
begin
  select id into v_org from public.organizations where is_default;
  if v_org is null then
    raise notice 'Varsayılan organizasyon bulunamadı, demo verisi atlanıyor.';
    return;
  end if;
  if exists (select 1 from public.properties where is_demo and organization_id = v_org) then
    raise notice 'Demo ilanlar zaten mevcut, atlanıyor.';
    return;
  end if;

  select id into v_city from public.cities where slug = 'ankara';
  select id into v_etimesgut from public.districts where slug = 'etimesgut' and city_id = v_city;
  select id into v_yenimahalle from public.districts where slug = 'yenimahalle' and city_id = v_city;
  select id into v_sincan from public.districts where slug = 'sincan' and city_id = v_city;

  -- 1) Satılık 3+1 daire — Elvankent (öne çıkan, ana sayfada)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_featured, show_on_homepage, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    complex_name, has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views, swap_available,
    published_at, created_at
  ) values (
    v_org, 'elvankent-site-icinde-satilik-3-1-daire',
    'DEMO – Elvankent''te Site İçinde Satılık 3+1 Daire',
    'Elvankent''in sakin bir sokağında, güvenlikli site içerisinde konumlanan 3+1 daire. Güney-batı cepheli olması sayesinde gün boyu ışık alır. Ebeveyn banyolu yatak odası, ankastre mutfak ve geniş salon ile aileler için kullanışlı bir yaşam alanı sunar.' || E'\n\n' ||
    'Site içerisinde çocuk oyun alanı ve kapalı otopark bulunmaktadır. Toplu taşıma, okul ve marketlere yürüme mesafesindedir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'daire'), 'published', true, true, true,
    4390000, 'TRY', 1500, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'elvankent' and district_id = v_etimesgut),
    145, 125, 3, 1, 8, '4', 8, 2, 1, 'kombi-dogalgaz', true, 'kapali', false, true,
    'Örnek Konutları (Demo)', false, true, 'kat-mulkiyeti', 'bos', array['guney', 'bati'], array['sehir'], false,
    now() - interval '3 days', now() - interval '3 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.947200, 32.623100, 'approximate');
  perform pg_temp.demo_images(v_id, array['apartment-facade', 'living-room', 'kitchen', 'bedroom', 'bathroom', 'balcony-view'],
    array['Bina dış cephesi', 'Salon', 'Ankastre mutfak', 'Yatak odası', 'Banyo', 'Balkon manzarası']);
  perform pg_temp.demo_features(v_id, array['ankastre_mutfak', 'ebeveyn_banyosu', 'celik_kapi', 'pvc_isicam', 'goruntulu_diafon', 'guvenlik_24', 'kamera', 'oyun_parki', 'isi_yalitimi', 'market', 'okul', 'park', 'otobus', 'banliyo']);
  -- Demo fiyat değişikliği: "Fiyat düştü" rozetini gösterir
  update public.properties set price = 4250000 where id = v_id;

  -- 2) Kiralık 2+1 daire — Eryaman
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo,
    price, currency, dues, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, deed_status, usage_status, facades, published_at, created_at
  ) values (
    v_org, 'eryaman-toplu-tasimaya-yakin-kiralik-2-1-daire',
    'DEMO – Eryaman''da Toplu Taşımaya Yakın Kiralık 2+1 Daire',
    'Eryaman''da ulaşım akslarına yakın, bakımlı binada 2+1 kiralık daire. Salon ve yatak odaları ferah; mutfak kullanışlı ve aydınlık. Bina girişi ve ortak alanlar düzenli olarak temizlenmektedir.' || E'\n\n' ||
    'Çalışan çiftler ve küçük aileler için uygundur. Kira bedeline aidat dahil değildir.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'daire'), 'published', true,
    22000, 'TRY', 1200, 44000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'eryaman' and district_id = v_etimesgut),
    110, 95, 2, 1, 12, '2', 5, 1, 1, 'kombi-dogalgaz', true, 'acik', false, false,
    false, 'kat-mulkiyeti', 'bos', array['dogu'], now() - interval '26 days', now() - interval '26 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.977500, 32.641200, 'approximate');
  perform pg_temp.demo_images(v_id, array['apartment-facade', 'living-room', 'bedroom'], array['Bina dış cephesi', 'Salon', 'Yatak odası']);
  perform pg_temp.demo_features(v_id, array['amerikan_mutfak', 'celik_kapi', 'pvc_isicam', 'kapici', 'market', 'eczane', 'metro', 'otobus', 'ana_cadde']);

  -- 3) Satılık konut imarlı arsa — Bağlıca
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo, investment_suitable,
    price, currency, city_id, district_id, neighborhood_id, gross_m2,
    credit_eligible, deed_status, zoning_status, floor_area_ratio, height_limit, swap_available, published_at, created_at
  ) values (
    v_org, 'baglica-konut-imarli-540-m2-satilik-arsa',
    'DEMO – Bağlıca''da Konut İmarlı 540 m² Satılık Arsa',
    'Bağlıca''nın gelişmekte olan bölgesinde, yola cepheli ve konut imarlı arsa. Düz ve kullanışlı bir parsel yapısına sahiptir; altyapı hizmetlerine yakındır.' || E'\n\n' ||
    'İmar durumu ve yapılaşma koşulları, alım öncesinde ilgili belediyeden güncel olarak teyit edilmelidir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'konut-arsasi'), 'published', true, true,
    6900000, 'TRY', v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'baglica' and district_id = v_etimesgut), 540,
    false, 'mustakil-tapu', 'konut', 1.20, '4 kat', true, now() - interval '41 days', now() - interval '41 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.900400, 32.628200, 'neighborhood');
  perform pg_temp.demo_images(v_id, array['land'], array['Arsa genel görünüm']);
  perform pg_temp.demo_features(v_id, array['ana_cadde', 'cevre_yolu', 'okul']);

  -- 4) Kiralık dükkan — Elvankent
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo,
    price, currency, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, building_age, floor, total_floors, bathroom_count, heating, parking,
    deed_status, usage_status, facades, published_at, created_at
  ) values (
    v_org, 'elvankent-ana-cadde-uzerinde-kiralik-dukkan',
    'DEMO – Elvankent Ana Cadde Üzerinde Kiralık Dükkan',
    'Yaya ve araç trafiğinin yoğun olduğu cadde üzerinde, geniş vitrinli kiralık dükkan. Perakende, kafe veya hizmet sektörü için uygundur. Depo alanı ve WC mevcuttur.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'dukkan'), 'published', true,
    35000, 'TRY', 70000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'elvankent' and district_id = v_etimesgut),
    85, 80, 6, 'zemin', 5, 1, 'kombi-dogalgaz', 'acik', 'kat-mulkiyeti', 'bos', array['kuzey'],
    now() - interval '18 days', now() - interval '18 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.948900, 32.626700, 'approximate');
  perform pg_temp.demo_images(v_id, array['shop'], array['Dükkan vitrini']);
  perform pg_temp.demo_features(v_id, array['kamera', 'ana_cadde', 'otobus', 'market']);

  -- 5) Satılık 4+1 dubleks — Şehit Osman Avcı (öne çıkan)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_featured, show_on_homepage, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views, swap_available, published_at, created_at
  ) values (
    v_org, 'sehit-osman-avci-terasli-satilik-4-1-dubleks',
    'DEMO – Şehit Osman Avcı''da Teraslı Satılık 4+1 Dubleks',
    'İki katlı yaşam alanı sunan, teraslı 4+1 dubleks daire. Alt katta salon, mutfak ve misafir odası; üst katta ebeveyn banyolu yatak odası ve çalışma odası yer alır. Geniş teras şehir manzarası sunar.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'dubleks'), 'published', true, true, true,
    9750000, 'TRY', 2000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'sehit-osman-avci' and district_id = v_etimesgut),
    230, 195, 4, 1, 3, '5', 6, 3, 2, 'yerden-isitma', true, 'kapali', false, true,
    true, true, 'kat-mulkiyeti', 'mulk-sahibi', array['guney', 'dogu'], array['sehir', 'doga'], false,
    now() - interval '9 days', now() - interval '9 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.968600, 32.630900, 'approximate');
  perform pg_temp.demo_images(v_id, array['duplex-facade', 'balcony-view', 'living-room', 'kitchen', 'bedroom', 'bathroom'],
    array['Dubleks dış görünüm', 'Teras manzarası', 'Salon', 'Mutfak', 'Yatak odası', 'Banyo']);
  perform pg_temp.demo_features(v_id, array['ankastre_mutfak', 'ebeveyn_banyosu', 'giyinme_odasi', 'teras', 'laminat_parke', 'somine', 'guvenlik_24', 'yuzme_havuzu', 'spor_alani', 'jenerator', 'deprem_yonetmeligi', 'avm', 'hastane', 'yht']);

  -- 6) Kiralık eşyalı 1+1 — Eryaman (yeni)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo,
    price, currency, dues, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, deed_status, usage_status, facades, published_at, created_at
  ) values (
    v_org, 'eryaman-esyali-kiralik-1-1-daire',
    'DEMO – Eryaman''da Eşyalı Kiralık 1+1 Daire',
    'Taşınmaya hazır, eşyalı 1+1 daire. Beyaz eşyalar, yatak odası ve salon mobilyaları mevcuttur. Öğrenciler ve tek yaşayanlar için pratik bir seçenektir.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'daire'), 'published', true,
    16500, 'TRY', 800, 33000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'eryaman' and district_id = v_etimesgut),
    65, 55, 1, 1, 5, '3', 10, 1, 1, 'merkezi-pay-olcer', true, 'kapali', true, true,
    true, 'kat-mulkiyeti', 'bos', array['bati'], now() - interval '1 day', now() - interval '1 day'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.979900, 32.637400, 'approximate');
  perform pg_temp.demo_images(v_id, array['bedroom', 'living-room', 'kitchen'], array['Yatak odası', 'Salon', 'Mutfak']);
  perform pg_temp.demo_features(v_id, array['beyaz_esya', 'amerikan_mutfak', 'fiber_internet', 'guvenlik_24', 'metro', 'market']);

  -- 7) Satılık ofis — Atakent
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo, investment_suitable,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, heating, has_elevator, parking, has_air_conditioning, credit_eligible, deed_status, usage_status, facades,
    published_at, created_at
  ) values (
    v_org, 'atakent-ana-yola-yakin-satilik-ofis',
    'DEMO – Atakent''te Ana Yola Yakın Satılık Ofis',
    'Ana yola yakın iş merkezinde, açık ofis düzenine uygun satılık ofis. Toplantı odası ve mutfak alanı mevcuttur. Danışmanlık, mühendislik veya sağlık sektörü için değerlendirilebilir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'ofis'), 'published', true, true,
    5400000, 'TRY', 1800, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'atakent' and district_id = v_etimesgut),
    120, 105, 3, 1, 10, '2', 6, 1, 'merkezi', true, 'kapali', true, true, 'kat-mulkiyeti', 'kiracili', array['guney'],
    now() - interval '57 days', now() - interval '57 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.966800, 32.688400, 'approximate');
  perform pg_temp.demo_images(v_id, array['office', 'apartment-facade'], array['Ofis iç mekân', 'Bina dış cephesi']);
  perform pg_temp.demo_features(v_id, array['kamera', 'jenerator', 'fiber_internet', 'ana_cadde', 'otobus', 'banliyo']);

  -- 8) Satılık bahçeli müstakil ev — Yapracık (öne çıkan)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    credit_eligible, deed_status, usage_status, facades, views, swap_available, published_at, created_at
  ) values (
    v_org, 'yapracik-bahceli-satilik-mustakil-ev',
    'DEMO – Yapracık''ta Bahçeli Satılık Müstakil Ev',
    'Şehrin gürültüsünden uzak, geniş bahçeli iki katlı müstakil ev. Meyve ağaçları ve oturma alanı bulunan bahçesiyle doğayla iç içe bir yaşam sunar. Kendi otoparkı mevcuttur.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'mustakil-ev'), 'published', true, true,
    7300000, 'TRY', v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'yapracik' and district_id = v_etimesgut),
    180, 160, 4, 1, 15, 'bahce', 2, 2, 1, 'kombi-dogalgaz', false, 'acik', false, false,
    true, 'mustakil-tapu', 'mulk-sahibi', array['guney', 'dogu', 'bati'], array['doga'], true,
    now() - interval '33 days', now() - interval '33 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.933600, 32.594100, 'neighborhood');
  perform pg_temp.demo_images(v_id, array['house-garden', 'living-room', 'kitchen'], array['Bahçeli müstakil ev', 'Salon', 'Mutfak']);
  perform pg_temp.demo_features(v_id, array['bahce', 'somine', 'celik_kapi', 'su_deposu', 'isi_yalitimi', 'cami', 'market']);

  -- 9) Satılık havuzlu villa — Eryaman (öne çıkan, ana sayfada)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_featured, show_on_homepage, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex, complex_name,
    has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views, published_at, created_at
  ) values (
    v_org, 'eryaman-havuzlu-satilik-5-2-villa',
    'DEMO – Eryaman''da Havuzlu Satılık 5+2 Villa',
    'Villa sitesi içerisinde, özel havuzlu ve bahçeli 5+2 villa. Giriş katında geniş salon ve açık mutfak; üst katta dört yatak odası ve iki banyo; bodrum katta hobi alanı bulunur. Site içerisinde 7/24 güvenlik mevcuttur.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'villa'), 'published', true, true, true,
    18500000, 'TRY', 4500, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'eryaman' and district_id = v_etimesgut),
    420, 360, 5, 2, 4, 'villa', 3, 4, 3, 'yerden-isitma', false, 'kapali', false, true, 'Örnek Villaları (Demo)',
    true, true, 'kat-mulkiyeti', 'mulk-sahibi', array['guney', 'bati'], array['doga', 'sehir'],
    now() - interval '6 days', now() - interval '6 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.981200, 32.648300, 'approximate');
  perform pg_temp.demo_images(v_id, array['villa', 'living-room', 'kitchen', 'bedroom', 'bathroom', 'balcony-view', 'house-garden'],
    array['Villa ve havuz', 'Salon', 'Mutfak', 'Yatak odası', 'Banyo', 'Teras', 'Bahçe']);
  perform pg_temp.demo_features(v_id, array['ankastre_mutfak', 'ebeveyn_banyosu', 'giyinme_odasi', 'somine', 'teras', 'guvenlik_24', 'kamera', 'yuzme_havuzu', 'bahce', 'jenerator', 'isi_yalitimi', 'deprem_yonetmeligi']);

  -- 10) Kiralık ofis — Yenimahalle
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo,
    price, currency, dues, deposit, city_id, district_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, heating, has_elevator, parking, has_air_conditioning, deed_status, usage_status, facades,
    published_at, created_at
  ) values (
    v_org, 'yenimahalle-is-merkezinde-kiralik-ofis',
    'DEMO – Yenimahalle''de İş Merkezinde Kiralık Ofis',
    'Yenimahalle''de, bakımlı bir iş merkezinde 4 odalı kiralık ofis. Bekleme alanı, mutfak ve iki WC bulunur. Toplu taşıma duraklarına yürüme mesafesindedir.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'ofis'), 'published', true,
    42000, 'TRY', 2500, 84000, v_city, v_yenimahalle,
    160, 140, 4, 1, 14, '3', 8, 2, 'merkezi', true, 'kapali', true, 'kat-mulkiyeti', 'bos', array['kuzey', 'dogu'],
    now() - interval '12 days', now() - interval '12 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.968100, 32.807900, 'neighborhood');
  perform pg_temp.demo_images(v_id, array['office', 'apartment-facade'], array['Ofis iç mekân', 'İş merkezi dış cephesi']);
  perform pg_temp.demo_features(v_id, array['kamera', 'jenerator', 'fiber_internet', 'otobus', 'metro']);

  -- 11) Satılık tarla — Sincan
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo, investment_suitable,
    price, currency, city_id, district_id, gross_m2,
    credit_eligible, deed_status, zoning_status, swap_available, published_at, created_at
  ) values (
    v_org, 'sincan-yola-cepheli-satilik-tarla',
    'DEMO – Sincan''da Yola Cepheli 4.800 m² Satılık Tarla',
    'Sincan''da, köy yoluna cepheli ve düz arazi yapısına sahip tarla. Tarımsal kullanım veya uzun vadeli değerlendirme için uygundur. Elektrik hattı yakınındadır.' || E'\n\n' ||
    'Tapu ve imar durumu alım öncesinde ilgili kurumlardan teyit edilmelidir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'tarla'), 'published', true, true,
    3150000, 'TRY', v_city, v_sincan, 4800,
    false, 'hisseli-tapu', 'tarla', true, now() - interval '72 days', now() - interval '72 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.969700, 32.583600, 'neighborhood');
  perform pg_temp.demo_images(v_id, array['field', 'land'], array['Tarla genel görünüm', 'Arazi']);
  perform pg_temp.demo_features(v_id, array['cevre_yolu']);

  -- 12) Satılık 2+1 daire — Elvankent (fiyatı düştü)
  insert into public.properties (
    organization_id, slug, title, description, listing_type, property_type_id, status, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    credit_eligible, deed_status, usage_status, facades, views, published_at, created_at
  ) values (
    v_org, 'elvankent-krediye-uygun-satilik-2-1-daire',
    'DEMO – Elvankent''te Krediye Uygun Satılık 2+1 Daire',
    'Elvankent''te, ara katta ve bakımlı binada 2+1 daire. Salon balkona açılır; mutfak ve banyo yenilenmiştir. Krediye uygundur, tapu devrine hazırdır.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'daire'), 'published', true,
    3150000, 'TRY', 900, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'elvankent' and district_id = v_etimesgut),
    105, 90, 2, 1, 16, '3', 5, 1, 1, 'kombi-dogalgaz', false, 'acik', false, false,
    true, 'kat-mulkiyeti', 'bos', array['guney'], array['sehir'], now() - interval '24 days', now() - interval '24 days'
  ) returning id into v_id;
  perform pg_temp.demo_location(v_id, 39.946100, 32.621800, 'approximate');
  perform pg_temp.demo_images(v_id, array['living-room', 'kitchen', 'bedroom', 'bathroom'], array['Salon', 'Mutfak', 'Yatak odası', 'Banyo']);
  perform pg_temp.demo_features(v_id, array['pvc_isicam', 'celik_kapi', 'laminat_parke', 'market', 'okul', 'otobus', 'banliyo']);
  update public.properties set price = 2990000 where id = v_id;
end;
$$;
