import 'server-only';
import type { z } from 'zod';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { SECTION_SCHEMAS, parseSiteConfig, type BrandDraft, type BrandField, type SiteSection } from '@/site-config/schema';
import { compileDesign } from '@/site-factory/compile';
import { findDesignFamily } from '@/site-factory/families';
import { brandSchema, firstIssue, type BrandInput } from '@/site-editor/brand-input';
import type { Json } from '@/types/supabase';

/**
 * SITE EDITOR SERVİSİ — taslak → önizleme → yayın → geri alma akışının TEK kaynağı.
 *
 * KARAY Site Builder (süper admin, seçilen kiracı) ve ofis paneli /admin/site (settings.manage,
 * oturumun ofisi) aynı fonksiyonları çağırır; fark yalnızca çağıran işlemin yetki kontrolü ve
 * organizasyonun KAYNAĞIDIR (KARAY: seçilen site; ofis: oturumdan, istemciden asla).
 *
 * Her yazma OTURUM istemcisiyle (db) yapılır: veritabanı fonksiyonları (site_save_draft,
 * site_publish, site_rollback, site_discard_draft) yetkiyi ayrıca assert_site_editor(p_org)
 * ile doğrular. Böylece sunucu kontrolü atlansa bile başka kiracıya yazılamaz. Servis hizmet
 * (service-role) anahtarı KULLANMAZ. Yayın sonrası önbellek yenileme (cache.ts) ve önizleme
 * bağlantısı (preview-link.ts) ayrı dosyalardadır; bu dosya yalnızca doğrulama + veritabanı
 * çağrısıdır (birim testleri sahte istemciyle doğrudan çalıştırır).
 */
type Db = SessionUser['supabase'];

function assertOrg(orgId: string) {
  if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
}

/** Taslağın bir bölümünü kaydeder (canlı site değişmez) */
export async function saveDraftSection(db: Db, orgId: string, section: SiteSection, value: unknown): Promise<void> {
  assertOrg(orgId);
  const schema = SECTION_SCHEMAS[section];
  if (!schema) throw new ActionError('Geçersiz bölüm.');
  const parsed = (schema as z.ZodType).safeParse(value);
  if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
  const { error } = await db.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: parsed.data as Json });
  assertNoDbError(error);
}

/**
 * Marka ve iletişim TASLAĞA yazılır (yalnızca canlıdan farklı alanlar). Yayında ofisin ayar
 * kaydına uygulanır, sürüm kaydına anlık görüntü yazılır; geri almada eski marka geri gelir.
 */
export async function saveBrandDraft(db: Db, orgId: string, input: BrandInput): Promise<void> {
  assertOrg(orgId);
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
  const [settings, site] = await Promise.all([
    db.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle(),
    db.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle(),
  ]);
  if (!settings.data) throw new ActionError('Site bulunamadı.');
  const live = settings.data as unknown as Record<string, unknown>;
  const draft: BrandDraft = { ...parseSiteConfig(site.data?.draft).brand };
  for (const [k, v] of Object.entries(parsed.data) as [BrandField, string | null][]) {
    // Canlıyla aynıysa taslaktan çıkar (bekleyen değişiklik yok)
    if ((live[k] ?? null) === v) delete draft[k];
    else draft[k] = v;
  }
  const { error } = await db.rpc('site_save_draft', { p_org: orgId, p_section: 'brand', p_value: draft as Json });
  assertNoDbError(error);
}

/**
 * Site Factory: tasarım ailesini TASLAĞA derler (tema, renk, tipografi, yapısal parçalar, ana
 * sayfa). Aile kapalı katalogdan çözülür. `allowed` verilirse (ofis) aile o listede olmalıdır;
 * veritabanı da (site_save_draft) süper admin olmayan çağıranda aile iznini ayrıca doğrular.
 * Bir bölüm yazılamazsa yazılanlar eski değerlerine döndürülür (yarım aile taslakta kalmaz).
 */
export async function applyFamilyToDraft(db: Db, orgId: string, familyId: string, allowed?: readonly string[]): Promise<void> {
  assertOrg(orgId);
  const family = typeof familyId === 'string' ? findDesignFamily(familyId) : null;
  if (!family) throw new ActionError('Geçersiz tasarım ailesi.');
  if (allowed && !allowed.includes(family.id)) throw new ActionError('Bu tasarım ailesi siteniz için açık değil.', 'family_not_allowed');
  const { data: row, error: readError } = await db.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle();
  assertNoDbError(readError);
  if (!row) throw new ActionError('Site bulunamadı.');
  const draftRaw = row.draft && typeof row.draft === 'object' ? (row.draft as Record<string, unknown>) : {};
  const compiled = compileDesign(family, parseSiteConfig(draftRaw));
  const written: (keyof typeof compiled)[] = [];
  try {
    for (const section of ['theme', 'colors', 'typography', 'style', 'home'] as const) {
      const { error } = await db.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: compiled[section] as Json });
      assertNoDbError(error);
      written.push(section);
    }
  } catch (e) {
    for (const section of written) {
      await db.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: (draftRaw[section] ?? null) as Json });
    }
    throw e;
  }
}

/** Taslağı yayınlar; yeni sürüm numarasını döner */
export async function publishDraft(db: Db, orgId: string, note?: string): Promise<number> {
  assertOrg(orgId);
  const { data, error } = await db.rpc('site_publish', { p_org: orgId, p_note: (note ?? '').slice(0, 200) || undefined });
  assertNoDbError(error);
  return data as number;
}

/** Seçilen sürümü yeni sürüm olarak yayınlar (geçmiş silinmez) */
export async function rollbackToVersion(db: Db, orgId: string, version: number): Promise<number> {
  assertOrg(orgId);
  if (!Number.isInteger(version) || version < 1) throw new ActionError('Geçersiz sürüm.');
  const { data, error } = await db.rpc('site_rollback', { p_org: orgId, p_version: version });
  assertNoDbError(error);
  return data as number;
}

/** Taslağı canlı sürüme döndürür */
export async function discardDraft(db: Db, orgId: string): Promise<void> {
  assertOrg(orgId);
  const { error } = await db.rpc('site_discard_draft', { p_org: orgId });
  assertNoDbError(error);
}

export interface SiteRevision {
  version: number;
  note: string | null;
  created_at: string;
}

/** Yayın sürümleri (RLS: süper admin veya o ofiste settings.manage) */
export async function listRevisions(db: Db, orgId: string): Promise<SiteRevision[]> {
  const { data } = await db.from('site_config_revisions').select('version, note, created_at').eq('organization_id', orgId).order('version', { ascending: false }).limit(50);
  return data ?? [];
}
