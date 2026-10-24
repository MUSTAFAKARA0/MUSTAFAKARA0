import { z } from 'zod';
import { WEEKDAYS } from '@/modules/content/hours';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Şirket ayarlarındaki çalışma saatleri. Bir satırdaki gün listesi en fazla 7 öğedir ve
 * haftanın sırasına göre tekilleştirilir: tarayıcı yalnızca işaret kutularından gelen tekil
 * günleri gönderir, ama elle oluşturulan bir istek aynı günü binlerce kez gönderip ayarlar
 * kaydını şişiremez.
 */
export const openingHoursSchema = z
  .array(
    z
      .object({
        days: z
          .array(z.enum(WEEKDAYS))
          .min(1, { error: 'En az bir gün seçin.' })
          .max(WEEKDAYS.length, { error: 'Bir satırda en fazla 7 gün olabilir.' })
          .transform((days) => WEEKDAYS.filter((d) => days.includes(d))),
        opens: z.string().regex(TIME, { error: 'Açılış saatini SS:DD biçiminde girin.' }),
        closes: z.string().regex(TIME, { error: 'Kapanış saatini SS:DD biçiminde girin.' }),
      })
      .refine((h) => h.closes > h.opens, { error: 'Kapanış saati açılıştan sonra olmalıdır.', path: ['closes'] }),
  )
  .max(7, { error: 'En fazla 7 satır eklenebilir.' });
