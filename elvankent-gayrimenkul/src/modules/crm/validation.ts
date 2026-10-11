import { z } from 'zod';
import { VALUATION_CONDITIONS } from '@/modules/crm/constants';

const PHONE = /^[+0-9()\s-]{10,20}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `En fazla ${max} karakter olabilir.` })
    .optional()
    .transform((v) => (v ? v : undefined));

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || (PHONE.test(v) && v.replace(/\D/g, '').length >= 10), {
    error: 'Geçerli bir telefon numarası girin (ör. 0532 123 45 67).',
  });

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || z.email().safeParse(v).success, { error: 'Geçerli bir e-posta adresi girin.' });

/** Web sitesindeki tüm talep formları (iletişim, ilan, randevu, değerleme) */
export const publicLeadSchema = z
  .object({
    kind: z.enum(['contact', 'listing', 'appointment', 'valuation']),
    fullName: z.string().trim().min(2, { error: 'Adınızı ve soyadınızı yazın.' }).max(100, { error: 'Ad soyad çok uzun.' }),
    phone: phoneField,
    email: emailField,
    message: optionalText(3000),
    propertyId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
    // Gizli alan: QR ile gelen ziyaretçide 'qr', aksi halde boş gönderilir
    source: z.enum(['website', 'qr', 'listing', 'contact_form']).optional().or(z.literal('').transform(() => undefined)),
    appointmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    appointmentTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    valuationIntent: z.enum(['sell', 'let']).optional().or(z.literal('').transform(() => undefined)),
    valuationLocation: optionalText(160),
    valuationM2: z.coerce.number().int().min(10).max(1_000_000).optional().or(z.literal('').transform(() => undefined)),
    valuationRooms: optionalText(10),
    valuationAge: z.coerce.number().int().min(0).max(200).optional().or(z.literal('').transform(() => undefined)),
    valuationCondition: z.enum(VALUATION_CONDITIONS.map((c) => c.value) as [string, ...string[]]).optional().or(z.literal('').transform(() => undefined)),
    kvkk: z.literal(true, { error: 'Devam etmek için KVKK aydınlatma metnini onaylayın.' }),
  })
  .superRefine((d, ctx) => {
    if (!d.phone && !d.email) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Size ulaşabilmemiz için telefon veya e-posta girin.' });
    }
    if (d.kind === 'contact' && (!d.message || d.message.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Mesajınızı yazın (en az 5 karakter).' });
    }
    if (d.kind === 'appointment') {
      if (!d.appointmentDate) ctx.addIssue({ code: 'custom', path: ['appointmentDate'], message: 'Bir tarih seçin.' });
      if (!d.appointmentTime) ctx.addIssue({ code: 'custom', path: ['appointmentTime'], message: 'Bir saat seçin.' });
    }
    if (d.kind === 'valuation' && !d.valuationLocation) {
      ctx.addIssue({ code: 'custom', path: ['valuationLocation'], message: 'Gayrimenkulün konumunu yazın (mahalle / ilçe).' });
    }
  });

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

/** Türkiye saati (UTC+3, yaz saati uygulaması yok) ile randevu zamanı */
export function appointmentTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}
