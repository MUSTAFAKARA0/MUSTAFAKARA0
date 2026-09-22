import { z } from 'zod';
import { emailSchema, phoneSchema, text } from './common';

export const contactSchema = z
  .object({
    fullName: text(2, 100, 'Ad soyad'),
    phone: phoneSchema,
    email: emailSchema,
    message: text(5, 3000, 'Mesaj'),
    propertyId: z
      .string()
      .optional()
      .nullable()
      .transform((v) => v || null)
      .refine((v) => v === null || z.uuid().safeParse(v).success, { error: 'Geçersiz ilan.' }),
    kvkk: z.literal(true, { error: 'Devam etmek için KVKK aydınlatma metnini onaylamanız gerekir.' }),
  })
  .refine((d) => d.phone || d.email, {
    error: 'Size ulaşabilmemiz için telefon veya e-posta bilgisinden en az birini girin.',
    path: ['phone'],
  });

export type ContactInput = z.infer<typeof contactSchema>;
