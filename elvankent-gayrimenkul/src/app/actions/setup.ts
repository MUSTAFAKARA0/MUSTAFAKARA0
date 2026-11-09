'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ActionError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission } from '@/platform/auth/session';
import { completeSetup, saveSetupProgress } from '@/site-editor/setup';
import { LAST_SETUP_STEP } from '@/modules/onboarding/setup-state';
import { refreshPublicSite } from '@/site-editor/cache';

/**
 * PILOT · OFİS İLK KURULUMU (/admin/kurulum). Organizasyon İSTEMCİDEN ALINMAZ: oturumdan gelir (requirePermission →
 * ctx.org.id). Yetki: settings.manage (sahip / yönetici); veritabanı (org_setup_progress / org_setup_complete) aynı yetkiyi
 * oturumun üyeliğine karşı ikinci kez doğrular, satır kilidiyle tek kazanan seçer ve tamamlanmış kurulumda eski / tekrar
 * isteği 'setup_completed' ile reddeder.
 */

const familySchema = z.string().regex(/^[a-z0-9-]{1,40}$/).nullable();

export async function saveSetupStep(step: number, familyId: string | null): Promise<ActionResult<{ state: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    if (!Number.isInteger(step) || step < 0 || step > LAST_SETUP_STEP) throw new ActionError('Geçersiz kurulum adımı.');
    const family = familySchema.safeParse(familyId ?? null);
    if (!family.success) throw new ActionError('Geçersiz tasarım ailesi.');
    return { state: await saveSetupProgress(ctx.supabase, ctx.org.id, step, family.data) };
  });
}

export async function finishSetup(familyId: string | null): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const ctx = await requirePermission('settings.manage');
    const family = familySchema.safeParse(familyId ?? null);
    if (!family.success) throw new ActionError('Geçersiz tasarım ailesi.');
    const version = await completeSetup(ctx.supabase, ctx.org.id, family.data);
    refreshPublicSite(ctx.org.id);
    revalidatePath('/admin', 'layout');
    return { version };
  }, 'Kurulum tamamlandı. Paneliniz hazır.');
}
