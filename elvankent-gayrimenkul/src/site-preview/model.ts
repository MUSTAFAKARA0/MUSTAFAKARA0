import 'server-only';
import type { HomeData } from '@/components/site/site-home';
import type { PropertyCard } from '@/modules/properties/types';
import type { RegionPage } from '@/modules/content/queries';
import { defaultSettings } from '@/platform/tenant/default-settings';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import { parseSiteConfig } from '@/site-config/schema';
import type { PreviewPayload } from '@/site-factory/site-info';
import { initialSiteSections } from '@/site-factory/site-info';
import { resolveStyle } from '@/theme-engine/themes';

/**
 * GERÇEK ÖNİZLEME modeli: manifest + site bilgileri → kiracı sitesinin kullandığı AYNI SiteView
 * (compileManifest → parseSiteConfig → resolveStyle) ve örnek içerik. Önizleme bileşenleri
 * (SiteFrame, SiteHome) kiracı sitesiyle aynıdır; yalnızca veri kaynağı farklıdır.
 *
 * Örnek içerik açıkça örnektir (sayfanın üstünde "Önizleme · örnek içerik" yazar) ve hiçbir
 * gerçek kiracının verisini okumaz; görseller uygulamanın kendi demo görselleridir.
 */
const PREVIEW_ID = '00000000-0000-4000-8000-000000000000';

const demo = (folder: string) => ({
  id: `ornek-${folder}`,
  public_base: `/demo/${folder}`,
  legacy_path: null,
  variant_widths: [320, 640, 960, 1440, 1920],
  width: 1920,
  height: 1280,
  alt_text: null,
  blur_data_url: null,
  sort_order: 0,
  is_cover: true,
});

type Sample = [folder: string, title: string, type: [slug: string, name: string], category: PropertyCard['category'], listing: PropertyCard['listingType'], price: number, rooms: string | null, m2: number];
const SAMPLES: Sample[] = [
  ['villa', 'Örnek ilan · Havuzlu villa', ['villa', 'Villa'], 'konut', 'sale', 18_500_000, '5+1', 320],
  ['apartment-facade', 'Örnek ilan · Site içinde 3+1 daire', ['daire', 'Daire'], 'konut', 'sale', 6_750_000, '3+1', 145],
  ['living-room', 'Örnek ilan · Eşyalı 2+1 daire', ['daire', 'Daire'], 'konut', 'rent', 32_000, '2+1', 95],
  ['house-garden', 'Örnek ilan · Bahçeli müstakil ev', ['mustakil-ev', 'Müstakil ev'], 'konut', 'sale', 9_400_000, '4+1', 210],
  ['duplex-facade', 'Örnek ilan · Dubleks daire', ['daire', 'Daire'], 'konut', 'sale', 11_200_000, '4+2', 230],
  ['office', 'Örnek ilan · Cadde üzeri ofis', ['ofis', 'Ofis'], 'ticari', 'rent', 45_000, null, 140],
  ['land', 'Örnek ilan · İmarlı arsa', ['arsa', 'Arsa'], 'arsa', 'sale', 3_900_000, null, 600],
  ['kitchen', 'Örnek ilan · Yenilenmiş 3+1 daire', ['daire', 'Daire'], 'konut', 'sale', 5_250_000, '3+1', 130],
];

function sampleCards(city: string): PropertyCard[] {
  return SAMPLES.map(([folder, title, [typeSlug, typeName], category, listingType, price, roomsLabel, m2], i) => ({
    id: `ornek-${i + 1}`,
    slug: `ornek-${folder}`,
    referenceNo: `ORN-${100 + i}`,
    title,
    listingType,
    category,
    status: 'published',
    isFeatured: i < 4,
    isDemo: true,
    price,
    currency: 'TRY',
    pricePrevious: null,
    grossM2: m2,
    netM2: Math.round(m2 * 0.85),
    roomsLabel,
    roomCount: roomsLabel ? Number(roomsLabel[0]) : null,
    floor: null,
    totalFloors: null,
    buildingAge: null,
    publishedAt: null,
    typeName,
    typeSlug,
    cityName: city,
    districtName: 'Merkez',
    neighborhoodName: null,
    cover: demo(folder),
    imageCount: 1,
    highlights: [],
    isNew: false,
    hasPriceDrop: false,
  }));
}

function sampleRegions(city: string): RegionPage[] {
  return ['Merkez', 'Kuzey', 'Sahil'].map((name, i) => ({
    id: `ornek-bolge-${i}`,
    slug: `ornek-${i}`,
    name: `${name} (örnek)`,
    intro: null,
    body: '',
    faqs: [],
    seoTitle: null,
    seoDescription: null,
    cityId: 0,
    districtId: null,
    neighborhoodId: null,
    citySlug: 'ornek',
    districtSlug: null,
    neighborhoodSlug: null,
    cityName: city,
    districtName: null,
    neighborhoodName: null,
  })) as unknown as RegionPage[];
}

export interface PreviewModel {
  tenant: Tenant;
  view: SiteView;
  data: HomeData;
  /** Kiracıya yazılacak yapılandırmayla AYNI derleme çıktısı (testler eşitliği doğrular) */
  config: ReturnType<typeof parseSiteConfig>;
}

export function buildPreviewModel(payload: { manifest: PreviewPayload['manifest']; info: PreviewPayload['info'] }, origin: string): PreviewModel {
  const { sections, features: f, info } = initialSiteSections(payload.manifest, payload.info);
  const config = parseSiteConfig(sections);
  const city = info.address.city ?? 'Şehir';
  const settings = {
    ...defaultSettings(PREVIEW_ID, info.siteName),
    legal_name: info.companyName ?? null,
    tagline: info.tagline ?? null,
    phone: info.phone ?? null,
    whatsapp: info.whatsapp ?? info.phone ?? null,
    email: info.email ?? null,
    address_line: info.address.line ?? null,
    address_district: info.address.district ?? null,
    address_city: info.address.city ?? null,
    service_area: info.address.city ?? null,
    instagram_url: info.social.instagram ?? null,
    facebook_url: info.social.facebook ?? null,
    x_url: info.social.x ?? null,
    youtube_url: info.social.youtube ?? null,
    linkedin_url: info.social.linkedin ?? null,
    tiktok_url: info.social.tiktok ?? null,
  };
  const tenant: Tenant = {
    key: 'onizleme',
    id: PREVIEW_ID,
    slug: 'onizleme',
    name: info.siteName,
    isDefault: false,
    referencePrefix: 'ORN',
    settings,
    baseUrl: origin,
    features: { crm: false, analytics: false, pdf: false, customDomain: false },
    site: { published: config, version: 0, status: 'active', maintenanceMessage: null, overrides: f },
  };
  const view: SiteView = {
    config,
    style: resolveStyle(config),
    status: 'active',
    maintenanceMessage: null,
    features: {
      blog: f.blog ?? true,
      valuation: f.valuation ?? true,
      whatsapp: f.whatsapp ?? true,
      favorites: f.favorites ?? true,
      advancedSeo: false,
      darkMode: false,
    },
    preview: true,
  };
  const cards = sampleCards(city);
  const count = (pred: (c: PropertyCard) => boolean) => cards.filter(pred).length;
  const data: HomeData = {
    showcase: cards.slice(0, 4),
    latestPool: cards,
    inventory: {
      total: cards.length,
      byListingType: { sale: count((c) => c.listingType === 'sale'), rent: count((c) => c.listingType === 'rent') },
      byCategory: { konut: count((c) => c.category === 'konut'), ticari: count((c) => c.category === 'ticari'), arsa: count((c) => c.category === 'arsa') },
      byType: { villa: count((c) => c.typeSlug === 'villa'), 'mustakil-ev': count((c) => c.typeSlug === 'mustakil-ev') },
    },
    options: { cities: [{ slug: 'ornek', name: city }], districts: [], neighborhoods: [], types: [] },
    regions: sampleRegions(city),
    regionCounts: [],
    posts: [],
  };
  return { tenant, view, data, config };
}
