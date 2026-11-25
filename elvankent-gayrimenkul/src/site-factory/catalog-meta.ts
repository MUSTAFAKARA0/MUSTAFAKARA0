import 'server-only';
import type { FamilyMeta } from '@/site-factory/catalog-segments';

/**
 * KATALOG ÜST VERİSİ — tasarım ailelerinin segmentleri, etiketleri ve "kime uygun" bilgisi.
 * Yalnızca KARAY panelindeki aile seçicisi (filtre, arama, kart) kullanır; kiracı sitesine girmez.
 * Ailelerin kendi dosyaları (catalog/<kimlik>/index.ts) bu bilgiyi taşımaz: ilk 9 aile donmuş veridir.
 *
 * Dil kuralı (tests/unit/catalog-meta.test.mjs): kısa, doğrulanabilir cümleler. "En iyi", "en çok
 * satan", "garantili" gibi kanıtlanamaz iddialar, oran/süre vaadi ve uydurma sayı YOK.
 */
export type { FamilyMeta, SegmentId } from '@/site-factory/catalog-segments';
export const FAMILY_META: Record<string, FamilyMeta> = {
  'klasik-guven': {
    segments: ['konut', 'kurumsal'],
    tags: ['sıcak', 'serif başlık', 'gölgeli kart', 'fotoğraf üstü arama'],
    bestFor: ['Yerel ve köklü emlak ofisleri', 'Konut ağırlıklı portföy'],
    mood: ['Sıcak', 'Güven veren'],
    density: 'balanced',
    contrast: 'light',
  },
  'sinematik-vitrin': {
    segments: ['proje', 'villa-luks'],
    tags: ['sinematik', 'tam ekran fotoğraf', 'film greni', 'büyük başlık'],
    bestFor: ['Proje ve yeni konut vitrini', 'Fotoğrafı güçlü portföy'],
    notFor: 'Fotoğrafı az ya da düşük çözünürlüklü portföyler',
    mood: ['Dramatik', 'Görsel odaklı'],
    density: 'airy',
    contrast: 'light',
  },
  'editoryal-luks': {
    segments: ['villa-luks', 'butik'],
    tags: ['dergi', 'ortalı logo', 'altın çizgi', 'editoryal kart'],
    bestFor: ['Yüksek segment konut ve villa', 'Kişisel danışmanlık'],
    mood: ['Zarif', 'Dergi düzeni'],
    density: 'airy',
    contrast: 'light',
  },
  'kurumsal-portfoy': {
    segments: ['kurumsal', 'ticari'],
    tags: ['kurumsal', 'yüzen header', 'rakamlar', 'yatay kart'],
    bestFor: ['İlan sayısı fazla, ilan öncelikli ofisler', 'Rakamlarla güven vermek isteyen markalar'],
    mood: ['Modern', 'Net'],
    density: 'balanced',
    contrast: 'light',
  },
  'yalin-galeri': {
    segments: ['butik', 'konut'],
    tags: ['sade', 'köşesiz görsel', 'bol boşluk', 'tek yazı tipi'],
    bestFor: ['Sade ve güçlü marka görünümü isteyenler', 'Az sayıda, iyi fotoğraflı ilan'],
    mood: ['Sakin', 'Minimal'],
    density: 'airy',
    contrast: 'light',
  },
  'dogal-yasam': {
    segments: ['arsa', 'sahil-yazlik', 'villa-luks'],
    tags: ['organik', 'doğal ton', 'yuvarlak köşe', 'yumuşak hareket'],
    bestFor: ['Villa, arsa ve doğa içi yaşam', 'Yeşil alan ve bahçe vurgusu'],
    mood: ['Doğal', 'Samimi'],
    density: 'balanced',
    contrast: 'light',
  },
  luxury: {
    segments: ['villa-luks', 'butik'],
    tags: ['kenardan kenara', 'altın çerçeve', 'geniş görselli seçki', 'tam genişlik galeri'],
    bestFor: ['Az ama seçkin portföy', 'Yüksek segment villa ve proje'],
    notFor: 'Çok sayıda ilanı hızlı taratmak isteyen ofisler',
    mood: ['Prestijli', 'Sakin'],
    density: 'airy',
    contrast: 'light',
  },
  architectural: {
    segments: ['ticari', 'proje'],
    tags: ['plan çizimi', 'numaralı dizin', 'ızgara', 'künye'],
    bestFor: ['Ticari gayrimenkul ve proje portföyü', 'Teknik bilgiyi öne çıkarmak isteyenler'],
    mood: ['Düzenli', 'Teknik'],
    density: 'dense',
    contrast: 'light',
  },
  'map-first': {
    segments: ['konut', 'kiralik', 'kurumsal'],
    tags: ['harita', 'bölge dizini', 'liste ↔ harita', 'filtre'],
    bestFor: ['Yoğun portföylü, şehir içi ofisler', 'Konuma göre arama yapan ziyaretçiler'],
    mood: ['Pratik', 'Keşif odaklı'],
    density: 'dense',
    contrast: 'light',
  },
  'deniz-kiyisi': {
    segments: ['sahil-yazlik', 'villa-luks'],
    tags: ['sahil', 'fotoğraf mozaiği', 'ferah', 'yumuşak köşe'],
    bestFor: ['Yazlık, sahil ve tatil evi portföyü', 'Gerçek ilan fotoğraflarını ilk ekranda göstermek isteyenler'],
    notFor: 'Kapak fotoğrafı bulunmayan ilanlar (mozaik tek görsele düşer)',
    mood: ['Ferah', 'Aydınlık'],
    density: 'airy',
    contrast: 'light',
  },
  'proje-lansman': {
    segments: ['proje'],
    tags: ['afiş', 'iri başlık', 'sayaçlar', 'görsel üstü kart'],
    bestFor: ['Yeni konut projesi satışı', 'Müteahhit ve geliştirici siteleri'],
    notFor: 'Tek tek ikinci el ilan ağırlıklı ofisler',
    mood: ['Cesur', 'Gösterişli'],
    density: 'balanced',
    contrast: 'light',
  },
  'plaza-ofis': {
    segments: ['ticari', 'kurumsal'],
    tags: ['portal', 'sekmeli arama', 'sıkı satır kart', 'künye öncelikli'],
    bestFor: ['Ofis, dükkan ve depo portföyü', 'Çok ilanı hızlı taratmak isteyen ziyaretçiler'],
    mood: ['Net', 'Kurumsal'],
    density: 'dense',
    contrast: 'light',
  },
  'arsa-tarla': {
    segments: ['arsa'],
    tags: ['harita', 'parsel', 'numaralı dizin', 'toprak tonu'],
    bestFor: ['Arsa, tarla, bağ ve bahçe portföyü', 'Konum ve bölge bilgisi öne çıkan ilanlar'],
    mood: ['Doğal', 'Düzenli'],
    density: 'balanced',
    contrast: 'light',
  },
  'kurumsal-zincir': {
    segments: ['kurumsal'],
    tags: ['kurumsal', 'üst şerit', 'çağrı bandı', 'dört sütunlu footer'],
    bestFor: ['Kurumsal ve düzenli marka görünümü isteyen ofisler', 'Telefon ve çalışma saatini üstte göstermek isteyenler'],
    mood: ['Güçlü', 'Kurumsal'],
    density: 'balanced',
    contrast: 'light',
  },
  'butik-ofis': {
    segments: ['butik'],
    tags: ['seçkin', 'ortalı', 'editoryal kart', 'ilk ilan büyük'],
    bestFor: ['Az ama seçkin portföy', 'Kişisel danışmanlık veren ofisler'],
    notFor: 'Yüzlerce ilanı olan portföyler',
    mood: ['Zarif', 'Kişisel'],
    density: 'airy',
    contrast: 'light',
  },
  'kiralik-merkezi': {
    segments: ['kiralik', 'konut'],
    tags: ['kiralık', 'hızlı filtre', 'sıkı satır kart', 'üst şerit'],
    bestFor: ['Kiralık ağırlıklı portföy', 'Hızlı filtrelemek isteyen ziyaretçiler'],
    mood: ['Pratik', 'Canlı'],
    density: 'dense',
    contrast: 'light',
  },
  'miras-konak': {
    segments: ['miras', 'villa-luks'],
    tags: ['kemer', 'çini geometrisi', 'serif', 'tarihi doku'],
    bestFor: ['Konak, yalı ve tarihi doku portföyü', 'Köklü semtlerde çalışan ofisler'],
    mood: ['Geleneksel', 'Sıcak'],
    density: 'balanced',
    contrast: 'light',
  },
  'gece-premium': {
    segments: ['koyu', 'villa-luks'],
    tags: ['koyu tema', 'pirinç çizgi', 'parıltı', 'görsel üstü kart', 'tam genişlik galeri'],
    bestFor: ['Koyu tema ile premium sunum', 'Akşam ışığında çekilmiş, yüksek kontrastlı fotoğraflar'],
    notFor: 'Koyu görünümün kapalı olduğu siteler',
    mood: ['Gösterişli', 'Sakin'],
    density: 'balanced',
    contrast: 'dark',
  },
};
