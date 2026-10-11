'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestFingerprint } from '@/lib/request';
import { getTenantFromRequest } from '@/platform/tenant/tenant';
import { appointmentTimestamp, publicLeadSchema } from '@/modules/crm/validation';
import { notifyNewLead } from '@/modules/notifications/lead';
import { getPropertiesByIds, getPropertyDetailsByIds } from '@/modules/properties/queries';
import type { PropertyCard, PropertyDetail } from '@/modules/properties/types';
import type { Enums, Json } from '@/types/supabase';

export interface LeadFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string>;
  /** Başarısız gönderimde kullanıcının yazdıkları kaybolmasın */
  values?: Record<string, string>;
}

const MIN_FILL_MS = 2500;

const SUCCESS: Record<string, string> = {
  contact: 'Mesajınız alındı. En kısa sürede size dönüş yapacağız.',
  listing: 'Talebiniz alındı. İlanla ilgili en kısa sürede sizi arayacağız.',
  appointment: 'Randevu talebiniz alındı. Uygunluk durumunu teyit etmek için sizinle iletişime geçeceğiz.',
  valuation: 'Değerleme talebiniz alındı. Bilgileri inceleyip sizinle iletişime geçeceğiz.',
};

/**
 * Web sitesi talep formu → müşteri + talep (+ randevu). Kiracı (organizasyon)
 * istemciden gelen bir değerle DEĞİL, isteğin alan adından sunucuda belirlenir.
 * Spam koruması: gizli alan, minimum doldurma süresi, doğrulama ve
 * veritabanında IP özetine göre hız sınırı.
 */
export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === 'string' && !['website', 'elapsed', '$ACTION_ID'].includes(k) && !k.startsWith('$')) values[k] = v.slice(0, 3000);
  }

  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'success', message: SUCCESS.contact };
  }
  const elapsed = Number(formData.get('elapsed') ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return { status: 'error', message: 'Form çok hızlı gönderildi. Lütfen birkaç saniye bekleyip tekrar deneyin.', values };
  }

  const parsed = publicLeadSchema.safeParse({ ...values, kvkk: formData.get('kvkk') === 'on' });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_');
      errors[key] ??= issue.message;
    }
    const visible = ['fullName', 'phone', 'email', 'message', 'appointmentDate', 'appointmentTime', 'valuationLocation', 'valuationM2', 'valuationAge', 'kvkk'];
    const shown = Object.keys(errors).some((k) => visible.includes(k));
    return {
      status: 'error',
      message: shown ? 'Lütfen işaretli alanları kontrol edin.' : 'Form gönderilemedi. Sayfayı yenileyip tekrar deneyin.',
      errors,
      values,
    };
  }

  const tenant = await getTenantFromRequest();
  const supabase = createServiceClient();
  if (!tenant || !supabase) {
    return { status: 'error', message: 'Form şu anda kullanılamıyor. Lütfen telefon veya WhatsApp ile bize ulaşın.', values };
  }

  const d = parsed.data;
  if (d.kind === 'appointment' && !tenant.features.crm) {
    return { status: 'error', message: 'Online randevu şu anda kullanılamıyor. Lütfen bizi arayın.', values };
  }

  const source: Enums<'lead_source'> =
    d.source === 'qr'
      ? 'qr'
      : d.kind === 'appointment'
        ? 'appointment'
        : d.kind === 'listing'
          ? 'listing'
          : d.kind === 'valuation'
            ? 'website'
            : 'contact_form';
  let intent: Enums<'lead_intent'> | undefined = d.kind === 'valuation' ? (d.valuationIntent === 'let' ? 'let' : 'sell') : undefined;
  if (!intent && d.propertyId) {
    // İlan talebinde tür, ilanın satılık/kiralık olmasından türetilir (yalnızca bu ofisin ilanı)
    const { data: property } = await supabase.from('properties').select('listing_type').eq('id', d.propertyId).eq('organization_id', tenant.id).maybeSingle();
    if (property) intent = property.listing_type === 'rent' ? 'rent' : 'buy';
  }
  const details: Record<string, Json> = {};
  if (d.kind === 'valuation') {
    details.valuation = {
      intent: d.valuationIntent ?? null,
      location: d.valuationLocation ?? null,
      gross_m2: d.valuationM2 ?? null,
      rooms: d.valuationRooms ?? null,
      building_age: d.valuationAge ?? null,
      condition: d.valuationCondition ?? null,
    };
  }

  const { ipHash, userAgent } = await getRequestFingerprint();
  const { data: leadId, error } = await supabase.rpc('submit_lead', {
    p_org: tenant.id,
    p_full_name: d.fullName,
    p_phone: d.phone ?? '',
    p_email: d.email ?? '',
    p_message: d.message ?? '',
    // PostgREST fonksiyonu tüm parametrelerle eşleştirir: boş değerler null olarak gönderilir
    p_property_id: (d.propertyId ?? null) as unknown as string,
    p_source: source,
    p_intent: (intent ?? null) as unknown as Enums<'lead_intent'>,
    p_details: details,
    p_appointment_at:
      d.kind === 'appointment' && d.appointmentDate && d.appointmentTime
        ? appointmentTimestamp(d.appointmentDate, d.appointmentTime)
        : (null as unknown as string),
    p_kvkk_consent: true,
    p_ip_hash: ipHash,
    p_user_agent: userAgent,
  });

  if (error) {
    if (error.message === 'rate_limited') {
      return {
        status: 'error',
        message: 'Kısa süre içinde çok sayıda talep gönderdiniz. Lütfen daha sonra tekrar deneyin veya bizi arayın.',
        values,
      };
    }
    if (error.message === 'invalid_appointment_time') {
      return {
        status: 'error',
        message: 'Randevu için en az 1 saat sonrası ve en fazla 120 gün içinde bir zaman seçin.',
        errors: { appointmentDate: 'Geçerli bir tarih seçin.' },
        values,
      };
    }
    console.error('[submitLead] rpc failed', error.code);
    return { status: 'error', message: 'Talebiniz gönderilemedi. Lütfen tekrar deneyin veya bizi arayın.', values };
  }

  revalidatePath('/admin', 'layout');
  // Ofise e-posta bildirimi yanıt gönderildikten sonra yapılır; ziyaretçiyi bekletmez
  if (leadId) after(() => notifyNewLead(tenant, leadId));
  return { status: 'success', message: SUCCESS[d.kind] };
}

/** Tarayıcıda tutulan favori / karşılaştırma kimlikleri için ilan kartları */
export async function getPublicCards(ids: unknown): Promise<{ ok: true; items: PropertyCard[] } | { ok: false }> {
  if (!Array.isArray(ids)) return { ok: true, items: [] };
  try {
    const tenant = await getTenantFromRequest();
    if (!tenant) return { ok: false };
    const items = await getPropertiesByIds(tenant.id, ids.filter((x): x is string => typeof x === 'string').slice(0, 100));
    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}

/** Karşılaştırma tablosu için ayrıntılı bilgiler (en fazla 4 ilan) */
export async function getCompareDetails(ids: unknown): Promise<{ ok: true; items: PropertyDetail[] } | { ok: false }> {
  if (!Array.isArray(ids)) return { ok: true, items: [] };
  try {
    const tenant = await getTenantFromRequest();
    if (!tenant) return { ok: false };
    const items = await getPropertyDetailsByIds(tenant.id, ids.filter((x): x is string => typeof x === 'string').slice(0, 4));
    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}
