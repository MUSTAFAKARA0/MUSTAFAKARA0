'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestFingerprint } from '@/lib/request';
import { notifyPlatformLead } from '@/modules/karay/notify';

export interface KarayLeadState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

const MIN_FILL_MS = 2500;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `En fazla ${max} karakter.` })
    .transform((v) => (v === '' ? undefined : v));

const schema = z
  .object({
    kind: z.enum(['info', 'demo']).default('info'),
    fullName: z.string().trim().min(2, { message: 'Adınızı ve soyadınızı yazın.' }).max(120),
    email: z
      .string()
      .trim()
      .max(160)
      .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Geçerli bir e-posta adresi yazın.' })
      .transform((v) => (v === '' ? undefined : v.toLowerCase())),
    phone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v === '' || /^[+0-9 ()-]{7,30}$/.test(v), { message: 'Geçerli bir telefon numarası yazın.' })
      .transform((v) => (v === '' ? undefined : v)),
    company: optional(160),
    city: optional(80),
    message: optional(3000),
    kvkk: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın.' }),
  })
  .refine((d) => d.email || d.phone, { message: 'E-posta veya telefon bilgilerinden en az birini yazın.', path: ['email'] });

/**
 * KARAY "Bilgi al / Demo talep et" formu. KARAY'ın kendi talep tablosuna (platform_leads)
 * yazılır; hiçbir kiracının (emlak ofisinin) CRM'ine, talebine veya müşteri listesine
 * DÜŞMEZ. Alan adından kiracı çözülmez, istemciden kiracı kimliği alınmaz.
 * Spam koruması: gizli alan, en kısa doldurma süresi, doğrulama, veritabanında IP özetine
 * göre ve genel hız sınırı.
 */
export async function submitKarayLead(_prev: KarayLeadState, formData: FormData): Promise<KarayLeadState> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string' && !['website', 'elapsed', 'kind-choice'].includes(k) && !k.startsWith('$')) values[k] = v.slice(0, 3000);
  }
  // Gizli alanı dolduran bot: başarılı gibi yanıt verilir, kayıt yapılmaz
  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'success', message: 'Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.' };
  }
  const elapsed = Number(formData.get('elapsed') ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return { status: 'error', message: 'Form çok hızlı gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.', values };
  }
  const parsed = schema.safeParse({ ...values, kvkk: formData.get('kvkk') === 'on' });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? '_')] ??= issue.message;
    return { status: 'error', message: 'Lütfen işaretli alanları kontrol edin.', errors, values };
  }
  const service = createServiceClient();
  if (!service) return { status: 'error', message: 'Form şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.', values };

  const d = parsed.data;
  const { ipHash, userAgent } = await getRequestFingerprint();
  const { data: id, error } = await service.rpc('submit_platform_lead', {
    p_kind: d.kind,
    p_full_name: d.fullName,
    p_email: d.email ?? '',
    p_phone: d.phone ?? '',
    p_company: d.company ?? '',
    p_city: d.city ?? '',
    p_message: d.message ?? '',
    p_kvkk_consent: true,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  });
  if (error) {
    if (error.message === 'rate_limited') {
      return { status: 'error', message: 'Kısa süre içinde çok sayıda talep gönderildi. Lütfen daha sonra tekrar deneyin.', values };
    }
    console.error('[submitKarayLead] rpc failed', error.code);
    return { status: 'error', message: 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.', values };
  }
  revalidatePath('/platform', 'layout');
  if (id) after(() => notifyPlatformLead(id as string));
  return {
    status: 'success',
    message: d.kind === 'demo' ? 'Demo talebiniz alındı. Uygun bir zaman için sizinle iletişime geçeceğiz.' : 'Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.',
  };
}
