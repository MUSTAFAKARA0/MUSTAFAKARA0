import 'server-only';
import { cache } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { CACHE_TAGS, createCachedPublicClient } from '@/lib/data/cache';
import type { SiteSettings } from '@/types/database';

const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  business_name: 'Elvankent Gayrimenkul',
  tagline: 'Elvankent ve Etimesgut’ta güvenilir emlak danışmanlığı',
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  working_hours: null,
  logo_url: null,
  about_text: null,
  office_latitude: null,
  office_longitude: null,
  instagram_url: null,
  facebook_url: null,
  x_url: null,
  youtube_url: null,
  linkedin_url: null,
  updated_at: new Date(0).toISOString(),
};

/**
 * Site ayarlarını getirir. Veritabanına ulaşılamazsa site çökmez;
 * varsayılan değerlerle çalışmaya devam eder.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  try {
    const supabase = createCachedPublicClient([CACHE_TAGS.settings], 3600);
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return data as SiteSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
