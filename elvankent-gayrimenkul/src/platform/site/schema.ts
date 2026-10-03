import { z } from 'zod';
import {
  colorsSchema,
  colorTokensSchema,
  headerStyleSchema,
  hexColor,
  styleSchema,
  themeSchema,
  typographySchema,
  type ColorsConfig,
  type ColorTokens,
  type StyleConfig,
  type TypographyConfig,
} from '@/theme-engine/settings';

// Tema ayarları Theme Engine'e aittir; site yapılandırması onları kendi belgesine katar.
// Geriye uyumluluk için buradan da dışa aktarılır.
import type { ThemeId } from '@/theme-engine/ids';
export { THEME_IDS, FONT_IDS, type ThemeId, type FontId } from '@/theme-engine/ids';
export { colorsSchema, colorTokensSchema, styleSchema, themeSchema, typographySchema, type ColorsConfig, type ColorTokens, type StyleConfig, type TypographyConfig };

/**
 * Kiracı web sitesi yapılandırması (site_configs.draft / published).
 *
 * Yalnızca SUNUM katmanını tanımlar: tema, renkler, tipografi, header, menü, ana sayfa
 * bölümleri, footer, sayfa görünürlüğü/SEO ve site SEO'su. İlanlar, CRM, kullanıcılar,
 * URL'ler bu belgeden etkilenmez. Tüm alanlar isteğe bağlıdır: boş belge = varsayılan
 * görünüm (bugünkü site). Belge her okunuşta bu şemayla doğrulanır; tanınmayan veya
 * bozuk bölüm varsayılana döner (site asla kırılmaz).
 *
 * Bölümler taslakta ayrı ayrı kaydedilir (site_save_draft(org, bölüm, değer)).
 */

const hex = hexColor;
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));
const id = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** Site içi yol (/…) veya https:// bağlantısı */
export const linkHref = z
  .string()
  .trim()
  .max(300)
  .refine((v) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\/[^\s]+$/.test(v) || /^(tel|mailto):[^\s]+$/.test(v), {
    message: 'Bağlantı "/" ile başlayan site içi bir adres veya https:// ile başlayan bir adres olmalıdır.',
  });

// --------------------------------------------------------------------------- Tema, renkler, tipografi, bileşen stilleri → @/theme-engine/settings

// --------------------------------------------------------------------------- Header
export const headerSchema = z.object({
  sticky: z.boolean().default(true),
  /** light: açık zemin · dark: ikincil (koyu) renk zemin · boş: temanın varsayılanı */
  style: headerStyleSchema.optional(),
  height: z.enum(['compact', 'regular']).default('regular'),
  showPhone: z.boolean().default(true),
  showWhatsapp: z.boolean().default(false),
  showFavorites: z.boolean().default(true),
  /**
   * Marka alanı: auto = logo varsa logo, yoksa monogram + ad · logo = yalnızca logo ·
   * logo-name = logo + şirket adı (logoda ad yazmıyorsa) · name = yalnızca yazı
   */
  brand: z.enum(['auto', 'logo', 'logo-name', 'name']).default('auto'),
  /** Adın altında slogan (yalnızca geniş ekranda) */
  showTagline: z.boolean().default(false),
  cta: z.object({ label: text(40).min(2), href: linkHref }).optional(),
  mobile: z.object({ showPhone: z.boolean().default(false), showWhatsapp: z.boolean().default(true) }).default({ showPhone: false, showWhatsapp: true }),
});
export type HeaderConfig = z.infer<typeof headerSchema>;

// --------------------------------------------------------------------------- Menü
const navLeaf = z.object({ id, label: text(40).min(1), href: linkHref, visible: z.boolean().default(true) });
export const navItemSchema = navLeaf.extend({ children: z.array(navLeaf).max(12).default([]) });
export const navigationSchema = z.array(navItemSchema).max(12);
export type NavItemConfig = z.infer<typeof navItemSchema>;

// --------------------------------------------------------------------------- Ana sayfa
export const HOME_SECTION_TYPES = ['hero', 'showcase', 'categories', 'latest', 'regions', 'process', 'owner_cta', 'text', 'blog', 'contact'] as const;
export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];
export const homeSectionSchema = z.object({
  id,
  type: z.enum(HOME_SECTION_TYPES),
  enabled: z.boolean().default(true),
  eyebrow: optionalText(40),
  title: optionalText(120),
  description: optionalText(400),
  /** Yalnızca "text" bölümü: paragraflar (boş satırla ayrılır) */
  body: optionalText(4000),
  ctaLabel: optionalText(40),
  ctaHref: linkHref.optional(),
});
export const homeSchema = z.object({ sections: z.array(homeSectionSchema).max(20) });

/** Yapılandırma yoksa bugünkü ana sayfa sırası */
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = (
  ['hero', 'showcase', 'categories', 'latest', 'regions', 'process', 'owner_cta', 'blog', 'contact'] as const
).map((type) => homeSectionSchema.parse({ id: type.replace('_', '-'), type }));
export type HomeSectionConfig = z.infer<typeof homeSectionSchema>;

// --------------------------------------------------------------------------- Footer
const footerLink = z.object({ id, label: text(40).min(1), href: linkHref, visible: z.boolean().default(true) });
export const footerSchema = z.object({
  columns: z.array(z.object({ id, title: text(40).min(1), links: z.array(footerLink).max(12) })).max(4).optional(),
  showContact: z.boolean().default(true),
  showHours: z.boolean().default(true),
  showSocial: z.boolean().default(true),
  about: optionalText(300),
  copyright: optionalText(160),
});
export type FooterConfig = z.infer<typeof footerSchema>;

// --------------------------------------------------------------------------- Marka (taslak)
/**
 * Taslaktaki marka değişiklikleri (yalnızca DEĞİŞEN alanlar). Yayında
 * organization_settings'e uygulanır; önizlemede üste bindirilir. Sütun adları
 * veritabanındaki beyaz listeyle (site_brand_columns) aynıdır.
 */
export const BRAND_FIELDS = [
  'display_name', 'short_name', 'legal_name', 'tagline', 'description',
  'phone', 'whatsapp', 'email', 'address_line', 'address_district', 'address_city', 'maps_url',
  'instagram_url', 'facebook_url', 'x_url', 'youtube_url', 'linkedin_url', 'tiktok_url',
  'logo_url', 'logo_mobile_url', 'favicon_url', 'og_image_url', 'hero_image_url',
  'primary_color', 'accent_color',
] as const;
export type BrandField = (typeof BRAND_FIELDS)[number];
export type BrandDraft = Partial<Record<BrandField, string | null>>;
export const brandDraftSchema = z.partialRecord(z.enum(BRAND_FIELDS), z.string().max(2000).nullable());

// --------------------------------------------------------------------------- Sayfalar
export const PAGE_KEYS = ['hakkimizda', 'hizmetlerimiz', 'iletisim', 'degerleme', 'blog', 'bolgeler'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export const pageSettingsSchema = z.object({
  visible: z.boolean().default(true),
  title: optionalText(80),
  seoTitle: optionalText(70),
  seoDescription: optionalText(200),
  ogTitle: optionalText(90),
  ogDescription: optionalText(200),
});
export const pagesSchema = z.partialRecord(z.enum(PAGE_KEYS), pageSettingsSchema);
export type PageSettings = z.infer<typeof pageSettingsSchema>;

// --------------------------------------------------------------------------- SEO
export const seoSchema = z.object({
  title: optionalText(70),
  description: optionalText(200),
  /** noindex: site arama motorlarına kapalı (demo/önizleme zaten kapalıdır) */
  robots: z.enum(['index', 'noindex']).default('index'),
  schemaType: z.enum(['RealEstateAgent', 'LocalBusiness', 'Organization']).default('RealEstateAgent'),
  priceRange: optionalText(20),
});
export type SeoConfig = z.infer<typeof seoSchema>;

export const SECTION_SCHEMAS = {
  theme: themeSchema,
  colors: colorsSchema,
  typography: typographySchema,
  header: headerSchema,
  navigation: navigationSchema,
  home: homeSchema,
  footer: footerSchema,
  pages: pagesSchema,
  seo: seoSchema,
  style: styleSchema,
} as const;
/** Genel kaydetme ile yazılabilen bölümler (marka yalnızca ayrı, doğrulamalı işlemle) */
export type SiteSection = keyof typeof SECTION_SCHEMAS;
export const SITE_SECTIONS = Object.keys(SECTION_SCHEMAS) as SiteSection[];

export interface SiteConfig {
  theme: ThemeId;
  colors: ColorsConfig;
  typography: TypographyConfig;
  header: HeaderConfig;
  navigation: NavItemConfig[] | null;
  home: { sections: HomeSectionConfig[] } | null;
  footer: FooterConfig;
  pages: Partial<Record<PageKey, PageSettings>>;
  seo: SeoConfig;
  style: StyleConfig;
  /** Yalnızca taslakta: yayınlanmamış marka değişiklikleri */
  brand: BrandDraft;
}

/** Ham JSON belgeyi doğrular; geçersiz bölüm varsayılana döner (site asla kırılmaz) */
export function parseSiteConfig(raw: unknown): SiteConfig {
  const doc = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    if (value === undefined || value === null) return fallback;
    const r = schema.safeParse(value);
    return r.success ? r.data : fallback;
  };
  return {
    theme: pick(themeSchema, doc.theme, 'klasik'),
    colors: pick(colorsSchema, doc.colors, colorsSchema.parse({})),
    typography: pick(typographySchema, doc.typography, {}),
    header: pick(headerSchema, doc.header, headerSchema.parse({})),
    navigation: pick(navigationSchema.nullable(), doc.navigation, null),
    home: pick(homeSchema.nullable(), doc.home, null),
    footer: pick(footerSchema, doc.footer, footerSchema.parse({})),
    pages: pick(pagesSchema, doc.pages, {}),
    seo: pick(seoSchema, doc.seo, seoSchema.parse({})),
    style: pick(styleSchema, doc.style, {}),
    brand: pick(brandDraftSchema, doc.brand, {}) as BrandDraft,
  };
}

// --------------------------------------------------------------------------- Özellik bayrakları
export const FEATURE_KEYS = ['crm', 'analytics', 'pdf', 'custom_domain', 'blog', 'valuation', 'whatsapp', 'favorites', 'advanced_seo', 'dark_mode'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

export function parseFeatureOverrides(raw: unknown): FeatureOverrides {
  const out: FeatureOverrides = {};
  if (raw && typeof raw === 'object') {
    for (const k of FEATURE_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

export type SiteStatus = 'active' | 'maintenance' | 'draft';
