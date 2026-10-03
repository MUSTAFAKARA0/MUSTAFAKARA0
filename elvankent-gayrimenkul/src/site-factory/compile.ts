import { homeSectionSchema, SECTION_SCHEMAS, type HomeSectionConfig, type SiteConfig } from '@/site-config/schema';
import type { DesignFamily } from '@/site-factory/families';

/**
 * SITE COMPILER — seçilen tasarım ailesini sitenin yapılandırma bölümlerine (manifest)
 * dönüştürür. Çıktı yalnızca doğrulanmış site_config bölümleridir; katalog veya kod değildir:
 *
 *   tasarım ailesi (Site Factory) → compileDesign() → { theme, colors, typography, style, home }
 *     → taslak (site_save_draft) → önizleme → yayın → Site Engine yalnızca manifesti çizer
 *
 * Kiracının içeriği korunur: ana sayfa bölümlerinin özel metinleri (başlık, açıklama, çağrı)
 * ve "metin" bölümleri aynen taşınır; ailede yer almayan bölümler silinmez, kapalı olarak
 * listenin sonunda kalır (yeniden açılabilir). Marka, menü, header içeriği, footer, sayfalar ve
 * SEO bölümlerine dokunulmaz; renk düzeni (açık/koyu) kiracının seçimi olarak kalır.
 * Tipografi tasarımın parçasıdır: aile kendi yazı tipi sistemini (boşsa temanınkini) getirir.
 */
export interface CompiledDesign {
  theme: SiteConfig['theme'];
  colors: SiteConfig['colors'];
  typography: SiteConfig['typography'];
  style: SiteConfig['style'];
  home: { sections: HomeSectionConfig[] };
}

export function compileDesign(family: DesignFamily, current: SiteConfig): CompiledDesign {
  const existing = current.home?.sections ?? [];
  const byType = new Map(existing.filter((s) => s.type !== 'text').map((s) => [s.type, s] as const));
  const sections: HomeSectionConfig[] = family.home.map((type) => {
    const prev = byType.get(type);
    return prev ? { ...prev, enabled: true } : homeSectionSchema.parse({ id: type.replace('_', '-'), type });
  });
  // Kiracının kendi metin bölümleri kaybolmaz: iletişim bölümünden önce (yoksa sona) eklenir
  const texts = existing.filter((s) => s.type === 'text');
  const contactAt = sections.findIndex((s) => s.type === 'contact');
  sections.splice(contactAt >= 0 ? contactAt : sections.length, 0, ...texts);
  // Ailede olmayan, kiracının özelleştirdiği bölümler kaybolmaz: kapalı olarak sona eklenir
  const placed = new Set(family.home);
  for (const s of existing) if (s.type !== 'text' && !placed.has(s.type)) sections.push({ ...s, enabled: false });

  // Her bölüm, taslağa yazılmadan önce sitenin şemasıyla doğrulanır (hatalı aile tanımı yayına çıkamaz)
  return {
    theme: SECTION_SCHEMAS.theme.parse(family.theme),
    colors: SECTION_SCHEMAS.colors.parse({ mode: 'preset', preset: family.palette, scheme: current.colors.scheme }),
    typography: SECTION_SCHEMAS.typography.parse(family.typography ?? {}),
    style: SECTION_SCHEMAS.style.parse(family.style),
    home: SECTION_SCHEMAS.home.parse({ sections: sections.slice(0, 20) }),
  };
}
