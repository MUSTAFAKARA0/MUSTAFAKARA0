import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { isUuid } from '@/lib/utils';
import type { SessionUser } from '@/platform/auth/session';
import { parseFeatureOverrides, parseSiteConfig, type FeatureOverrides, type SiteConfig, type SiteStatus } from '@/platform/site/schema';
import { applyBrandDraft } from '@/platform/site/brand';
import type { OrgSettings } from '@/platform/tenant/tenant';
import type { Enums } from '@/types/supabase';

export interface SiteAdmin {
  org: { id: string; slug: string; name: string; status: Enums<'org_status'>; isDefault: boolean };
  /** Canlıdaki ofis ayarları (yayındaki marka) */
  settings: OrgSettings;
  /** Taslaktaki etkin marka: canlı ayarlar + bekleyen marka değişiklikleri */
  brand: OrgSettings;
  draft: SiteConfig;
  published: SiteConfig;
  /** Ham taslak (hangi bölümlerin özelleştirildiğini göstermek için) */
  draftRaw: Record<string, unknown>;
  /** Taslakta canlıdan farklı olan bölümler (yayınlanmamış) */
  pendingSections: string[];
  version: number;
  hasUnpublishedChanges: boolean;
  status: SiteStatus;
  maintenanceMessage: string | null;
  overrides: FeatureOverrides;
  publishedAt: string | null;
  draftUpdatedAt: string | null;
  primaryDomain: string | null;
}

/**
 * Site Kontrol Merkezi verisi: süper admin oturumuyla (RLS: platform okuma politikaları)
 * 4 paralel sorgu. İstek başına tekilleştirilir (düzen + sekme sayfası aynı veriyi paylaşır).
 */
export const getSiteAdmin = cache(async (session: SessionUser, orgId: string): Promise<SiteAdmin | null> => {
  const db = session.supabase;
  const [org, settings, site, domain] = await Promise.all([
    db.from('organizations').select('id, slug, name, status, is_default').eq('id', orgId).maybeSingle(),
    db.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle(),
    db.from('site_configs').select('*').eq('organization_id', orgId).maybeSingle(),
    db.from('organization_domains').select('hostname').eq('organization_id', orgId).eq('is_primary', true).maybeSingle(),
  ]);
  if (!org.data || !settings.data) return null;
  const row = site.data;
  const draftRaw = row?.draft && typeof row.draft === 'object' ? (row.draft as Record<string, unknown>) : {};
  const draft = parseSiteConfig(draftRaw);
  const publishedRaw = row?.published && typeof row.published === 'object' ? (row.published as Record<string, unknown>) : {};
  const pendingSections = [...new Set([...Object.keys(draftRaw), ...Object.keys(publishedRaw)])].filter(
    (k) => JSON.stringify(draftRaw[k] ?? null) !== JSON.stringify(publishedRaw[k] ?? null),
  );
  return {
    org: { id: org.data.id, slug: org.data.slug, name: org.data.name, status: org.data.status, isDefault: org.data.is_default },
    settings: settings.data,
    brand: applyBrandDraft(settings.data, draft.brand),
    draft,
    published: parseSiteConfig(row?.published),
    draftRaw,
    pendingSections,
    version: row?.published_version ?? 0,
    hasUnpublishedChanges: row?.has_unpublished_changes ?? false,
    status: (['active', 'maintenance', 'draft'] as const).find((x) => x === row?.site_status) ?? 'active',
    maintenanceMessage: row?.maintenance_message ?? null,
    overrides: parseFeatureOverrides(row?.feature_overrides),
    publishedAt: row?.published_at ?? null,
    draftUpdatedAt: row?.draft_updated_at ?? null,
    primaryDomain: domain.data?.hostname ?? null,
  };
});

/** Sekme sayfaları için: geçersiz kimlik veya bulunamayan site → 404 */
export async function getSiteOr404(session: SessionUser, orgId: string): Promise<SiteAdmin> {
  if (!isUuid(orgId)) notFound();
  const site = await getSiteAdmin(session, orgId);
  if (!site) notFound();
  return site;
}

export const SITE_STATUS_META: Record<SiteStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  active: { label: 'Yayında', tone: 'success' },
  maintenance: { label: 'Bakım modu', tone: 'warning' },
  draft: { label: 'Yayında değil', tone: 'neutral' },
};
