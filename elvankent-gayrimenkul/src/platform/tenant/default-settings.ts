import type { Tables } from '@/types/supabase';

export type OrgSettings = Tables<'organization_settings'>;

/** Ayar kaydı olmayan kiracı (ve KARAY önizlemesi) için varsayılan ofis ayarları — yalnızca veri */
export function defaultSettings(orgId: string, name: string): OrgSettings {
  return {
    organization_id: orgId,
    display_name: name,
    legal_name: null,
    tagline: null,
    description: null,
    service_area: null,
    logo_url: null,
    logo_mobile_url: null,
    maps_url: null,
    short_name: null,
    favicon_url: null,
    primary_color: '#0e4d45',
    accent_color: '#b5813a',
    phone: null,
    whatsapp: null,
    email: null,
    address_line: null,
    address_district: null,
    address_city: null,
    postal_code: null,
    office_latitude: null,
    office_longitude: null,
    opening_hours: [],
    working_hours_note: null,
    instagram_url: null,
    facebook_url: null,
    x_url: null,
    youtube_url: null,
    linkedin_url: null,
    tiktok_url: null,
    seo_title: null,
    seo_description: null,
    og_image_url: null,
    google_site_verification: null,
    hero_title: null,
    hero_subtitle: null,
    hero_image_url: null,
    default_location_precision: 'approximate',
    updated_by: null,
    updated_at: new Date(0).toISOString(),
  };
}
