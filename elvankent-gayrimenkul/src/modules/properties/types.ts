import type { MediaSource } from '@/modules/media/variants';
import type {
  CurrencyCode,
  ListingStatus,
  ListingType,
  LocationPrecision,
  PropertyCategory,
} from '@/modules/properties/constants';
import type { Feature } from '@/modules/properties/taxonomy';

export interface PropertyImage extends MediaSource {
  id: string;
  alt_text: string | null;
  blur_data_url: string | null;
  sort_order: number;
  is_cover: boolean;
}

/** İlan kartı (liste, ana sayfa, favoriler, karşılaştırma) */
export interface PropertyCard {
  id: string;
  slug: string;
  referenceNo: string;
  title: string;
  listingType: ListingType;
  category: PropertyCategory;
  status: ListingStatus;
  isFeatured: boolean;
  isDemo: boolean;
  price: number | null;
  currency: CurrencyCode;
  pricePrevious: number | null;
  grossM2: number | null;
  netM2: number | null;
  roomsLabel: string | null;
  roomCount: number | null;
  floor: string | null;
  totalFloors: number | null;
  buildingAge: number | null;
  publishedAt: string | null;
  typeName: string;
  typeSlug: string;
  cityName: string;
  districtName: string;
  neighborhoodName: string | null;
  cover: PropertyImage | null;
  imageCount: number;
  /** Kartta gösterilecek en fazla 3 kısa özellik (Site içinde, Asansör...) */
  highlights: string[];
  isNew: boolean;
  hasPriceDrop: boolean;
}

/** İlan detay sayfası */
export interface PropertyDetail extends PropertyCard {
  organizationId: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  priceNegotiable: boolean;
  dues: number | null;
  deposit: number | null;
  cityId: number | null;
  districtId: number | null;
  neighborhoodId: number | null;
  citySlug: string | null;
  districtSlug: string | null;
  neighborhoodSlug: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: LocationPrecision;
  livingRoomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  heating: string | null;
  hasElevator: boolean | null;
  parking: string | null;
  isFurnished: boolean | null;
  inComplex: boolean | null;
  complexName: string | null;
  hasAirConditioning: boolean | null;
  creditEligible: boolean | null;
  investmentSuitable: boolean | null;
  deedStatus: string | null;
  usageStatus: string | null;
  facades: string[];
  views: string[];
  swapAvailable: boolean | null;
  zoningStatus: string | null;
  floorAreaRatio: number | null;
  heightLimit: string | null;
  images: PropertyImage[];
  features: Feature[];
  ogImage: PropertyImage | null;
  priceDroppedAt: string | null;
}
