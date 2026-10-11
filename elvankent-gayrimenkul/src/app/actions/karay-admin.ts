'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { requireSuperAdmin } from '@/platform/auth/session';

/**
 * KARAY (platform sahibi) yönetimi: KARAY talepleri ve KARAY kurumsal ayarları. Yalnızca
 * süper admin (sunucuda requireSuperAdmin + veritabanında RLS/assert_super_admin).
 * Kiracı verisiyle ilgisi yoktur; işlemler platform düzeyinde (organizasyonsuz) kaydedilir.
 */

export async function updateKarayLead(id: string, status: string, note: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!isUuid(id)) throw new ActionError('Talep bulunamadı.');
    if (!['new', 'contacted', 'qualified', 'closed'].includes(status)) throw new ActionError('Geçersiz durum.');
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.rpc('platform_update_lead', { p_id: id, p_status: status, p_note: note.slice(0, 2000) || undefined });
    assertNoDbError(error);
    revalidatePath('/platform/talepler');
    revalidatePath('/platform');
    return null;
  }, 'Talep güncellendi.');
}

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

const profileSchema = z.object({
  company_name: z.string().trim().min(2, { message: 'Şirket adı en az 2 karakter olmalıdır.' }).max(80),
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

export async function updateKarayProfile(input: KarayProfileInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? 'Geçersiz değer.');
    const session = await requireSuperAdmin();
    const { error } = await session.supabase
      .from('platform_settings')
      .update({ ...parsed.data, updated_at: new Date().toISOString(), updated_by: session.user.id })
      .eq('id', true);
    assertNoDbError(error);
    await logSecurityEvent({ orgId: null, action: 'platform.settings_updated', actorId: session.user.id, targetType: 'platform', targetLabel: 'KARAY ayarları' });
    updateTag(cacheTags.karay);
    revalidatePath('/platform/ayarlar');
    return null;
  }, 'KARAY ayarları kaydedildi.');
}

/**
 * KARAY iç notu (FAZ 1): müşteriyle ilgili destek / satış notu. Yalnızca süper admin yazar ve okur
 * (platform_org_notes RLS); not düzenlenmez / silinmez (iz kaydı gibi). Ofis notu hiçbir zaman görmez.
 */
export async function addOrgNote(orgId: string, body: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!isUuid(orgId)) throw new ActionError('Organizasyon bulunamadı.');
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) throw new ActionError('Not boş olamaz.', 'validation', { body: ['Not boş olamaz.'] });
    if (text.length > 2000) throw new ActionError('Not en fazla 2000 karakter olabilir.', 'validation', { body: ['Not en fazla 2000 karakter olabilir.'] });
    const session = await requireSuperAdmin();
    const { error } = await session.supabase.from('platform_org_notes').insert({ organization_id: orgId, author_id: session.user.id, body: text });
    assertNoDbError(error);
    revalidatePath(`/platform/organizasyonlar/${orgId}`);
    revalidatePath('/platform/organizasyonlar');
    return null;
  }, 'Not eklendi.');
}
