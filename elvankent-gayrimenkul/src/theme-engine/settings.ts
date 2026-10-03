import { z } from 'zod';
import { CARD_LAYOUTS, CARD_SURFACES, FONT_IDS, FOOTER_LAYOUTS, HEADER_LAYOUTS, HERO_LAYOUTS, MOTION_LEVELS, THEME_IDS } from '@/theme-engine/ids';

/**
 * Tema ayarlarının şeması (theme_id + theme_settings). Site yapılandırması
 * (src/site-config/schema.ts) bu parçaları kendi belgesine katar; Theme Engine site
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
 * Yapısal tasarım seçenekleri: sitenin TASARIM MANİFESTİ'nin bileşen kısmı. Değerler kapalı
 * listelerdir (enum); Site Engine her değeri sabit bir bileşen/CSS parçasıyla eşler — kullanıcı
 * verisiyle bileşen adı, dosya yolu veya CSS üretilemez. Boş alan = temanın varsayılanı.
 */

/**
 * Temanın varsayılanlarını kiracı bazında ezen bileşen stilleri (boş = temadan).
 * card: kart yüzeyi · cardLayout: kart düzeni · button: düğme köşeleri · footer: alt bilgi
 * zemini · footerLayout: alt bilgi düzeni · hero: ana sayfa üst bölüm düzeni ·
 * headerLayout: üst bilgi düzeni · motion: hareket dili
 */
export const styleSchema = z.object({
  card: z.enum(CARD_SURFACES).optional(),
  cardLayout: z.enum(CARD_LAYOUTS).optional(),
  button: z.enum(['rounded', 'pill', 'square']).optional(),
  footer: z.enum(['dark', 'light', 'brand']).optional(),
  footerLayout: z.enum(FOOTER_LAYOUTS).optional(),
  hero: z.enum(HERO_LAYOUTS).optional(),
  headerLayout: z.enum(HEADER_LAYOUTS).optional(),
  motion: z.enum(MOTION_LEVELS).optional(),
});
export type StyleConfig = z.infer<typeof styleSchema>;

/** Header'ın tema varyasyonu (açık/koyu); header'ın içeriği site yapılandırmasındadır */
export const headerStyleSchema = z.enum(['light', 'dark']);
