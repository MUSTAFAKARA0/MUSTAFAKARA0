/**
 * Veritabanı satır tipleri (supabase/migrations ile birebir uyumlu).
 * Şema değiştiğinde bu dosya da güncellenmelidir. İsteğe bağlı olarak
 * `npx supabase gen types typescript` çıktısıyla değiştirilebilir.
 */

export type ListingType = 'sale' | 'rent';
export type PropertyCategory = 'konut' | 'isyeri' | 'arsa';
export type PropertyStatus = 'draft' | 'active' | 'passive' | 'sold' | 'rented';
export type CurrencyCode = 'TRY' | 'USD' | 'EUR';
export type LocationPrecision = 'exact' | 'approximate' | 'neighborhood';
export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';
export type PropertyEventType = 'view' | 'phone_click' | 'whatsapp_click' | 'contact_form' | 'favorite_add' | 'share';
export type FeatureGroup = 'ic' | 'dis' | 'muhit' | 'ulasim';

export interface SiteSettings {
  id: number;
  business_name: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  working_hours: string | null;
  logo_url: string | null;
  about_text: string | null;
  office_latitude: number | null;
  office_longitude: number | null;
  instagram_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  updated_at: string;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

export interface District {
  id: number;
  city_id: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Neighborhood {
  id: number;
  district_id: number;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PropertyType {
  id: number;
  category: PropertyCategory;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Feature {
  id: number;
  key: string;
  label: string;
  feature_group: FeatureGroup;
  sort_order: number;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  alt: string | null;
  sort_order: number;
  is_cover: boolean;
}

export interface PropertyRow {
  id: string;
  listing_no: number;
  slug: string;
  title: string;
  description: string;
  listing_type: ListingType;
  property_type_id: number;
  category: PropertyCategory;
  status: PropertyStatus;
  is_featured: boolean;
  is_demo: boolean;
  price: number;
  currency: CurrencyCode;
  price_negotiable: boolean;
  dues: number | null;
  deposit: number | null;
  city_id: number;
  district_id: number;
  neighborhood_id: number | null;
  public_latitude: number | null;
  public_longitude: number | null;
  location_precision: LocationPrecision;
  gross_m2: number | null;
  net_m2: number | null;
  room_count: number | null;
  living_room_count: number | null;
  rooms_label: string | null;
  building_age: number | null;
  floor: string | null;
  total_floors: number | null;
  bathroom_count: number | null;
  balcony_count: number | null;
  heating: string | null;
  has_elevator: boolean | null;
  parking: string | null;
  is_furnished: boolean | null;
  in_complex: boolean | null;
  complex_name: string | null;
  has_air_conditioning: boolean | null;
  credit_eligible: boolean | null;
  deed_status: string | null;
  usage_status: string | null;
  facades: string[];
  views: string[];
  swap_available: boolean | null;
  zoning_status: string | null;
  block_no: string | null;
  parcel_no: string | null;
  floor_area_ratio: number | null;
  height_limit: string | null;
  meta_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyLocation {
  property_id: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  precision: LocationPrecision;
}

export interface PropertyStats {
  property_id: string;
  view_count: number;
  phone_click_count: number;
  whatsapp_click_count: number;
  contact_form_count: number;
  favorite_count: number;
  share_count: number;
}

export interface ContactRequest {
  id: string;
  property_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  message: string;
  source: 'contact_page' | 'property_detail';
  status: ContactStatus;
  admin_note: string | null;
  kvkk_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Redirect {
  id: number;
  from_path: string;
  to_path: string;
  status_code: 301 | 302 | 307 | 308;
}

/** Liste/kart görünümü için hafif ilan modeli */
export interface PropertyCardData {
  id: string;
  listing_no: number;
  slug: string;
  title: string;
  listing_type: ListingType;
  category: PropertyCategory;
  status: PropertyStatus;
  is_featured: boolean;
  is_demo: boolean;
  price: number;
  currency: CurrencyCode;
  gross_m2: number | null;
  net_m2: number | null;
  rooms_label: string | null;
  floor: string | null;
  building_age: number | null;
  created_at: string;
  published_at: string | null;
  type_name: string;
  city_name: string;
  district_name: string;
  neighborhood_name: string | null;
  cover: Pick<PropertyImage, 'storage_path' | 'width' | 'height' | 'blur_data_url' | 'alt'> | null;
  image_count: number;
}

/** Detay sayfası modeli */
export interface PropertyDetail extends PropertyRow {
  type: Pick<PropertyType, 'id' | 'name' | 'slug' | 'category'>;
  city: Pick<City, 'id' | 'name' | 'slug'>;
  district: Pick<District, 'id' | 'name' | 'slug'>;
  neighborhood: Pick<Neighborhood, 'id' | 'name' | 'slug'> | null;
  images: PropertyImage[];
  features: Pick<Feature, 'id' | 'key' | 'label' | 'feature_group' | 'sort_order'>[];
}

export interface DashboardStats {
  total: number;
  active: number;
  passive: number;
  draft: number;
  featured: number;
  demo: number;
  total_views: number;
  new_contacts: number;
  period: {
    views: number;
    phone_clicks: number;
    whatsapp_clicks: number;
    contact_forms: number;
    favorites: number;
    shares: number;
  };
  daily: { day: string; views: number; leads: number }[];
}
