import { z } from 'zod';
import { parseSiteConfig, SECTION_SCHEMAS } from '@/site-config/schema';
import { compileManifest, siteManifestSchema, type SiteManifest } from '@/site-factory/manifest';

/**
 * "Yeni Site Oluştur" sihirbazının site bilgileri (adım 1). Aynı şema üç yerde kullanılır:
 * sihirbaz formu (istemci doğrulaması), gerçek önizleme (örnek sitenin adı/iletişimi) ve
 * createSite işlemi (sunucu doğrulaması — istemciye güvenilmez). Organizasyon kimliği
 * hiçbir zaman istemciden alınmaz; oluşturulan kimlik sunucuda üretilir.
 */
const clean = (v: string) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const text = (max: number) => z.string().max(max * 2).transform(clean).pipe(z.string().max(max));
const optionalText = (max: number) =>
  text(max)
    .transform((v) => v || undefined)
    .optional();
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s<>"']+$/.test(v), { message: 'Bağlantı https:// ile başlamalıdır.' })
  .transform((v) => v || undefined)
  .optional();
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), { message: 'Geçerli bir telefon numarası girin.' })
  .transform((v) => v || undefined)
  .optional();

export const SOCIAL_KEYS = ['instagram', 'facebook', 'x', 'youtube', 'linkedin', 'tiktok'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const siteInfoSchema = z.object({
  /** Sitede görünen ad */
  siteName: text(80).pipe(z.string().min(2, { message: 'Site adı en az 2 karakter olmalıdır.' })),
  /** Firma / ofis (ticari unvan) */
  companyName: optionalText(160),
  tagline: optionalText(160),
  phone,
  whatsapp: phone,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Geçerli bir e-posta adresi girin.' })
    .transform((v) => v || undefined)
    .optional(),
  address: z.object({ line: optionalText(240), district: optionalText(80), city: optionalText(80) }).default({}),
  social: z.partialRecord(z.enum(SOCIAL_KEYS), optionalUrl).default({}),
  seo: z.object({ title: optionalText(70), description: optionalText(200) }).default({}),
});
export type SiteInfo = z.infer<typeof siteInfoSchema>;
export type SiteInfoInput = z.input<typeof siteInfoSchema>;

/** Önizleme isteği: manifest + sitenin adı/iletişimi (logo ve gerçek ilanlar yok; örnek içerik) */
export const previewPayloadSchema = z.object({ manifest: siteManifestSchema, info: siteInfoSchema }).strict();
export type PreviewPayload = { manifest: SiteManifest; info: SiteInfoInput };

/** URL güvenli base64 (tarayıcı ve sunucuda aynı; UTF-8) */
export function encodePreviewPayload(payload: PreviewPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePreviewPayload(raw: string | undefined | null): z.infer<typeof previewPayloadSchema> | null {
  if (!raw || raw.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bin = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const parsed = previewPayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Yeni sitenin İLK yapılandırması — TEK kaynak: createSite bunu taslağa yazar ve yayınlar,
 * gerçek önizleme aynısını çizer (önizleme manifesti = kiracı manifesti; PREVIEW testi).
 */
export function initialSiteSections(manifest: unknown, rawInfo: SiteInfoInput) {
  const info = siteInfoSchema.parse(rawInfo);
  const compiled = compileManifest(manifest, parseSiteConfig({}));
  return {
    sections: { ...compiled.design, pages: compiled.content.pages, seo: SECTION_SCHEMAS.seo.parse({ title: info.seo.title, description: info.seo.description }) },
    features: compiled.content.features,
    info,
  };
}
