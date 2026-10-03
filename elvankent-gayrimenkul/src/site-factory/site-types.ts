import type { SiteType } from '@/site-factory/types';

/**
 * SİTE TİPLERİ — içerik ve özellik mimarisi. Tasarım ailesinden bağımsızdır: aynı aile
 * (ör. Sinematik Vitrin) bir emlak ofisinde de bir müteahhit sitesinde de kullanılabilir;
 * site tipi hangi bölümlerin, sayfaların ve özelliklerin olacağını belirler.
 *
 * Özellik anahtarları site_set_features'ın kabul ettiği kapalı listedir (FEATURE_KEYS); site
 * tipi yalnızca içerik özelliklerini (blog, değerleme, favoriler, WhatsApp) belirler, paket
 * özelliklerine (crm, analiz, özel alan adı…) dokunmaz — onlar aboneliğe bağlıdır.
 */
export const SITE_TYPES: readonly SiteType[] = [
  {
    id: 'real-estate-office',
    name: 'Emlak Ofisi',
    description: 'Portföy odaklı: satılık/kiralık arama, kategoriler, bölgeler, mülk sahibi çağrısı ve değerleme.',
    // Varsayılan tip: ailelerin kendi kompozisyonu aynen korunur (mevcut siteler bu tiptedir)
    requiredSections: ['hero', 'contact'],
    excludedSections: [],
    features: { favorites: true, valuation: true, whatsapp: true, blog: true },
    hiddenPages: [],
    recommendedFamilies: ['klasik-guven', 'kurumsal-portfoy', 'yalin-galeri'],
  },
  {
    id: 'consultant',
    name: 'Gayrimenkul Danışmanı',
    description: 'Kişisel marka: öne çıkan ilan, çalışma süreci, doğrudan iletişim ve değerleme talebi.',
    requiredSections: ['hero', 'process', 'contact'],
    excludedSections: ['categories'],
    features: { favorites: true, valuation: true, whatsapp: true, blog: true },
    hiddenPages: [],
    recommendedFamilies: ['editoryal-luks', 'yalin-galeri', 'klasik-guven'],
  },
  {
    id: 'project-builder',
    name: 'Proje / Müteahhit',
    description: 'Proje vitrini: öne çıkan proje, rakamlar, yapım süreci; ikinci el değerleme ve mülk sahibi çağrısı yok.',
    requiredSections: ['hero', 'spotlight', 'contact'],
    excludedSections: ['owner_cta', 'categories'],
    features: { valuation: false, favorites: true, whatsapp: true },
    hiddenPages: ['degerleme'],
    recommendedFamilies: ['sinematik-vitrin', 'dogal-yasam', 'editoryal-luks'],
  },
  {
    id: 'developer',
    name: 'Gayrimenkul Geliştirici',
    description: 'Geliştirme portföyü: rakamlar, öne çıkan projeler, bölgeler ve haberler; değerleme yok.',
    requiredSections: ['hero', 'stats', 'spotlight', 'contact'],
    excludedSections: ['owner_cta'],
    features: { valuation: false, favorites: true, blog: true, whatsapp: true },
    hiddenPages: ['degerleme'],
    recommendedFamilies: ['sinematik-vitrin', 'kurumsal-portfoy', 'dogal-yasam'],
  },
  {
    id: 'corporate',
    name: 'Kurumsal Gayrimenkul',
    description: 'Çok şubeli kurum: rakamlar, geniş portföy, kategoriler, bölgeler ve kurumsal içerik.',
    requiredSections: ['hero', 'stats', 'latest', 'regions', 'contact'],
    excludedSections: [],
    features: { favorites: true, valuation: true, blog: true, whatsapp: true },
    hiddenPages: [],
    recommendedFamilies: ['kurumsal-portfoy', 'klasik-guven', 'editoryal-luks'],
  },
];

export const DEFAULT_SITE_TYPE = 'real-estate-office';

export function findSiteType(id: string): SiteType | null {
  return SITE_TYPES.find((t) => t.id === id) ?? null;
}
