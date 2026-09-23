'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestFingerprint } from '@/lib/request';
import { contactSchema } from '@/lib/validation/contact';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/common';

export interface ContactFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: FieldErrors;
  /** Başarısız gönderimde kullanıcının yazdıkları kaybolmasın */
  values?: Record<string, string>;
}

const MIN_FILL_MS = 2500;

export async function submitContactForm(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const raw = {
    fullName: String(formData.get('fullName') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    message: String(formData.get('message') ?? ''),
    propertyId: String(formData.get('propertyId') ?? ''),
  };
  const values = {
    fullName: raw.fullName,
    phone: raw.phone,
    email: raw.email,
    message: raw.message,
    kvkk: formData.get('kvkk') === 'on' ? 'on' : '',
  };

  // Spam koruması 1: gizli "website" alanı insanlar tarafından doldurulmaz
  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'success', message: 'Mesajınız alındı. En kısa sürede size dönüş yapacağız.' };
  }
  // Spam koruması 2: form, açıldıktan birkaç saniye içinde gönderilemez
  const elapsed = Number(formData.get('elapsed') ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return {
      status: 'error',
      message: 'Form çok hızlı gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.',
      values,
    };
  }

  const parsed = contactSchema.safeParse({ ...raw, kvkk: formData.get('kvkk') === 'on' });
  if (!parsed.success) {
    return { status: 'error', message: 'Lütfen işaretli alanları kontrol edin.', errors: toFieldErrors(parsed.error), values };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return {
      status: 'error',
      message: 'İletişim formu şu anda kullanılamıyor. Lütfen telefon veya WhatsApp ile bize ulaşın.',
      values,
    };
  }

  const { ipHash, userAgent } = await getRequestFingerprint();
  const d = parsed.data;
  const { error } = await supabase.rpc('submit_contact_request', {
    p_full_name: d.fullName,
    p_phone: d.phone,
    p_email: d.email,
    p_message: d.message,
    p_property_id: d.propertyId,
    p_source: d.propertyId ? 'property_detail' : 'contact_page',
    p_kvkk_consent: true,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  });

  if (error) {
    if (error.message.includes('rate_limited')) {
      return {
        status: 'error',
        message: 'Kısa süre içinde çok sayıda mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin veya bizi arayın.',
        values,
      };
    }
    return {
      status: 'error',
      message: 'Mesajınız gönderilirken bir hata oluştu. Lütfen tekrar deneyin.',
      values,
    };
  }

  revalidatePath('/admin', 'layout');
  return { status: 'success', message: 'Mesajınız alındı. En kısa sürede size dönüş yapacağız.' };
}
