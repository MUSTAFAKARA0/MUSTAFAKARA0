import type { BrandInput } from '@/site-editor/brand-input';

type Values = { [K in keyof BrandInput]-?: string };
type BrandSource = { [K in keyof BrandInput]?: string | null };

/** Marka formunun başlangıç değerleri (taslaktaki etkin marka: canlı + bekleyen değişiklikler) */
export function brandValues(s: BrandSource & { display_name: string; primary_color: string; accent_color: string }): Values {
  const v = (x: string | null | undefined) => x ?? '';
  return {
    display_name: s.display_name,
    short_name: v(s.short_name),
    legal_name: v(s.legal_name),
    tagline: v(s.tagline),
    description: v(s.description),
    phone: v(s.phone),
    whatsapp: v(s.whatsapp),
    email: v(s.email),
    address_line: v(s.address_line),
    address_district: v(s.address_district),
    address_city: v(s.address_city),
    maps_url: v(s.maps_url),
    instagram_url: v(s.instagram_url),
    facebook_url: v(s.facebook_url),
    x_url: v(s.x_url),
    youtube_url: v(s.youtube_url),
    linkedin_url: v(s.linkedin_url),
    tiktok_url: v(s.tiktok_url),
    primary_color: s.primary_color,
    accent_color: s.accent_color,
  };
}
