import 'server-only';
import type { SessionUser } from '@/platform/auth/session';

/**
 * Tasarım ailesi yetkileri (20261004000001_design_family_access migration'ı). Yalnızca kimlikler
 * okunur; ailelerin tanımı (katalog) Site Factory'dedir. Migration henüz uygulanmamış bir
 * veritabanında `available: false` döner ve arayüz özelliği kapalı gösterir (hata vermez).
 */
type Db = SessionUser['supabase'];

function missingSchema(error: { code?: string } | null): boolean {
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error?.code ?? '');
}

/** Global olarak kapatılmış aileler (satır yok = açık) */
export async function disabledFamilies(db: Db): Promise<{ available: boolean; disabled: Set<string> }> {
  const { data, error } = await db.from('design_family_settings').select('family_id, enabled');
  if (error) return { available: !missingSchema(error), disabled: new Set() };
  return { available: true, disabled: new Set((data ?? []).filter((r) => !r.enabled).map((r) => r.family_id)) };
}

/** Kiracıya izin verilmiş aileler (global kapatılanlar dahil — KARAY ekranı için) */
export async function grantedFamilies(db: Db, orgId: string): Promise<{ available: boolean; granted: string[] }> {
  const { data, error } = await db.from('organization_design_families').select('family_id').eq('organization_id', orgId);
  if (error) return { available: !missingSchema(error), granted: [] };
  return { available: true, granted: (data ?? []).map((r) => r.family_id).sort() };
}

/** Kiracının SEÇEBİLECEĞİ aileler: izinli ∩ global açık (veritabanı fonksiyonu; üyelik orada doğrulanır) */
export async function selectableFamilies(db: Db, orgId: string): Promise<{ available: boolean; families: string[] }> {
  const { data, error } = await db.rpc('org_design_family_access', { p_org: orgId });
  if (error) return { available: !missingSchema(error), families: [] };
  return { available: true, families: (data ?? []).map((r) => r.family_id) };
}

export { missingSchema as isMissingDesignAccessSchema };
