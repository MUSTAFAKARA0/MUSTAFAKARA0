import { z } from 'zod';
import {
  AGENT_SECTIONS,
  CARD_LAYOUTS,
  CARD_SURFACES,
  FONT_IDS,
  FOOTER_LAYOUTS,
  GALLERY_LAYOUTS,
  GRID_LAYOUTS,
  HEADER_LAYOUTS,
  HERO_LAYOUTS,
  INTERACTION_PATTERNS,
  LISTING_DETAIL_LAYOUTS,
  MAP_LIST_LAYOUTS,
  MOTION_LEVELS,
  NAVIGATION_STYLES,
  SEARCH_STYLES,
  TESTIMONIAL_SECTIONS,
  THEME_IDS,
} from '@/theme-engine/ids';
import { findPalette } from '@/theme-engine/palettes';
import type { SiteSurface } from '@/theme-engine/surfaces';
import { resolveStyle, THEMES } from '@/theme-engine/themes';
import { homeSectionSchema, SECTION_SCHEMAS, type FeatureKey, type HomeSectionConfig, type HomeSectionType, type PageKey, type SiteConfig } from '@/site-config/schema';
import { findDesignFamily } from '@/site-factory/families';
import { DEFAULT_SITE_TYPE, findSiteType } from '@/site-factory/site-types';
import { HOMEPAGE_COMPOSITIONS, type DesignFamily, type HomepageComposition, type SiteType } from '@/site-factory/types';

/**
 * SİTE MANİFESTİ — bir sitenin seçtiği paketin tamamı, ve YALNIZCA o paket:
 *
 *   { siteType: 'real-estate-office', designFamily: 'sinematik-vitrin',
 *     variants: { hero: 'cinematic', header: 'floating', card: 'bezel', footer: 'contact', motion: 'subtle', homepage: 'featured-first', … } }
 *
 * Varyantlar kapalı listelerdir (Theme Engine kimlikleri); boş varyant = ailenin seçimi.
 * compileManifest() manifesti sitenin doğrulanmış yapılandırma bölümlerine çevirir; kiracı
 * sitesi yalnızca bu bölümleri okur (katalog, diğer aileler veya site tipleri kiracıya gitmez).
 * Önizleme ve kiracı aynı manifestten aynı bölümleri üretir (tests/unit/site-manifest.test.mjs).
 */
const slug = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const manifestVariantsSchema = z
  .object({
    /** Tema (görünüm: yazı tipi, köşe, yoğunluk, belirteçler). Boş = ailenin teması. Aile = yapı (yüzey desenleri). */
    theme: z.enum(THEME_IDS).optional(),
    hero: z.enum(HERO_LAYOUTS).optional(),
    header: z.enum(HEADER_LAYOUTS).optional(),
    card: z.enum(CARD_SURFACES).optional(),
    cardLayout: z.enum(CARD_LAYOUTS).optional(),
    footer: z.enum(FOOTER_LAYOUTS).optional(),
    motion: z.enum(MOTION_LEVELS).optional(),
    headingFont: z.enum(FONT_IDS).optional(),
    bodyFont: z.enum(FONT_IDS).optional(),
    homepage: z.enum(HOMEPAGE_COMPOSITIONS).optional(),
    navigation: z.enum(NAVIGATION_STYLES).optional(),
    grid: z.enum(GRID_LAYOUTS).optional(),
    search: z.enum(SEARCH_STYLES).optional(),
    listingDetail: z.enum(LISTING_DETAIL_LAYOUTS).optional(),
    gallery: z.enum(GALLERY_LAYOUTS).optional(),
    mapList: z.enum(MAP_LIST_LAYOUTS).optional(),
    agents: z.enum(AGENT_SECTIONS).optional(),
    testimonials: z.enum(TESTIMONIAL_SECTIONS).optional(),
    interactions: z.array(z.enum(INTERACTION_PATTERNS)).max(INTERACTION_PATTERNS.length).optional(),
  })
  .strict();
export type ManifestVariants = z.infer<typeof manifestVariantsSchema>;

export const siteManifestSchema = z
  .object({
    siteType: slug,
    designFamily: slug,
    /** Renk sistemi (boş = ailenin paleti) */
    palette: z.string().max(40).optional(),
    variants: manifestVariantsSchema.default({}),
  })
  .strict();
export type SiteManifest = z.infer<typeof siteManifestSchema>;

export class ManifestError extends Error {}

const SLOT_KEYS = ['navigation', 'grid', 'search', 'listingDetail', 'gallery', 'mapList', 'agents', 'testimonials', 'interactions'] as const;

/** Kimliklerin katalogda olduğunu doğrular; bilinmeyen tip/aile/palet reddedilir */
export function parseManifest(raw: unknown): { manifest: SiteManifest; family: DesignFamily; siteType: SiteType } {
  const parsed = siteManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ManifestError('Geçersiz site manifesti.');
  const family = findDesignFamily(parsed.data.designFamily);
  if (!family) throw new ManifestError('Geçersiz tasarım ailesi.');
  const siteType = findSiteType(parsed.data.siteType);
  if (!siteType) throw new ManifestError('Geçersiz site tipi.');
  if (parsed.data.palette && !findPalette(parsed.data.palette)) throw new ManifestError('Geçersiz renk paleti.');
  return { manifest: parsed.data, family, siteType };
}

/** Ana sayfa bölüm sırası: aile sırası + site tipi kuralları + kompozisyon vurgusu */
export function composeHome(siteType: SiteType, family: DesignFamily, homepage: HomepageComposition = 'family'): HomeSectionType[] {
  const excluded = new Set(siteType.excludedSections);
  const order = family.home.filter((t) => !excluded.has(t));
  const beforeContact = (t: HomeSectionType) => {
    const at = order.indexOf('contact');
    order.splice(at >= 0 ? at : order.length, 0, t);
  };
  for (const t of siteType.requiredSections) if (!order.includes(t)) beforeContact(t);
  const lead = (t: HomeSectionType) => {
    const at = order.indexOf(t);
    if (at >= 0) order.splice(at, 1);
    order.splice(order[0] === 'hero' ? 1 : 0, 0, t);
  };
  if (homepage === 'featured-first') lead(order.includes('spotlight') || !order.includes('showcase') ? 'spotlight' : 'showcase');
  if (homepage === 'listings-first') lead('latest');
  return order;
}

export interface CompiledManifest {
  /** Görsel paket: tema, renk, tipografi, parçalar, ana sayfa (taslağa yazılır) */
  design: {
    theme: SiteConfig['theme'];
    colors: SiteConfig['colors'];
    typography: SiteConfig['typography'];
    style: SiteConfig['style'];
    home: { sections: HomeSectionConfig[] };
  };
  /** İçerik mimarisi (site tipi): sayfa görünürlükleri ve içerik özellikleri */
  content: { pages: SiteConfig['pages']; features: Partial<Record<FeatureKey, boolean>> };
}

/**
 * Manifesti sitenin yapılandırma bölümlerine derler. Kiracının içeriği korunur: ana sayfa
 * bölümlerinin özel metinleri ve "metin" bölümleri aynen taşınır; kompozisyonda yer almayan
 * bölümler silinmez, kapalı olarak sona eklenir. Marka, menü, header içeriği, footer metinleri
 * ve SEO'ya dokunulmaz; renk düzeni (açık/koyu) kiracının seçimi olarak kalır.
 */
export function compileManifest(raw: unknown, current: SiteConfig): CompiledManifest {
  const { manifest, family, siteType } = parseManifest(raw);
  const v = manifest.variants;
  const homepage = v.homepage ?? 'family';

  const existing = current.home?.sections ?? [];
  const byType = new Map(existing.filter((s) => s.type !== 'text').map((s) => [s.type, s] as const));
  const order = composeHome(siteType, family, homepage);
  const sections: HomeSectionConfig[] = order.map((type) => {
    const prev = byType.get(type);
    return prev ? { ...prev, enabled: true } : homeSectionSchema.parse({ id: type.replace('_', '-'), type });
  });
  const texts = existing.filter((s) => s.type === 'text');
  const contactAt = sections.findIndex((s) => s.type === 'contact');
  sections.splice(contactAt >= 0 ? contactAt : sections.length, 0, ...texts);
  const placed = new Set(order);
  for (const s of existing) if (s.type !== 'text' && !placed.has(s.type)) sections.push({ ...s, enabled: false });

  // Yüzey kararları: manifest varyantı > ailenin kararı (family.style.slots) > standart
  const slots = {
    ...(family.style.slots ?? {}),
    ...Object.fromEntries(SLOT_KEYS.filter((k) => (Array.isArray(v[k]) ? (v[k] as unknown[]).length > 0 : v[k])).map((k) => [k, v[k]])),
  };
  const style = {
    ...family.style,
    ...(v.hero ? { hero: v.hero } : {}),
    ...(v.header ? { headerLayout: v.header } : {}),
    ...(v.card ? { card: v.card } : {}),
    ...(v.cardLayout ? { cardLayout: v.cardLayout } : {}),
    ...(v.footer ? { footerLayout: v.footer } : {}),
    ...(v.motion ? { motion: v.motion } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
    origin: { siteType: siteType.id, family: family.id, homepage },
  };
  // Tema ayrıca seçildiyse yazı tipleri temanındır (ailenin tipografisi yalnızca kendi temasıyla gelir)
  const typography = {
    ...(v.theme ? {} : (family.typography ?? {})),
    ...(v.headingFont ? { heading: v.headingFont } : {}),
    ...(v.bodyFont ? { body: v.bodyFont } : {}),
  };

  const pages: Record<string, unknown> = { ...current.pages };
  for (const key of siteType.hiddenPages as PageKey[]) pages[key] = { ...(current.pages[key] ?? {}), visible: false };

  // Her bölüm taslağa yazılmadan önce sitenin şemasıyla doğrulanır (hatalı tanım yayına çıkamaz)
  return {
    design: {
      theme: SECTION_SCHEMAS.theme.parse(v.theme ?? family.theme),
      colors: SECTION_SCHEMAS.colors.parse({ mode: 'preset', preset: manifest.palette ?? family.palette, scheme: current.colors.scheme }),
      typography: SECTION_SCHEMAS.typography.parse(typography),
      style: SECTION_SCHEMAS.style.parse(style),
      home: SECTION_SCHEMAS.home.parse({ sections: sections.slice(0, 20) }),
    },
    content: { pages: SECTION_SCHEMAS.pages.parse(pages), features: { ...siteType.features } },
  };
}

/**
 * Kayıtlı yapılandırmadan manifesti geri okur (önizleme = kiracı eşitliği ve "tasarımı değiştir"
 * ekranları için). Kaynağı olmayan eski siteler için tip varsayılandır, aile bilinmiyorsa null.
 */
export function manifestFromConfig(config: SiteConfig): SiteManifest | null {
  const origin = config.style.origin;
  const family = origin ? findDesignFamily(origin.family) : null;
  if (!family) return null;
  const s = config.style;
  const themeOverride = config.theme !== family.theme;
  const familyFonts = themeOverride ? undefined : family.typography;
  const variants: ManifestVariants = {
    ...(themeOverride ? { theme: config.theme } : {}),
    ...(s.hero && s.hero !== family.style.hero ? { hero: s.hero } : {}),
    ...(s.headerLayout && s.headerLayout !== family.style.headerLayout ? { header: s.headerLayout } : {}),
    ...(s.card && s.card !== family.style.card ? { card: s.card } : {}),
    ...(s.cardLayout && s.cardLayout !== family.style.cardLayout ? { cardLayout: s.cardLayout } : {}),
    ...(s.footerLayout && s.footerLayout !== family.style.footerLayout ? { footer: s.footerLayout } : {}),
    ...(s.motion && s.motion !== family.style.motion ? { motion: s.motion } : {}),
    ...(config.typography.heading && config.typography.heading !== familyFonts?.heading ? { headingFont: config.typography.heading } : {}),
    ...(config.typography.body && config.typography.body !== familyFonts?.body ? { bodyFont: config.typography.body } : {}),
    ...(origin?.homepage && origin.homepage !== 'family' ? { homepage: origin.homepage as HomepageComposition } : {}),
    // Yalnızca ailenin kararından farklı yüzey seçimleri manifest varyantıdır
    ...Object.fromEntries(
      SLOT_KEYS.filter((k) => s.slots?.[k] !== undefined && JSON.stringify(s.slots[k]) !== JSON.stringify(family.style.slots?.[k])).map((k) => [k, s.slots![k]]),
    ),
  };
  const palette = config.colors.mode === 'preset' && config.colors.preset && config.colors.preset !== family.palette ? config.colors.preset : undefined;
  return { siteType: findSiteType(origin!.siteType)?.id ?? DEFAULT_SITE_TYPE, designFamily: family.id, ...(palette ? { palette } : {}), variants };
}

/** Manifestin tam (çözümlenmiş) hali: boş varyantlar ailenin/temanın değeriyle doldurulur */
export function resolvedVariants(raw: unknown) {
  const { manifest, family } = parseManifest(raw);
  const v = manifest.variants;
  const slots = family.style.slots ?? {};
  const themeId = v.theme ?? family.theme;
  const theme = THEMES[themeId];
  const familyFonts = v.theme ? undefined : family.typography;
  const style = resolveStyle({
    theme: themeId,
    style: {
      ...family.style,
      hero: v.hero ?? family.style.hero,
      headerLayout: v.header ?? family.style.headerLayout,
      card: v.card ?? family.style.card,
      cardLayout: v.cardLayout ?? family.style.cardLayout,
      footerLayout: v.footer ?? family.style.footerLayout,
      motion: v.motion ?? family.style.motion,
    },
  });
  return {
    hero: style.hero,
    header: style.headerLayout,
    card: style.card,
    cardLayout: style.cardLayout,
    footer: style.footerLayout,
    motion: style.motion,
    theme: themeId,
    headingFont: v.headingFont ?? familyFonts?.heading ?? theme.fonts.heading,
    bodyFont: v.bodyFont ?? familyFonts?.body ?? theme.fonts.body,
    homepage: v.homepage ?? 'family',
    palette: manifest.palette ?? family.palette,
    navigation: v.navigation ?? slots.navigation ?? 'standard',
    grid: v.grid ?? slots.grid ?? 'standard',
    search: v.search ?? slots.search ?? 'standard',
    listingDetail: v.listingDetail ?? slots.listingDetail ?? 'standard',
    gallery: v.gallery ?? slots.gallery ?? 'standard',
    mapList: v.mapList ?? slots.mapList ?? 'standard',
    agents: v.agents ?? slots.agents ?? 'none',
    testimonials: v.testimonials ?? slots.testimonials ?? 'none',
    interactions: v.interactions?.length ? v.interactions : (slots.interactions ?? []),
  };
}

/**
 * TASARIM AİLESİ SÖZLEŞMESİ (D7.2): manifestin her site yüzeyi için seçtiği desen kimliği
 * (manifest varyantı > ailenin kararı > tema varsayılanı / standart). Site Engine'in çözümleyicisi
 * derlenmiş yapılandırmadan aynı sonucu üretir (tests/unit/patterns.test.mjs).
 */
export function manifestSurfaces(raw: unknown): Record<SiteSurface, string> {
  const r = resolvedVariants(raw);
  return {
    home: r.hero,
    navigation: r.header,
    footer: r.footer,
    search: r.search,
    listing: r.grid,
    'property-detail': r.listingDetail,
    gallery: r.gallery,
    map: r.mapList,
  };
}
