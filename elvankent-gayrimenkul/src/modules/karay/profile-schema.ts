import { z } from 'zod';
import { BIDI_CONTROL_MESSAGE, hasBidiControl, singleLine } from '@/lib/single-line';

/**
 * KARAYS kurumsal ayarları (platform_settings) doğrulaması. Sunucu eylemi (`updateKarayProfile`)
 * bu şemayı kullanır; ayrı modülde durması davranışın birim testiyle doğrulanmasını sağlar.
 */

/**
 * Şirket adı tek satırdır (site alt bilgisi, JSON-LD, operasyon betikleri). Kontrol karakteri ve
 * satır sonu boşluğa çevrilir. Yön denetim karakteri ve `<` `>` sessizce silinmez, açık hata
 * verilir: bugünkü kullanım noktaları kaçışlıdır (React metni, JSON-LD `\u003c`, SQL
 * quote_literal), bu kontrol ileride ham HTML'de (ör. e-posta) kullanılırsa diye ek katmandır.
 */
export const companyNameSchema = z
  .string()
  .max(160, { message: 'Şirket adı en fazla 80 karakter olabilir.' })
  .transform(singleLine)
  .pipe(
    z
      .string()
      .min(2, { message: 'Şirket adı en az 2 karakter olmalıdır.' })
      .max(80, { message: 'Şirket adı en fazla 80 karakter olabilir.' })
      .refine((v) => !/[<>]/.test(v), { message: 'Şirket adında < ve > karakterleri kullanılamaz.' })
      .refine((v) => !hasBidiControl(v), { message: `Şirket adı ${BIDI_CONTROL_MESSAGE}` }),
  );

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), { message: 'Bağlantı https:// ile başlamalıdır.' })
  .transform((v) => (v === '' ? null : v));
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v.replace(/[<>]/g, '')));

export const profileSchema = z.object({
  company_name: companyNameSchema,
  tagline: text(160),
  contact_email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Geçerli bir e-posta adresi yazın.' })
    .transform((v) => (v === '' ? null : v.toLowerCase())),
  contact_phone: text(30),
  whatsapp: text(30),
  address: text(240),
  city: text(80),
  website_url: url,
  linkedin_url: url,
  instagram_url: url,
  x_url: url,
  youtube_url: url,
  seo_title: text(70),
  seo_description: text(200),
  indexable: z.boolean(),
  lead_notify_emails: z
    .string()
    .max(900)
    .transform((v) =>
      v
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
    .refine((list) => list.length <= 5, { message: 'En fazla 5 bildirim adresi girilebilir.' })
    .refine((list) => list.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)), { message: 'Bildirim adreslerinden biri geçerli değil.' }),
});
export type KarayProfileInput = z.input<typeof profileSchema>;
