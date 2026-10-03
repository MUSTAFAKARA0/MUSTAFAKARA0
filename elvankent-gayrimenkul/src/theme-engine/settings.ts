import { z } from 'zod';
import { FONT_IDS, THEME_IDS } from '@/theme-engine/ids';

/**
 * Tema ayarlarının şeması (theme_id + theme_settings). Site yapılandırması
 * (src/platform/site/schema.ts) bu parçaları kendi belgesine katar; Theme Engine site
 * yapılandırmasının geri kalanını (menü, sayfalar, SEO…) bilmez.
 *
 * Not: zod içerir; tarayıcı paketine girmemesi için '@/theme-engine' (index) bunu
 * dışa aktarmaz — yalnızca doğrulama yapan sunucu kodu ve yönetim formları içe aktarır.
 */

export const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Renk #RRGGBB biçiminde olmalıdır.')
  .transform((v) => v.toLowerCase());

// --------------------------------------------------------------------------- Tema
export const themeSchema = z.enum(THEME_IDS);

// --------------------------------------------------------------------------- Renkler
export const colorTokensSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
  border: hexColor,
  success: hexColor,
  warning: hexColor,
  error: hexColor,
});
export type ColorTokens = z.infer<typeof colorTokensSchema>;

export const colorsSchema = z.object({
  /** brand: ofisin kendi ana/vurgu renklerinden türet (Şirket Ayarları) · preset · custom */
  mode: z.enum(['brand', 'preset', 'custom']).default('brand'),
  preset: z.string().max(40).optional(),
  /** Açık / koyu görünüm (koyu yalnızca özellik bayrağı açıksa) */
  scheme: z.enum(['light', 'dark']).default('light'),
  tokens: colorTokensSchema.partial().optional(),
});
export type ColorsConfig = z.infer<typeof colorsSchema>;

// --------------------------------------------------------------------------- Tipografi
export const typographySchema = z.object({
  heading: z.enum(FONT_IDS).optional(),
  body: z.enum(FONT_IDS).optional(),
  headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  /** Genel yazı ölçeği (0.9 – 1.15) */
  scale: z.number().min(0.9).max(1.15).optional(),
});
export type TypographyConfig = z.infer<typeof typographySchema>;

// --------------------------------------------------------------------------- Bileşen stilleri
/**
 * Temanın varsayılanlarını kiracı bazında ezen bileşen stilleri (boş = temadan).
 * card: ilan/içerik kartları · button: düğme köşeleri · footer: alt bilgi zemini ·
 * hero: ana sayfa üst bölüm düzeni
 */
export const styleSchema = z.object({
  card: z.enum(['elevated', 'outline', 'flat']).optional(),
  button: z.enum(['rounded', 'pill', 'square']).optional(),
  footer: z.enum(['dark', 'light', 'brand']).optional(),
  hero: z.enum(['overlay', 'centered', 'split']).optional(),
});
export type StyleConfig = z.infer<typeof styleSchema>;

/** Header'ın tema varyasyonu (açık/koyu); header'ın içeriği site yapılandırmasındadır */
export const headerStyleSchema = z.enum(['light', 'dark']);
