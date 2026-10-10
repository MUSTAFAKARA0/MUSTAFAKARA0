-- =============================================================================
-- Elvankent Gayrimenkul — Referans veriler
-- Konumlar, emlak tipleri, özellik kataloğu ve varsayılan site ayarları.
-- Koordinatlar bölge merkezini temsil eden YAKLAŞIK değerlerdir; ilan konumu
-- yönetim panelinde harita üzerinden ayrıca işaretlenir.
-- =============================================================================

insert into public.site_settings (id, business_name, tagline, about_text)
values (
  1,
  'Elvankent Gayrimenkul',
  'Elvankent ve Etimesgut''ta güvenilir emlak danışmanlığı',
  'Elvankent Gayrimenkul, Etimesgut ve çevresinde konut, iş yeri ve arsa alım-satım ile kiralama süreçlerinde danışmanlık hizmeti sunar. Bölgeyi yakından tanıyan bir ekip olarak, her ilanı yerinde inceler, doğru fiyatlandırma ve şeffaf iletişim ilkesiyle hareket ederiz.' || E'\n\n' ||
  'Amacımız; alıcı, satıcı, kiracı ve mülk sahibinin sürecin her adımında ne olduğunu bildiği, sürprizsiz ve güvenli bir gayrimenkul deneyimi sunmaktır. Tapu işlemlerinden kira sözleşmesine kadar gerekli adımlarda yanınızdayız.'
)
on conflict (id) do nothing;

-- İl
insert into public.cities (name, slug, latitude, longitude) values
  ('Ankara', 'ankara', 39.933400, 32.859700)
on conflict (slug) do nothing;

-- İlçeler
insert into public.districts (city_id, name, slug, latitude, longitude)
select c.id, v.name, v.slug, v.lat, v.lng
from public.cities c
cross join (values
  ('Etimesgut', 'etimesgut', 39.956700, 32.677800),
  ('Sincan', 'sincan', 39.969700, 32.583600),
  ('Yenimahalle', 'yenimahalle', 39.966700, 32.808300),
  ('Çankaya', 'cankaya', 39.900000, 32.860000),
  ('Keçiören', 'kecioren', 39.980000, 32.865000)
) as v(name, slug, lat, lng)
where c.slug = 'ankara'
on conflict (city_id, slug) do nothing;

-- Etimesgut mahalleleri
insert into public.neighborhoods (district_id, name, slug, latitude, longitude)
select d.id, v.name, v.slug, v.lat, v.lng
from public.districts d
join public.cities c on c.id = d.city_id and c.slug = 'ankara'
cross join (values
  ('Elvankent', 'elvankent', 39.948000, 32.624000),
  ('Eryaman', 'eryaman', 39.978000, 32.640000),
  ('Bağlıca', 'baglica', 39.900000, 32.629000),
  ('Topçu', 'topcu', 39.956000, 32.666000),
  ('Piyade', 'piyade', 39.951000, 32.680000),
  ('Süvari', 'suvari', 39.962000, 32.656000),
  ('Şehit Osman Avcı', 'sehit-osman-avci', 39.969000, 32.630000),
  ('Yeşilova', 'yesilova', 39.952000, 32.640000),
  ('Alsancak', 'alsancak', 39.960000, 32.690000),
  ('Atakent', 'atakent', 39.967000, 32.688000),
  ('Ahimesut', 'ahimesut', 39.953000, 32.663000),
  ('Tunahan', 'tunahan', 39.974000, 32.675000),
  ('Güzelkent', 'guzelkent', 39.961000, 32.642000),
  ('Yapracık', 'yapracik', 39.933000, 32.595000),
  ('Göksu', 'goksu', 39.979000, 32.610000)
) as v(name, slug, lat, lng)
where d.slug = 'etimesgut'
on conflict (district_id, slug) do nothing;

-- Emlak tipleri
insert into public.property_types (category, name, slug, sort_order) values
  ('konut', 'Daire', 'daire', 10),
  ('konut', 'Rezidans', 'rezidans', 20),
  ('konut', 'Müstakil Ev', 'mustakil-ev', 30),
  ('konut', 'Villa', 'villa', 40),
  ('konut', 'Dubleks', 'dubleks', 50),
  ('isyeri', 'Dükkan / Mağaza', 'dukkan', 110),
  ('isyeri', 'Ofis / Büro', 'ofis', 120),
  ('isyeri', 'Depo', 'depo', 130),
  ('isyeri', 'İmalathane / Atölye', 'atolye', 140),
  ('isyeri', 'Komple Bina', 'bina', 150),
  ('arsa', 'Konut İmarlı Arsa', 'konut-arsasi', 210),
  ('arsa', 'Ticari İmarlı Arsa', 'ticari-arsa', 220),
  ('arsa', 'Tarla', 'tarla', 230),
  ('arsa', 'Bağ & Bahçe', 'bag-bahce', 240),
  ('arsa', 'Sanayi Arsası', 'sanayi-arsasi', 250)
on conflict (slug) do nothing;

-- Özellik kataloğu
insert into public.features (key, label, feature_group, sort_order) values
  -- İç özellikler
  ('ankastre_mutfak', 'Ankastre mutfak', 'ic', 10),
  ('amerikan_mutfak', 'Amerikan mutfak', 'ic', 20),
  ('ebeveyn_banyosu', 'Ebeveyn banyosu', 'ic', 30),
  ('giyinme_odasi', 'Giyinme odası', 'ic', 40),
  ('vestiyer', 'Vestiyer', 'ic', 50),
  ('kiler', 'Kiler', 'ic', 60),
  ('celik_kapi', 'Çelik kapı', 'ic', 70),
  ('laminat_parke', 'Laminat / parke zemin', 'ic', 80),
  ('pvc_isicam', 'PVC doğrama & ısıcam', 'ic', 90),
  ('dusakabin', 'Duşakabin', 'ic', 100),
  ('beyaz_esya', 'Beyaz eşya', 'ic', 110),
  ('goruntulu_diafon', 'Görüntülü diafon', 'ic', 120),
  ('alarm', 'Hırsız alarmı', 'ic', 130),
  ('somine', 'Şömine', 'ic', 140),
  ('teras', 'Teras', 'ic', 150),
  ('fiber_internet', 'Fiber internet altyapısı', 'ic', 160),
  -- Dış özellikler
  ('guvenlik_24', '7/24 güvenlik', 'dis', 10),
  ('kamera', 'Kamera sistemi', 'dis', 20),
  ('kapici', 'Kapıcı', 'dis', 30),
  ('yuzme_havuzu', 'Yüzme havuzu', 'dis', 40),
  ('spor_alani', 'Spor alanı', 'dis', 50),
  ('oyun_parki', 'Çocuk oyun parkı', 'dis', 60),
  ('jenerator', 'Jeneratör', 'dis', 70),
  ('su_deposu', 'Su deposu', 'dis', 80),
  ('isi_yalitimi', 'Isı yalıtımı', 'dis', 90),
  ('ses_yalitimi', 'Ses yalıtımı', 'dis', 100),
  ('bahce', 'Bahçe', 'dis', 110),
  ('deprem_yonetmeligi', 'Deprem yönetmeliğine uygun', 'dis', 120),
  ('engelli_uygun', 'Engelli erişimine uygun', 'dis', 130),
  -- Muhit
  ('avm', 'Alışveriş merkezi', 'muhit', 10),
  ('market', 'Market', 'muhit', 20),
  ('okul', 'Okul', 'muhit', 30),
  ('hastane', 'Hastane / sağlık ocağı', 'muhit', 40),
  ('park', 'Park', 'muhit', 50),
  ('cami', 'Cami', 'muhit', 60),
  ('eczane', 'Eczane', 'muhit', 70),
  ('spor_salonu', 'Spor salonu', 'muhit', 80),
  -- Ulaşım
  ('banliyo', 'Banliyö / Başkentray', 'ulasim', 10),
  ('metro', 'Metro', 'ulasim', 20),
  ('yht', 'Hızlı tren (YHT) garı', 'ulasim', 30),
  ('otobus', 'Otobüs durağı', 'ulasim', 40),
  ('ana_cadde', 'Ana caddeye yakın', 'ulasim', 50),
  ('cevre_yolu', 'Çevre yoluna yakın', 'ulasim', 60)
on conflict (key) do nothing;
