'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import { profileSchema, type KarayProfileInput } from '@/modules/karay/profile-schema';
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
    await logSecurityEvent({ orgId: null, action: 'platform.settings_updated', actorId: session.user.id, targetType: 'platform', targetLabel: 'KARAYS ayarları' });
    updateTag(cacheTags.karay);
    revalidatePath('/platform/ayarlar');
    return null;
  }, 'KARAYS ayarları kaydedildi.');
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
