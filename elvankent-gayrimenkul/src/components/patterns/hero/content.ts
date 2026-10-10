import type { HeroPatternProps } from '@/components/patterns/contracts';
import { brandingUrl } from '@/modules/media/variants';

/**
 * Hero desenlerinin ortak metin/görsel kararı: mevcut Hero ile AYNI kurallar (bölüm metni →
 * şirket ayarları → varsayılan). Görsel: şirket hero görseli, yoksa vitrindeki ilanın kapağı.
 */
export function heroContent({ tenant, content: o }: Pick<HeroPatternProps, 'tenant' | 'content'>) {
  const s = tenant.settings;
  return {
    eyebrow: o?.eyebrow ?? s.display_name,
    title: o?.title ?? s.hero_title ?? 'Size uygun gayrimenkulü, güvenle bulun.',
    subtitle: o?.description ?? s.hero_subtitle ?? `${s.service_area ? `${s.service_area} ` : ''}seçilmiş satılık ve kiralık gayrimenkuller.`,
    heroImage: brandingUrl(s.hero_image_url),
    area: [s.address_district, s.address_city].filter(Boolean).join(', ') || s.service_area || null,
  };
}
