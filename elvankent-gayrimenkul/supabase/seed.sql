-- =============================================================================
-- Elvankent Gayrimenkul — DEMO ilanları
--
-- Bu dosyadaki tüm ilanlar is_demo = true olarak işaretlidir ve GERÇEK BİR
-- MÜLKÜ TEMSİL ETMEZ. Fiyatlar ve özellikler örnek amaçlıdır. Görseller
-- public/demo altındaki illüstrasyonlardır.
-- Yönetim paneli > Ayarlar > "Demo ilanlarını sil" ile tek tıkla silinebilir.
-- =============================================================================

do $$
declare
  v_city integer;
  v_etimesgut integer;
  v_id uuid;
  v_disclaimer text := E'\n\nBu bir DEMO ilandır; gerçek bir mülkü temsil etmez. Sitenin nasıl göründüğünü göstermek için eklenmiştir.';
begin
  if exists (select 1 from public.properties where is_demo) then
    raise notice 'Demo ilanlar zaten mevcut, atlanıyor.';
    return;
  end if;

  select id into v_city from public.cities where slug = 'ankara';
  select id into v_etimesgut from public.districts where slug = 'etimesgut' and city_id = v_city;

  -- 1) Satılık 3+1 daire — Elvankent
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    complex_name, has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views, swap_available
  ) values (
    'satilik-site-icinde-3-plus-1-daire-elvankent',
    'DEMO – Elvankent''te Site İçinde Satılık 3+1 Daire',
    'Elvankent''in sakin bir sokağında, güvenlikli site içerisinde konumlanan 3+1 daire. Güney-batı cepheli olması sayesinde gün boyu ışık alır. Ebeveyn banyolu yatak odası, ankastre mutfak ve geniş salon ile aileler için kullanışlı bir yaşam alanı sunar.' || E'\n\n' ||
    'Site içerisinde çocuk oyun alanı ve kapalı otopark bulunmaktadır. Toplu taşıma, okul ve marketlere yürüme mesafesindedir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'daire'), 'active', true, true,
    4250000, 'TRY', 1500, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'elvankent' and district_id = v_etimesgut),
    145, 125, 3, 1, 8, '4', 8, 2, 1, 'Kombi (Doğalgaz)', true, 'Kapalı otopark', false, true,
    'Örnek Konutları (Demo)', false, true, 'Kat mülkiyeti', 'Boş', array['Güney', 'Batı'], array['Şehir'], false
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.947200, 32.623100, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/apartment-facade.webp', 1600, 1067, 'Bina dış cephesi (demo illüstrasyon)', 0, true),
    (v_id, '/demo/living-room.webp', 1600, 1067, 'Salon (demo illüstrasyon)', 1, false),
    (v_id, '/demo/kitchen.webp', 1600, 1067, 'Ankastre mutfak (demo illüstrasyon)', 2, false),
    (v_id, '/demo/bedroom.webp', 1600, 1067, 'Yatak odası (demo illüstrasyon)', 3, false),
    (v_id, '/demo/bathroom.webp', 1600, 1067, 'Banyo (demo illüstrasyon)', 4, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in
      ('ankastre_mutfak', 'ebeveyn_banyosu', 'celik_kapi', 'pvc_isicam', 'goruntulu_diafon', 'guvenlik_24', 'kamera', 'oyun_parki', 'isi_yalitimi', 'market', 'okul', 'park', 'otobus', 'banliyo');

  -- 2) Kiralık 2+1 daire — Eryaman
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, dues, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views
  ) values (
    'kiralik-metroya-yakin-2-plus-1-daire-eryaman',
    'DEMO – Eryaman''da Toplu Taşımaya Yakın Kiralık 2+1 Daire',
    'Eryaman''da ulaşım akslarına yakın, bakımlı binada 2+1 kiralık daire. Salon ve yatak odaları ferah; mutfak kullanışlı ve aydınlık. Bina girişi ve ortak alanlar düzenli olarak temizlenmektedir.' || E'\n\n' ||
    'Çalışan çiftler ve küçük aileler için uygundur. Kira bedeline aidat dahil değildir.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'daire'), 'active', false, true,
    22000, 'TRY', 1200, 44000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'eryaman' and district_id = v_etimesgut),
    110, 95, 2, 1, 12, '2', 5, 1, 1, 'Kombi (Doğalgaz)', true, 'Açık otopark', false, false,
    false, null, 'Kat mülkiyeti', 'Boş', array['Doğu'], array[]::text[]
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.977500, 32.641200, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/apartment-facade.webp', 1600, 1067, 'Bina dış cephesi (demo illüstrasyon)', 0, true),
    (v_id, '/demo/living-room.webp', 1600, 1067, 'Salon (demo illüstrasyon)', 1, false),
    (v_id, '/demo/bedroom.webp', 1600, 1067, 'Yatak odası (demo illüstrasyon)', 2, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in
      ('amerikan_mutfak', 'celik_kapi', 'pvc_isicam', 'kapici', 'market', 'eczane', 'metro', 'otobus', 'ana_cadde');

  -- 3) Satılık konut imarlı arsa — Bağlıca
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, city_id, district_id, neighborhood_id, gross_m2,
    credit_eligible, deed_status, zoning_status, block_no, parcel_no, floor_area_ratio, height_limit, swap_available
  ) values (
    'satilik-konut-imarli-540-m2-arsa-baglica',
    'DEMO – Bağlıca''da Konut İmarlı 540 m² Satılık Arsa',
    'Bağlıca''nın gelişmekte olan bölgesinde, yola cepheli ve konut imarlı arsa. Düz ve kullanışlı bir parsel yapısına sahiptir; altyapı hizmetlerine yakındır.' || E'\n\n' ||
    'İmar durumu ve yapılaşma koşulları, alım öncesinde ilgili belediyeden güncel olarak teyit edilmelidir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'konut-arsasi'), 'active', false, true,
    6900000, 'TRY', v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'baglica' and district_id = v_etimesgut), 540,
    false, 'Müstakil tapulu', 'Konut', null, null, 1.20, '4 kat', true
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.900400, 32.628200, 'neighborhood');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/land.webp', 1600, 1067, 'Arsa genel görünüm (demo illüstrasyon)', 0, true);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in ('ana_cadde', 'cevre_yolu', 'okul');

  -- 4) Kiralık dükkan — Elvankent
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, building_age, floor, total_floors, bathroom_count, heating, parking,
    deed_status, usage_status, facades
  ) values (
    'kiralik-ana-cadde-uzerinde-dukkan-elvankent',
    'DEMO – Elvankent Ana Cadde Üzerinde Kiralık Dükkan',
    'Yaya ve araç trafiğinin yoğun olduğu cadde üzerinde, geniş vitrinli kiralık dükkan. Perakende, kafe veya hizmet sektörü için uygundur. Depo alanı ve WC mevcuttur.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'dukkan'), 'active', false, true,
    35000, 'TRY', 70000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'elvankent' and district_id = v_etimesgut),
    85, 80, 6, 'Zemin', 5, 1, 'Kombi (Doğalgaz)', 'Açık otopark', 'Kat mülkiyeti', 'Boş', array['Kuzey']
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.948900, 32.626700, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/shop.webp', 1600, 1067, 'Dükkan vitrini (demo illüstrasyon)', 0, true);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in ('kamera', 'ana_cadde', 'otobus', 'market');

  -- 5) Satılık 4+1 dubleks — Şehit Osman Avcı
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, credit_eligible, deed_status, usage_status, facades, views, swap_available
  ) values (
    'satilik-4-plus-1-dubleks-sehit-osman-avci',
    'DEMO – Şehit Osman Avcı''da Teraslı Satılık 4+1 Dubleks',
    'İki katlı yaşam alanı sunan, teraslı 4+1 dubleks daire. Alt katta salon, mutfak ve misafir odası; üst katta ebeveyn banyolu yatak odası ve çalışma odası yer alır. Geniş teras şehir manzarası sunar.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'dubleks'), 'active', true, true,
    9750000, 'TRY', 2000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'sehit-osman-avci' and district_id = v_etimesgut),
    230, 195, 4, 1, 3, '5', 6, 3, 2, 'Yerden ısıtma', true, 'Kapalı otopark', false, true,
    true, true, 'Kat mülkiyeti', 'Mülk sahibi', array['Güney', 'Doğu'], array['Şehir', 'Doğa'], false
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.968600, 32.630900, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/duplex-facade.webp', 1600, 1067, 'Dubleks dış görünüm (demo illüstrasyon)', 0, true),
    (v_id, '/demo/balcony-view.webp', 1600, 1067, 'Teras manzarası (demo illüstrasyon)', 1, false),
    (v_id, '/demo/living-room.webp', 1600, 1067, 'Salon (demo illüstrasyon)', 2, false),
    (v_id, '/demo/kitchen.webp', 1600, 1067, 'Mutfak (demo illüstrasyon)', 3, false),
    (v_id, '/demo/bedroom.webp', 1600, 1067, 'Yatak odası (demo illüstrasyon)', 4, false),
    (v_id, '/demo/bathroom.webp', 1600, 1067, 'Banyo (demo illüstrasyon)', 5, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in
      ('ankastre_mutfak', 'ebeveyn_banyosu', 'giyinme_odasi', 'teras', 'laminat_parke', 'somine', 'guvenlik_24', 'yuzme_havuzu', 'spor_alani', 'jenerator', 'deprem_yonetmeligi', 'avm', 'hastane', 'yht');

  -- 6) Kiralık eşyalı 1+1 — Eryaman
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, dues, deposit, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    has_air_conditioning, deed_status, usage_status, facades
  ) values (
    'kiralik-esyali-1-plus-1-daire-eryaman',
    'DEMO – Eryaman''da Eşyalı Kiralık 1+1 Daire',
    'Taşınmaya hazır, eşyalı 1+1 daire. Beyaz eşyalar, yatak odası ve salon mobilyaları mevcuttur. Öğrenciler ve tek yaşayanlar için pratik bir seçenektir.' || v_disclaimer,
    'rent', (select id from public.property_types where slug = 'daire'), 'active', false, true,
    16500, 'TRY', 800, 33000, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'eryaman' and district_id = v_etimesgut),
    65, 55, 1, 1, 5, '3', 10, 1, 1, 'Merkezi (Pay ölçer)', true, 'Kapalı otopark', true, true,
    true, 'Kat mülkiyeti', 'Boş', array['Batı']
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.979900, 32.637400, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/bedroom.webp', 1600, 1067, 'Yatak odası (demo illüstrasyon)', 0, true),
    (v_id, '/demo/living-room.webp', 1600, 1067, 'Salon (demo illüstrasyon)', 1, false),
    (v_id, '/demo/kitchen.webp', 1600, 1067, 'Mutfak (demo illüstrasyon)', 2, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in ('beyaz_esya', 'amerikan_mutfak', 'fiber_internet', 'guvenlik_24', 'metro', 'market');

  -- 7) Satılık ofis — Etimesgut / Atakent
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, dues, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, heating, has_elevator, parking, has_air_conditioning, credit_eligible, deed_status, usage_status, facades
  ) values (
    'satilik-ofis-atakent',
    'DEMO – Atakent''te Ana Yola Yakın Satılık Ofis',
    'Ana yola yakın iş merkezinde, açık ofis düzenine uygun satılık ofis. Toplantı odası ve mutfak alanı mevcuttur. Danışmanlık, mühendislik veya sağlık sektörü için değerlendirilebilir.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'ofis'), 'active', false, true,
    5400000, 'TRY', 1800, v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'atakent' and district_id = v_etimesgut),
    120, 105, 3, 1, 10, '2', 6, 1, 'Merkezi', true, 'Kapalı otopark', true, true, 'Kat mülkiyeti', 'Kiracılı', array['Güney']
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.966800, 32.688400, 'approximate');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/office.webp', 1600, 1067, 'Ofis iç mekân (demo illüstrasyon)', 0, true),
    (v_id, '/demo/apartment-facade.webp', 1600, 1067, 'Bina dış cephesi (demo illüstrasyon)', 1, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in ('kamera', 'jenerator', 'fiber_internet', 'ana_cadde', 'otobus', 'banliyo');

  -- 8) Satılık bahçeli müstakil ev — Yapracık
  insert into public.properties (
    slug, title, description, listing_type, property_type_id, status, is_featured, is_demo,
    price, currency, city_id, district_id, neighborhood_id,
    gross_m2, net_m2, room_count, living_room_count, building_age, floor, total_floors,
    bathroom_count, balcony_count, heating, has_elevator, parking, is_furnished, in_complex,
    credit_eligible, deed_status, usage_status, facades, views, swap_available
  ) values (
    'satilik-bahceli-mustakil-ev-yapracik',
    'DEMO – Yapracık''ta Bahçeli Satılık Müstakil Ev',
    'Şehrin gürültüsünden uzak, geniş bahçeli iki katlı müstakil ev. Meyve ağaçları ve oturma alanı bulunan bahçesiyle doğayla iç içe bir yaşam sunar. Kendi otoparkı mevcuttur.' || v_disclaimer,
    'sale', (select id from public.property_types where slug = 'mustakil-ev'), 'active', true, true,
    7300000, 'TRY', v_city, v_etimesgut, (select id from public.neighborhoods where slug = 'yapracik' and district_id = v_etimesgut),
    180, 160, 4, 1, 15, 'Bahçe katı', 2, 2, 1, 'Kombi (Doğalgaz)', false, 'Açık otopark', false, false,
    true, 'Müstakil tapulu', 'Mülk sahibi', array['Güney', 'Doğu', 'Batı'], array['Doğa'], true
  ) returning id into v_id;
  insert into public.property_locations (property_id, address, latitude, longitude, precision)
    values (v_id, 'Demo adres – gerçek adres değildir', 39.933600, 32.594100, 'neighborhood');
  insert into public.property_images (property_id, storage_path, width, height, alt, sort_order, is_cover) values
    (v_id, '/demo/house-garden.webp', 1600, 1067, 'Bahçeli müstakil ev (demo illüstrasyon)', 0, true),
    (v_id, '/demo/living-room.webp', 1600, 1067, 'Salon (demo illüstrasyon)', 1, false),
    (v_id, '/demo/kitchen.webp', 1600, 1067, 'Mutfak (demo illüstrasyon)', 2, false);
  insert into public.property_features (property_id, feature_id)
    select v_id, id from public.features where key in ('bahce', 'somine', 'celik_kapi', 'su_deposu', 'isi_yalitimi', 'cami', 'market');
end;
$$;
