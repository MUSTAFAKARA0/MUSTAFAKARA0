import 'server-only';
import { cache } from 'react';
import { cacheTags } from '@/lib/cache-tags';
import { isSupabaseConfigured } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';
import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';

/**
 * KARAY'ın herkese açık kurumsal profili (Platform › KARAY ayarları). İletişim bilgileri
 * VARSAYILAN OLARAK BOŞTUR: uydurma e-posta/telefon/adres gösterilmez; alan boşsa sayfada
 * o bilgi hiç görünmez. Kiracı (emlak ofisi) verisiyle hiçbir bağı yoktur.
 */
export interface KarayProfile {
  companyName: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  websiteUrl: string | null;
  socials: { label: string; href: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  indexable: boolean;
}

const FALLBACK: KarayProfile = {
  companyName: PLATFORM_BRAND.name,
  tagline: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: null,
  city: null,
  websiteUrl: null,
  socials: [],
  seoTitle: null,
  seoDescription: null,
  indexable: true,
};

/** İstek başına bir kez; 5 dk önbellek (KARAY ayarları kaydedilince etiketle yenilenir) */
export const getKarayProfile = cache(async (): Promise<KarayProfile> => {
  if (!isSupabaseConfigured()) return FALLBACK;
  const client = createPublicClient([cacheTags.karay], 300);
  const { data, error } = await client.rpc('public_platform_profile', undefined, { get: true });
  // Migration henüz uygulanmamışsa sayfa varsayılanlarla çalışır
  const row = error ? null : data?.[0];
  if (!row) return FALLBACK;
  const socials = (
    [
      ['LinkedIn', row.linkedin_url],
      ['Instagram', row.instagram_url],
      ['X', row.x_url],
      ['YouTube', row.youtube_url],
    ] as const
  )
    .filter(([, href]) => Boolean(href))
    .map(([label, href]) => ({ label, href: href as string }));
  return {
    companyName: row.company_name || PLATFORM_BRAND.name,
    tagline: row.tagline,
    email: row.contact_email,
    phone: row.contact_phone,
    whatsapp: row.whatsapp,
    address: row.address,
    city: row.city,
    websiteUrl: row.website_url,
    socials,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    indexable: row.indexable,
  };
});
