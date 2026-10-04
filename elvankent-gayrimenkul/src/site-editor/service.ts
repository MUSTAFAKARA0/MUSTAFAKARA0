import 'server-only';
import type { z } from 'zod';
import { isUuid } from '@/lib/utils';
import { ActionError, assertNoDbError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { BRAND_FIELDS, SECTION_SCHEMAS, brandDraftSchema, parseSiteConfig, type BrandDraft, type BrandField, type BrandValue, type SiteSection } from '@/site-config/schema';
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

/**
 * Taslak eşzamanlılık belirteci: formun açıldığı andaki site_configs.draft_updated_at. Verilirse
 * veritabanı (site_save_draft) taslak o andan sonra değişmişse kaydı reddeder ('stale_draft').
 * Verilmezse (null/undefined) eski davranış: son yazan kazanır.
 */
export type DraftToken = string | null | undefined;

function assertOrg(orgId: string) {
  if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
}

function draftArgs(orgId: string, section: string, value: unknown, expected?: DraftToken) {
  const args: { p_org: string; p_section: string; p_value: Json; p_expected_updated_at?: string } = { p_org: orgId, p_section: section, p_value: value as Json };
  if (typeof expected === 'string' && expected) args.p_expected_updated_at = expected;
  return args;
}

/** Değer karşılaştırması: sayı/metin/JSON (çalışma saatleri) için anahtar sırasından bağımsız */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v === '' || v === undefined ? null : v);
}

/** Taslağın bir bölümünü kaydeder (canlı site değişmez) */
export async function saveDraftSection(db: Db, orgId: string, section: SiteSection, value: unknown, expected?: DraftToken): Promise<string | null> {
  assertOrg(orgId);
  const schema = SECTION_SCHEMAS[section];
  if (!schema) throw new ActionError('Geçersiz bölüm.');
  const parsed = (schema as z.ZodType).safeParse(value);
  if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
  const { data, error } = await db.rpc('site_save_draft', draftArgs(orgId, section, parsed.data, expected));
  assertNoDbError(error);
  return data ?? null;
}

/**
 * MARKA / SİTE İÇERİĞİ TASLAĞI — tek çekirdek. KARAY marka formu, ofis /admin/site, /admin/sirket,
 * ana sayfa metinleri ve marka görselleri buradan yazar. Yalnızca canlıdan FARKLI alanlar taslakta
 * tutulur; canlıyla aynı olan alan taslaktan çıkarılır (bekleyen değişiklik kalmaz). Yayında ofisin
 * ayar kaydına uygulanır (site_apply_brand), sürüm kaydına anlık görüntü yazılır; geri almada eski
 * değerler döner. Alanlar beyaz listededir (BRAND_FIELDS = site_brand_columns).
 */
export async function saveBrandFields(db: Db, orgId: string, values: BrandDraft, expected?: DraftToken): Promise<string | null> {
  assertOrg(orgId);
  if (Object.keys(values ?? {}).some((k) => !(BRAND_FIELDS as readonly string[]).includes(k))) throw new ActionError('Geçersiz marka alanı.');
  const checked = brandDraftSchema.safeParse(values);
  if (!checked.success) throw new ActionError(firstIssue(checked.error));
  const [settings, site] = await Promise.all([
    db.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle(),
    db.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle(),
  ]);
  if (!settings.data) throw new ActionError('Site bulunamadı.');
  const live = settings.data as unknown as Record<string, unknown>;
  const draft: BrandDraft = { ...parseSiteConfig(site.data?.draft).brand };
  for (const [k, v] of Object.entries(checked.data) as [BrandField, BrandValue][]) {
    if (canonical(live[k] ?? null) === canonical(v)) delete draft[k];
    else draft[k] = v;
  }
  const { data, error } = await db.rpc('site_save_draft', draftArgs(orgId, 'brand', draft, expected));
  assertNoDbError(error);
  return data ?? null;
}

/** KARAY / ofis marka formu (Site Builder › Marka, /admin/site › Genel ve İletişim) */
export async function saveBrandDraft(db: Db, orgId: string, input: BrandInput, expected?: DraftToken): Promise<string | null> {
  assertOrg(orgId);
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) throw new ActionError(firstIssue(parsed.error));
  return saveBrandFields(db, orgId, parsed.data, expected);
}

/**
 * Site Factory: tasarım ailesini TASLAĞA derler (tema, renk, tipografi, yapısal parçalar, ana
 * sayfa). Aile kapalı katalogdan çözülür. `allowed` verilirse (ofis) aile o listede olmalıdır;
 * veritabanı da (site_save_draft) süper admin olmayan çağıranda aile iznini ayrıca doğrular.
 * Bir bölüm yazılamazsa yazılanlar eski değerlerine döndürülür (yarım aile taslakta kalmaz).
 */
export async function applyFamilyToDraft(db: Db, orgId: string, familyId: string, allowed?: readonly string[], expected?: DraftToken): Promise<string | null> {
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
  let token: string | null = null;
  try {
    for (const section of ['theme', 'colors', 'typography', 'style', 'home'] as const) {
      // Belirteç yalnızca ilk yazımda denetlenir (sonraki bölümler bu işlemin kendi yazımını izler)
      const { data, error } = await db.rpc('site_save_draft', draftArgs(orgId, section, compiled[section], written.length === 0 ? expected : null));
      assertNoDbError(error);
      written.push(section);
      token = data ?? null;
    }
  } catch (e) {
    for (const section of written) {
      await db.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: (draftRaw[section] ?? null) as Json });
    }
    throw e;
  }
  return token;
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
