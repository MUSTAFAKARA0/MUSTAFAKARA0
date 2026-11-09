import 'server-only';
import { cache } from 'react';
import { ActionError, assertNoDbError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { isMissingDesignAccessSchema } from '@/modules/platform/design-access';
import { parseOrgSetup, type OrgSetup } from '@/modules/onboarding/setup-state';
import { parseSiteConfig } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { findDesignFamily } from '@/site-factory/families';
import type { Json } from '@/types/supabase';

/**
 * PILOT · İlk kurulum — sunucu tarafı (bekleyen migration I). Durum organization_setup tablosundadır (RLS: o ofisin
 * üyeleri ve süper yönetici okur; yazma yalnız yetki denetimli veritabanı fonksiyonlarıyla).
 *
 * ESKİ ŞEMA UYUMU: migration uygulanmamış veritabanında (tablo / fonksiyon yok) okuma `available: false, setup: null`
 * döner — kimse akışa yönlenmez, tasarım kilitlenmez, hata verilmez (CI database-legacy-schema bu yolu koşar).
 *
 * Organizasyon kimliği her zaman çağıranın OTURUMUNDAN gelir (ofis: ctx.org.id); veritabanı ayrıca settings.manage
 * yetkisini oturumun üyeliğine karşı doğrular.
 */
type Db = SessionUser['supabase'];

export interface OrgSetupRead {
  available: boolean;
  setup: OrgSetup | null;
}

async function readSetup(db: Db, orgId: string): Promise<OrgSetupRead> {
  const { data, error } = await db
    .from('organization_setup')
    .select('state, origin, step, selected_family, completed_at, reopened_at')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) {
    if (!isMissingDesignAccessSchema(error)) console.warn('[setup] read failed', { org: orgId, code: error.code });
    return { available: !isMissingDesignAccessSchema(error), setup: null };
  }
  return { available: true, setup: parseOrgSetup(data) };
}

/** İstek başına tekilleştirilmiş okuma (panel düzeni ve sayfa aynı isteği paylaşır) */
export const getOrgSetup = cache(readSetup);

/** Tasarım bölümlerini sitenin YAYINDAKİ yapılandırmasından derler (ofis önizlemesiyle aynı kaynak: site-preview/office.ts) */
export async function compileSetupDesign(db: Db, orgId: string, familyId: string) {
  const family = findDesignFamily(familyId);
  if (!family) throw new ActionError('Geçersiz tasarım ailesi.');
  const { data, error } = await db.from('site_configs').select('published').eq('organization_id', orgId).maybeSingle();
  assertNoDbError(error);
  const current = parseSiteConfig(data?.published);
  return { family, sections: compileDesign(family, current) };
}

/** Sahip: kalınan adımı ve aday aileyi kaydeder */
export async function saveSetupProgress(db: Db, orgId: string, step: number, familyId: string | null): Promise<string> {
  if (familyId !== null && !findDesignFamily(familyId)) throw new ActionError('Geçersiz tasarım ailesi.');
  const { data, error } = await db.rpc('org_setup_progress', { p_org: orgId, p_step: step, ...(familyId ? { p_family: familyId } : {}) });
  assertNoDbError(error);
  return data as string;
}

/**
 * Sahip: seçimi onaylar. Tasarım sunucuda katalogdan derlenir; veritabanı (org_setup_complete → site_apply_design)
 * aile iznini, bölümleri ve kurulum durumunu tek işlemde doğrular. Tamamlanmış kurulumda 'setup_completed' döner.
 */
export async function completeSetup(db: Db, orgId: string, familyId: string | null): Promise<number> {
  // İzinli aile yoksa (KARAYS hiç açmadıysa) mevcut tasarımla tamamlanır: aile ve bölümler null gider
  let args: { p_org: string; p_family: string | null; p_sections: Json } = { p_org: orgId, p_family: null, p_sections: null };
  if (familyId) {
    const { family, sections } = await compileSetupDesign(db, orgId, familyId);
    args = { p_org: orgId, p_family: family.id, p_sections: sections as unknown as Json };
  }
  const { data, error } = await db.rpc('org_setup_complete', args as { p_org: string; p_family: string; p_sections: Json });
  assertNoDbError(error);
  return (data as number) ?? 0;
}

/** KARAYS süper yöneticisi: tek seferlik seçimi yeniden açar (denetim kaydı veritabanında) */
export async function reopenSetup(db: Db, orgId: string, reason?: string): Promise<string> {
  const { data, error } = await db.rpc('platform_reopen_org_setup', { p_org: orgId, ...(reason ? { p_reason: reason.slice(0, 200) } : {}) });
  if (error && isMissingDesignAccessSchema(error)) throw new ActionError('İlk kurulum özelliği bu veritabanında henüz etkin değil (bekleyen migration I).', 'setup_unavailable');
  assertNoDbError(error);
  return data as string;
}
