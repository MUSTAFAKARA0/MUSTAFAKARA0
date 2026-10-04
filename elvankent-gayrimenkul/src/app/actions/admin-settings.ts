'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { bulkPropertyAction } from '@/app/actions/admin-properties';
import { cacheTags } from '@/lib/cache-tags';
import { createServiceClient } from '@/lib/supabase/server';
import { WEEKDAYS } from '@/modules/content/hours';
import { emailField, phoneField } from '@/modules/crm/validation';
import { BRANDING_COLUMN, BRANDING_KINDS, BRANDING_LABEL, BRANDING_PERMISSION, isOwnBrandingPath, type BrandingKind } from '@/modules/media/branding';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import { isEmailConfigured, sendEmail } from '@/modules/notifications/email';
import { leadNotificationRecipients } from '@/modules/notifications/lead';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission } from '@/platform/auth/session';
import type { BrandDraft } from '@/site-config/schema';
import { DRAFT_BRANDING_KINDS, removeBrandingDraft } from '@/site-editor/branding';
import { saveBrandFields } from '@/site-editor/service';
import type { TablesUpdate } from '@/types/supabase';

/**
 * Marka görselini kaldırır. Logo, mobil logo, site simgesi ve ana sayfa görseli TASLAKTA kaldırılır
 * (P0.2: canlı site yayına kadar görseli göstermeye devam eder; dosya silinmez). Paylaşım görseli
 * SEO modülüne aittir (seo.manage) ve anında kaldırılır.
 */
export async function removeBrandingImage(kind: BrandingKind): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!BRANDING_KINDS.includes(kind)) throw new ActionError('Geçersiz görsel türü.');
    const ctx = await requirePermission(BRANDING_PERMISSION[kind]);
    if (DRAFT_BRANDING_KINDS.includes(kind)) {
      await removeBrandingDraft(ctx.supabase, ctx.org.id, kind);
      revalidatePath('/admin', 'layout');
      return null;
    }
    const column = BRANDING_COLUMN[kind];
    const { data: before } = await ctx.supabase.from('organization_settings').select(column).eq('organization_id', ctx.org.id).maybeSingle();
    const { error } = await ctx.supabase
      .from('organization_settings')
      .update({ [column]: null } as TablesUpdate<'organization_settings'>)
      .eq('organization_id', ctx.org.id);
    assertNoDbError(error);
    const previous = (before as Record<string, string | null> | null)?.[column];
    if (isOwnBrandingPath(ctx.org.id, previous)) {
      const storage = ctx.can('settings.manage') ? ctx.supabase : createServiceClient();
      await storage?.storage.from(MEDIA_BUCKETS.branding).remove([previous]);
    }
    updateTag(cacheTags.org(ctx.org.id));
    return null;
  }, DRAFT_BRANDING_KINDS.includes(kind) ? `${BRANDING_LABEL[kind] ?? 'Görsel'} taslakta kaldırıldı. Sitede yayınlayınca kalkar.` : `${BRANDING_LABEL[kind] ?? 'Görsel'} kaldırıldı.`);
}

// -----------------------------------------------------------------------------
// Şirket ayarları (white-label): marka, iletişim, adres, saatler, sosyal medya
// -----------------------------------------------------------------------------
const clean = (v: string) => v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const text = (max: number, label: string, min = 0) =>
  z
    .string()
    .max(max * 2, { error: `${label} en fazla ${max} karakter olabilir.` })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, { error: `${label} en az ${min} karakter olmalıdır.` })
        .max(max, { error: `${label} en fazla ${max} karakter olabilir.` }),
    );

const optional = (max: number, label: string) =>
  text(max, label)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const hexColor = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { error: 'Renk #RRGGBB biçiminde olmalıdır.' });

const httpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, { error: `${label} adresi çok uzun.` })
    .refine((v) => v === '' || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s<>"']*)?$/i.test(v), { error: `${label} için https:// ile başlayan geçerli bir adres girin.` })
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const coordinate = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), { error: 'Geçersiz koordinat.' })
    .transform((v) => (v === null ? null : Math.round(v * 1e6) / 1e6));

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const hoursSchema = z
  .array(
    z
      .object({
        days: z.array(z.enum(WEEKDAYS)).min(1, { error: 'En az bir gün seçin.' }),
        opens: z.string().regex(TIME, { error: 'Açılış saatini SS:DD biçiminde girin.' }),
        closes: z.string().regex(TIME, { error: 'Kapanış saatini SS:DD biçiminde girin.' }),
      })
      .refine((h) => h.closes > h.opens, { error: 'Kapanış saati açılıştan sonra olmalıdır.', path: ['closes'] }),
  )
  .max(7, { error: 'En fazla 7 satır eklenebilir.' });

const companySchema = z
  .object({
    display_name: text(80, 'Şirket adı', 2),
    legal_name: optional(160, 'Ticari unvan'),
    tagline: optional(160, 'Slogan'),
    description: optional(2000, 'Tanıtım metni'),
    service_area: optional(160, 'Hizmet bölgesi'),
    primary_color: hexColor,
    accent_color: hexColor,
    phone: phoneField.nullable(),
    whatsapp: phoneField.nullable(),
    email: emailField.nullable(),
    address_line: optional(240, 'Adres'),
    address_district: optional(80, 'İlçe'),
    address_city: optional(80, 'İl'),
    postal_code: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[0-9]{5}$/.test(v), { error: 'Posta kodu 5 haneli olmalıdır.' })
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    office_latitude: coordinate(-90, 90),
    office_longitude: coordinate(-180, 180),
    opening_hours: hoursSchema,
    working_hours_note: optional(300, 'Çalışma saatleri notu'),
    instagram_url: httpsUrl('Instagram'),
    facebook_url: httpsUrl('Facebook'),
    x_url: httpsUrl('X'),
    youtube_url: httpsUrl('YouTube'),
    linkedin_url: httpsUrl('LinkedIn'),
    tiktok_url: httpsUrl('TikTok'),
  })
  .refine((v) => (v.office_latitude === null) === (v.office_longitude === null), {
    error: 'Ofis konumu için enlem ve boylamı birlikte girin.',
    path: ['office_latitude'],
  });

export type CompanySettingsInput = z.input<typeof companySchema>;

/**
 * Şirket ayarları (marka, iletişim, adres, konum, saatler, sosyal medya) — P0.2: TASLAĞA yazılır.
 * Ortak çekirdek saveBrandFields (KARAY ve /admin/site ile aynı); canlı site "Yayınla" ile değişir,
 * önizlemede hemen görünür, sürüm geçmişinden geri alınabilir. Organizasyon oturumdan gelir.
 */
export async function saveCompanySettings(raw: CompanySettingsInput, expected?: string | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    const input = companySchema.parse(raw);
    const values: BrandDraft = {
      display_name: input.display_name,
      legal_name: input.legal_name ?? null,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      service_area: input.service_area ?? null,
      primary_color: input.primary_color,
      accent_color: input.accent_color,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      address_line: input.address_line ?? null,
      address_district: input.address_district ?? null,
      address_city: input.address_city ?? null,
      postal_code: input.postal_code ?? null,
      office_latitude: input.office_latitude,
      office_longitude: input.office_longitude,
      opening_hours: input.opening_hours,
      working_hours_note: input.working_hours_note ?? null,
      instagram_url: input.instagram_url ?? null,
      facebook_url: input.facebook_url ?? null,
      x_url: input.x_url ?? null,
      youtube_url: input.youtube_url ?? null,
      linkedin_url: input.linkedin_url ?? null,
      tiktok_url: input.tiktok_url ?? null,
    };
    await saveBrandFields(ctx.supabase, ctx.org.id, values, expected);
    revalidatePath('/admin', 'layout');
    return null;
  }, 'Taslağa kaydedildi. Sitede görünmesi için "Yayınla"ya basın.');
}

// -----------------------------------------------------------------------------
// Site ayarları: ana sayfa metinleri ve ilan varsayılanları
// -----------------------------------------------------------------------------
const siteSchema = z.object({
  hero_title: optional(120, 'Ana başlık'),
  hero_subtitle: optional(240, 'Alt başlık'),
  default_location_precision: z.enum(['exact', 'approximate', 'neighborhood'], { error: 'Geçersiz konum gösterimi.' }),
});

export type SiteSettingsInput = z.input<typeof siteSchema>;

/**
 * Ana sayfa metinleri TASLAĞA (P0.2; ziyaretçinin gördüğü içerik), ilan konum gösterimi varsayılanı
 * ise ilan davranışı ayarıdır ve anında kaydedilir (site içeriği değil, ilan verisi politikası).
 */
export async function saveSiteSettings(raw: SiteSettingsInput, expected?: string | null): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    const input = siteSchema.parse(raw);
    await saveBrandFields(ctx.supabase, ctx.org.id, { hero_title: input.hero_title ?? null, hero_subtitle: input.hero_subtitle ?? null }, expected);
    const { data, error } = await ctx.supabase
      .from('organization_settings')
      .update({ default_location_precision: input.default_location_precision })
      .eq('organization_id', ctx.org.id)
      .select('organization_id');
    assertNoDbError(error);
    if (!data?.length) throw new ActionError('Ayarlar bulunamadı.');
    updateTag(cacheTags.org(ctx.org.id));
    revalidatePath('/admin', 'layout');
    return null;
  }, 'Ana sayfa metinleri taslağa kaydedildi; yayınlayınca sitede görünür. İlan ayarı kaydedildi.');
}

/**
 * DEMO olarak işaretli örnek ilanları çöp kutusuna taşır (geri alınabilir;
 * kalıcı silme İlanlar › Çöp kutusu üzerinden yapılır).
 */
export async function trashDemoListings(): Promise<ActionResult<{ done: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission('properties.delete');
    const { data, error } = await ctx.supabase
      .from('properties')
      .select('id')
      .eq('organization_id', ctx.org.id)
      .eq('is_demo', true)
      .is('deleted_at', null)
      .limit(100);
    assertNoDbError(error);
    const ids = (data ?? []).map((r) => r.id);
    if (!ids.length) return { done: 0 };
    const res = await bulkPropertyAction(ids, 'delete');
    if (!res.ok) throw new ActionError(res.error, res.code);
    if (res.data.failed.length) throw new ActionError(`${res.data.done} demo ilan taşındı; ${res.data.failed.length} ilan taşınamadı.`);
    return { done: res.data.done };
  }, 'Demo ilanlar çöp kutusuna taşındı.');
}


// -----------------------------------------------------------------------------
// Talep bildirimleri: alıcılar, açma/kapama ve test e-postası
// -----------------------------------------------------------------------------
const notificationSchema = z.object({
  notify_new_lead: z.boolean(),
  emails: z
    .array(z.string().trim().toLowerCase().max(160))
    .max(5, { error: 'En fazla 5 e-posta adresi ekleyebilirsiniz.' })
    .transform((list) => [...new Set(list.filter(Boolean))])
    .refine((list) => list.every((e) => z.email().safeParse(e).success), { error: 'Geçerli e-posta adresleri girin.' }),
});

export type NotificationSettingsInput = z.input<typeof notificationSchema>;

export async function saveNotificationSettings(raw: NotificationSettingsInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    const input = notificationSchema.parse(raw);
    const { error } = await ctx.supabase.from('organization_notification_settings').upsert(
      {
        organization_id: ctx.org.id,
        notify_new_lead: input.notify_new_lead,
        emails: input.emails,
        updated_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' },
    );
    assertNoDbError(error);
    return null;
  }, 'Bildirim ayarları kaydedildi.');
}

/** Ayarlanan alıcılara test e-postası gönderir (dakikada en fazla 1). */
export async function sendTestNotification(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    const db = createServiceClient();
    if (!db) throw new ActionError('Sunucu yapılandırması eksik.');
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from('notification_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.org.id)
      .eq('event', 'test')
      .gte('created_at', since);
    if ((count ?? 0) > 0) throw new ActionError('Bir dakika içinde yalnızca bir test e-postası gönderilebilir.');

    const { emails } = await leadNotificationRecipients(ctx.org.id);
    if (emails.length === 0) throw new ActionError('Önce bildirim alacak bir e-posta adresi kaydedin.');
    if (!isEmailConfigured()) throw new ActionError('E-posta gönderimi yapılandırılmamış (EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM).');

    const result = await sendEmail({
      to: emails,
      subject: `Test bildirimi · ${ctx.org.name}`,
      text: `Bu bir test e-postasıdır. Yeni web talepleri bu adreslere bildirilecek.\n\n— ${ctx.org.name}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:14px">Bu bir test e-postasıdır. Yeni web talepleri bu adreslere bildirilecek.</p><p style="font-family:Arial,sans-serif;font-size:12px;color:#666">${ctx.org.name.replace(/[<>&]/g, '')}</p>`,
    });
    await db.from('notification_deliveries').insert({
      organization_id: ctx.org.id,
      channel: 'email',
      event: 'test',
      recipients: emails,
      status: result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed',
      provider: result.provider,
      provider_message_id: result.ok ? result.id : null,
      error: result.ok ? null : result.error.slice(0, 300),
    });
    if (!result.ok) throw new ActionError('Test e-postası gönderilemedi. Sağlayıcı ayarlarını ve gönderici alan adı doğrulamasını kontrol edin.');
    return null;
  }, 'Test e-postası gönderildi.');
}
