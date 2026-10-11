'use server';

import { revalidatePath } from 'next/cache';
import { ActionError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission } from '@/platform/auth/session';
import { isUuid } from '@/lib/utils';
import * as domains from '@/modules/domains/service';

/**
 * OFİS PANELİ › Site yönetimi › Alan adı (P0.5). KARAY konsoluyla AYNI servis.
 *   • organizasyon İSTEMCİDEN ALINMAZ: kimlik oturumdan (requirePermission → ctx.org.id)
 *   • yetki: settings.manage (sahip, yönetici); veritabanı aynı yetkiyi işlemi yapan kişiye karşı
 *     ikinci kez doğrular; plan özel alan adını içermeli
 *   • bağlantıyı elle onaylama yalnızca KARAY'dadır (ofis DNS yönlendirmesini kanıtlamalı)
 */
async function office() {
  const ctx = await requirePermission('settings.manage');
  return { orgId: ctx.org.id, actor: { userId: ctx.user.id, platform: false } };
}

function done() {
  revalidatePath('/admin/site', 'layout');
}

export async function addOfficeDomain(hostname: string): Promise<ActionResult<{ id: string; hostname: string }>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    const added = await domains.addDomain(actor, orgId, hostname);
    done();
    return added;
  }, 'Alan adı eklendi. Doğrulama için gösterilen TXT kaydını alan adı sağlayıcınızda tanımlayın.');
}

export async function verifyOfficeDomain(domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.verifyDomain(actor, orgId, domainId);
    done();
    return null;
  }, 'Alan adının sahipliği doğrulandı.');
}

export async function connectOfficeDomain(domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.connectDomain(actor, orgId, domainId);
    done();
    return null;
  }, 'Alan adı aktif; siteniz bu adreste açılır.');
}

export async function rotateOfficeDomainVerification(domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.rotateVerification(actor, orgId, domainId);
    done();
    return null;
  }, 'Yeni doğrulama kodu oluşturuldu; önceki kod artık geçersiz.');
}

export async function setPrimaryOfficeDomain(domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.setPrimaryDomain(actor, orgId, domainId);
    done();
    return null;
  }, 'Birincil alan adı güncellendi.');
}

export async function removeOfficeDomain(domainId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { orgId, actor } = await office();
    if (!isUuid(domainId)) throw new ActionError('Alan adı bulunamadı.');
    await domains.removeDomain(actor, orgId, domainId);
    done();
    return null;
  }, 'Alan adı kaldırıldı.');
}
