'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isUuid } from '@/lib/utils';
import { emailField, phoneField } from '@/modules/crm/validation';
import { ActionError, assertNoDbError, NotFoundError, runAction, type ActionResult } from '@/platform/actions';
import { requireFeature, requirePermission, type OrgContext } from '@/platform/auth/session';

const LEAD_STATUSES = ['new', 'contacted', 'meeting', 'appointment', 'follow_up', 'closed', 'cancelled'] as const;
const LEAD_INTENTS = ['buy', 'rent', 'sell', 'let', 'valuation', 'other'] as const;
const LEAD_SOURCES = ['website', 'whatsapp', 'phone', 'listing', 'contact_form', 'appointment', 'manual', 'qr'] as const;
const ACTIVITY_KINDS = ['note', 'call', 'whatsapp', 'email', 'meeting'] as const;
const APPOINTMENT_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'] as const;

const clean = (v: string) => v.replace(/[<>]/g, '').trim();
const optionalText = (max: number) =>
  z
    .string()
    .max(max, { error: `En fazla ${max} karakter olabilir.` })
    .transform((v) => (clean(v) === '' ? null : clean(v)))
    .nullable()
    .optional();

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

async function assertOwned(ctx: OrgContext, table: 'leads' | 'customers' | 'appointments' | 'collections', id: string) {
  if (!isUuid(id)) throw new NotFoundError();
  const { data, error } = await ctx.supabase.from(table).select('id, organization_id').eq('id', id).maybeSingle();
  assertNoDbError(error);
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError();
}

async function assertMember(ctx: OrgContext, userId: string | null | undefined) {
  if (!userId) return;
  const { data } = await ctx.supabase.rpc('list_org_members', { p_org: ctx.org.id });
  if (!(data ?? []).some((m) => m.user_id === userId && m.status === 'active')) {
    throw new ActionError('Seçilen kişi bu ofisin aktif bir üyesi değil.');
  }
}

async function assertProperty(ctx: OrgContext, propertyId: string | null | undefined) {
  if (!propertyId) return;
  const { data } = await ctx.supabase.from('properties').select('organization_id').eq('id', propertyId).maybeSingle();
  if (!data || data.organization_id !== ctx.org.id) throw new ActionError('Seçilen ilan bu ofise ait değil.');
}

// -----------------------------------------------------------------------------
// Müşteriler
// -----------------------------------------------------------------------------
const customerSchema = z
  .object({
    full_name: z.string().trim().min(2, { error: 'Ad soyad en az 2 karakter olmalıdır.' }).max(100).transform(clean),
    phone: phoneField.nullable().optional(),
    email: emailField.nullable().optional(),
    notes: optionalText(4000),
  })
  .refine((v) => Boolean(v.phone || v.email), { error: 'Telefon veya e-posta alanlarından en az biri gerekli.', path: ['phone'] });

export type CustomerInput = z.input<typeof customerSchema>;

/** Aynı telefon (son 10 hane) veya e-posta ile kayıtlı müşteri varsa onu döndürür */
async function findCustomer(ctx: OrgContext, phone: string | null | undefined, email: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    const { data } = await ctx.supabase.from('customers').select('id').eq('organization_id', ctx.org.id).eq('phone_key', digits).is('deleted_at', null).maybeSingle();
    if (data) return data.id;
  }
  if (email) {
    const { data } = await ctx.supabase.from('customers').select('id').eq('organization_id', ctx.org.id).ilike('email', email).is('deleted_at', null).limit(1).maybeSingle();
    if (data) return data.id;
  }
  return null;
}

export async function saveCustomer(id: string | null, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission(id ? 'leads.update' : 'leads.create');
    requireFeature(ctx, 'crm');
    const data = customerSchema.parse(input);
    if (id) {
      await assertOwned(ctx, 'customers', id);
      const { error } = await ctx.supabase.from('customers').update(data).eq('id', id);
      assertNoDbError(error);
      refresh('/admin/musteriler', `/admin/musteriler/${id}`);
      return { id };
    }
    const existing = await findCustomer(ctx, data.phone, data.email);
    if (existing) throw new ActionError('Bu telefon veya e-posta ile kayıtlı bir müşteri zaten var.', 'duplicate');
    const { data: created, error } = await ctx.supabase
      .from('customers')
      .insert({ ...data, organization_id: ctx.org.id, source: 'manual', created_by: ctx.user.id })
      .select('id')
      .single();
    assertNoDbError(error);
    if (!created) throw new ActionError('Müşteri kaydedilemedi.');
    refresh('/admin/musteriler');
    return { id: created.id };
  }, 'Müşteri kaydedildi.');
}

export async function setCustomerDeleted(id: string, deleted: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('leads.delete');
    await assertOwned(ctx, 'customers', id);
    const { error } = await ctx.supabase.from('customers').update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id);
    assertNoDbError(error);
    refresh('/admin/musteriler');
    return null;
  }, deleted ? 'Müşteri silindi.' : 'Müşteri geri yüklendi.');
}

// -----------------------------------------------------------------------------
// Talepler (leads)
// -----------------------------------------------------------------------------
const manualLeadSchema = z.object({
  customer_id: z.uuid().nullable().optional(),
  full_name: z.string().trim().max(100).optional(),
  phone: phoneField.nullable().optional(),
  email: emailField.nullable().optional(),
  property_id: z.uuid().nullable().optional(),
  source: z.enum(LEAD_SOURCES).default('manual'),
  intent: z.enum(LEAD_INTENTS).default('buy'),
  message: optionalText(3000),
  budget_min: z.number().min(0).max(999_999_999_999).nullable().optional(),
  budget_max: z.number().min(0).max(999_999_999_999).nullable().optional(),
  desired_location: optionalText(160),
  assigned_to: z.uuid().nullable().optional(),
});

export type ManualLeadInput = z.input<typeof manualLeadSchema>;

export async function createManualLead(input: ManualLeadInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('leads.create');
    const data = manualLeadSchema.parse(input);
    await assertProperty(ctx, data.property_id);
    await assertMember(ctx, data.assigned_to);

    let customerId = data.customer_id ?? null;
    if (customerId) {
      await assertOwned(ctx, 'customers', customerId);
    } else {
      if (!data.full_name || data.full_name.length < 2) throw new ActionError('Müşteri adı gerekli.', 'validation', { full_name: ['Ad soyad en az 2 karakter olmalıdır.'] });
      if (!data.phone && !data.email) throw new ActionError('Telefon veya e-posta gerekli.', 'validation', { phone: ['Telefon veya e-posta girin.'] });
      customerId = await findCustomer(ctx, data.phone, data.email);
      if (!customerId) {
        const { data: created, error } = await ctx.supabase
          .from('customers')
          .insert({ organization_id: ctx.org.id, full_name: clean(data.full_name), phone: data.phone ?? null, email: data.email ?? null, source: data.source, created_by: ctx.user.id })
          .select('id')
          .single();
        assertNoDbError(error);
        customerId = created?.id ?? null;
      }
    }
    if (!customerId) throw new ActionError('Müşteri kaydedilemedi.');

    const { data: lead, error } = await ctx.supabase
      .from('leads')
      .insert({
        organization_id: ctx.org.id,
        customer_id: customerId,
        property_id: data.property_id ?? null,
        source: data.source,
        intent: data.intent,
        message: data.message ?? null,
        budget_min: data.budget_min ?? null,
        budget_max: data.budget_max ?? null,
        desired_location: data.desired_location ?? null,
        assigned_to: data.assigned_to ?? null,
        created_by: ctx.user.id,
      })
      .select('id')
      .single();
    assertNoDbError(error);
    if (!lead) throw new ActionError('Talep kaydedilemedi.');
    refresh('/admin/talepler', '/admin');
    return { id: lead.id };
  }, 'Talep oluşturuldu.');
}

const leadUpdateSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    intent: z.enum(LEAD_INTENTS),
    assigned_to: z.uuid().nullable(),
    next_follow_up_at: z.iso.datetime({ offset: true }).nullable(),
    budget_min: z.number().min(0).max(999_999_999_999).nullable(),
    budget_max: z.number().min(0).max(999_999_999_999).nullable(),
    desired_location: optionalText(160),
    property_id: z.uuid().nullable(),
  })
  .partial()
  .strict();

export async function updateLead(id: string, input: z.input<typeof leadUpdateSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('leads.update');
    await assertOwned(ctx, 'leads', id);
    const data = leadUpdateSchema.parse(input);
    if ('assigned_to' in data) await assertMember(ctx, data.assigned_to);
    if ('property_id' in data) await assertProperty(ctx, data.property_id);
    const { error } = await ctx.supabase.from('leads').update(data).eq('id', id);
    assertNoDbError(error);
    refresh('/admin/talepler', `/admin/talepler/${id}`, '/admin');
    return null;
  }, 'Talep güncellendi.');
}

export async function addLeadActivity(leadId: string, kind: (typeof ACTIVITY_KINDS)[number], body: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('leads.update');
    await assertOwned(ctx, 'leads', leadId);
    const k = z.enum(ACTIVITY_KINDS).parse(kind);
    const text = z.string().trim().min(1, { error: 'Not boş olamaz.' }).max(4000, { error: 'Not en fazla 4000 karakter olabilir.' }).parse(body);
    const { error } = await ctx.supabase
      .from('lead_activities')
      .insert({ organization_id: ctx.org.id, lead_id: leadId, kind: k, body: clean(text), created_by: ctx.user.id });
    assertNoDbError(error);
    // İlk temas: "Yeni" durumundaki talep otomatik "İletişime geçildi" olur
    if (k !== 'note') await ctx.supabase.from('leads').update({ status: 'contacted' }).eq('id', leadId).eq('status', 'new');
    refresh(`/admin/talepler/${leadId}`);
    return null;
  }, 'Kayıt eklendi.');
}

export async function setLeadDeleted(id: string, deleted: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('leads.delete');
    await assertOwned(ctx, 'leads', id);
    const { error } = await ctx.supabase.from('leads').update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id);
    assertNoDbError(error);
    refresh('/admin/talepler', '/admin');
    return null;
  }, deleted ? 'Talep silindi.' : 'Talep geri yüklendi.');
}

// -----------------------------------------------------------------------------
// Randevular
// -----------------------------------------------------------------------------
const appointmentSchema = z.object({
  customer_id: z.uuid({ error: 'Müşteri seçin.' }),
  property_id: z.uuid().nullable().optional(),
  lead_id: z.uuid().nullable().optional(),
  scheduled_at: z.iso.datetime({ offset: true, error: 'Geçerli bir tarih ve saat seçin.' }),
  duration_minutes: z.number().int().min(15).max(480).default(45),
  note: optionalText(2000),
  assigned_to: z.uuid().nullable().optional(),
});

export async function createAppointment(input: z.input<typeof appointmentSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('appointments.manage');
    requireFeature(ctx, 'crm');
    const data = appointmentSchema.parse(input);
    await assertOwned(ctx, 'customers', data.customer_id);
    await assertProperty(ctx, data.property_id);
    await assertMember(ctx, data.assigned_to);
    if (data.lead_id) await assertOwned(ctx, 'leads', data.lead_id);
    const { data: created, error } = await ctx.supabase
      .from('appointments')
      .insert({
        organization_id: ctx.org.id,
        customer_id: data.customer_id,
        property_id: data.property_id ?? null,
        lead_id: data.lead_id ?? null,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        note: data.note ?? null,
        assigned_to: data.assigned_to ?? null,
        status: 'confirmed',
        created_by: ctx.user.id,
      })
      .select('id')
      .single();
    assertNoDbError(error);
    if (!created) throw new ActionError('Randevu kaydedilemedi.');
    if (data.lead_id) await ctx.supabase.from('leads').update({ status: 'appointment' }).eq('id', data.lead_id).in('status', ['new', 'contacted', 'meeting', 'follow_up']);
    refresh('/admin/randevular', '/admin');
    return { id: created.id };
  }, 'Randevu oluşturuldu.');
}

export async function updateAppointment(
  id: string,
  input: { status?: (typeof APPOINTMENT_STATUSES)[number]; scheduled_at?: string; note?: string | null },
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('appointments.manage');
    await assertOwned(ctx, 'appointments', id);
    const data = z
      .object({
        status: z.enum(APPOINTMENT_STATUSES),
        scheduled_at: z.iso.datetime({ offset: true, error: 'Geçerli bir tarih ve saat seçin.' }),
        note: optionalText(2000),
      })
      .partial()
      .strict()
      .parse(input);
    const { error } = await ctx.supabase.from('appointments').update(data).eq('id', id);
    assertNoDbError(error);
    refresh('/admin/randevular', '/admin');
    return null;
  }, 'Randevu güncellendi.');
}

// -----------------------------------------------------------------------------
// Koleksiyonlar (müşteriye özel ilan seçkisi)
// -----------------------------------------------------------------------------
const collectionSchema = z.object({
  title: z.string().trim().min(3, { error: 'Başlık en az 3 karakter olmalıdır.' }).max(120).transform(clean),
  message: optionalText(2000),
  customer_id: z.uuid().nullable().optional(),
  expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
  /** Düzenlemede mevcut geçerlilik süresini değiştirme */
  keep_expiry: z.boolean().optional(),
  items: z
    .array(z.object({ property_id: z.uuid(), note: optionalText(500) }))
    .min(1, { error: 'En az bir ilan seçin.' })
    .max(30, { error: 'Bir seçkiye en fazla 30 ilan eklenebilir.' }),
});

export type CollectionInput = z.input<typeof collectionSchema>;

async function assertProperties(ctx: OrgContext, ids: string[]) {
  const { data } = await ctx.supabase.from('properties').select('id').eq('organization_id', ctx.org.id).in('id', ids);
  if ((data ?? []).length !== new Set(ids).size) throw new ActionError('Seçilen ilanlardan bazıları bu ofise ait değil.');
}

export async function saveCollection(id: string | null, input: CollectionInput): Promise<ActionResult<{ id: string; token: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('collections.manage');
    requireFeature(ctx, 'crm');
    const data = collectionSchema.parse(input);
    const ids = data.items.map((i) => i.property_id);
    await assertProperties(ctx, ids);
    if (data.customer_id) await assertOwned(ctx, 'customers', data.customer_id);
    const expiresAt = data.expires_in_days ? new Date(Date.now() + data.expires_in_days * 86_400_000).toISOString() : null;

    let collectionId = id;
    let token: string;
    if (id) {
      await assertOwned(ctx, 'collections', id);
      const { data: updated, error } = await ctx.supabase
        .from('collections')
        .update({
          title: data.title,
          message: data.message ?? null,
          customer_id: data.customer_id ?? null,
          ...(data.keep_expiry ? {} : { expires_at: expiresAt }),
        })
        .eq('id', id)
        .select('token')
        .single();
      assertNoDbError(error);
      token = updated?.token ?? '';
      const { error: delError } = await ctx.supabase.from('collection_items').delete().eq('collection_id', id);
      assertNoDbError(delError);
    } else {
      // 32 bayt kriptografik rastgele erişim anahtarı (tahmin edilemez bağlantı)
      token = randomBytes(32).toString('base64url');
      const { data: created, error } = await ctx.supabase
        .from('collections')
        .insert({
          organization_id: ctx.org.id,
          title: data.title,
          message: data.message ?? null,
          customer_id: data.customer_id ?? null,
          expires_at: expiresAt,
          token,
          created_by: ctx.user.id,
        })
        .select('id')
        .single();
      assertNoDbError(error);
      collectionId = created?.id ?? null;
    }
    if (!collectionId) throw new ActionError('Seçki kaydedilemedi.');
    const { error: itemsError } = await ctx.supabase.from('collection_items').insert(
      data.items.map((item, index) => ({
        collection_id: collectionId as string,
        property_id: item.property_id,
        organization_id: ctx.org.id,
        note: item.note ?? null,
        sort_order: index,
      })),
    );
    assertNoDbError(itemsError);
    refresh('/admin/koleksiyonlar');
    return { id: collectionId, token };
  }, 'Seçki kaydedildi.');
}

export async function setCollectionRevoked(id: string, revoked: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('collections.manage');
    await assertOwned(ctx, 'collections', id);
    const { error } = await ctx.supabase.from('collections').update({ revoked_at: revoked ? new Date().toISOString() : null }).eq('id', id);
    assertNoDbError(error);
    refresh('/admin/koleksiyonlar');
    return null;
  }, revoked ? 'Paylaşım bağlantısı iptal edildi.' : 'Paylaşım bağlantısı yeniden etkinleştirildi.');
}

export async function deleteCollection(id: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('collections.manage');
    await assertOwned(ctx, 'collections', id);
    const { error } = await ctx.supabase.from('collections').delete().eq('id', id);
    assertNoDbError(error);
    refresh('/admin/koleksiyonlar');
    return null;
  }, 'Seçki silindi.');
}
