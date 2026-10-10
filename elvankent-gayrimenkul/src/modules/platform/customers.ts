import 'server-only';
import type { SessionUser } from '@/platform/auth/session';
import { listPlatformOrgs, type PlatformOrg } from '@/modules/platform/queries';
import {
  customerStatus,
  onboardingProgress,
  onboardingSteps,
  parseOnboardingFlags,
  type CustomerStatus,
  type CustomerStatusKey,
  type OnboardingFlags,
} from '@/modules/platform/customer-status';

/**
 * KARAY müşteri görünümü (FAZ 1): organizasyon listesi + sahip / site / alan adı / kurulum durumu.
 * İki veritabanı çağrısı (platform_organizations + platform_customer_overview), ikisi de yalnızca
 * süper admin. Müşteri durumu customer-status.ts'te türetilir; yeni durum kolonu yoktur.
 */
export interface CustomerRow extends PlatformOrg {
  ownerEmail: string | null;
  ownerPending: boolean;
  invitationStatus: string | null;
  invitationExpiresAt: string | null;
  siteStatus: 'active' | 'maintenance' | 'draft';
  publishedVersion: number;
  publishedAt: string | null;
  domainsActive: number;
  domainsWaiting: number;
  notesCount: number;
  lastNoteAt: string | null;
  flags: OnboardingFlags;
  progress: { done: number; total: number; percent: number };
  customer: CustomerStatus;
}

export async function listCustomers(session: SessionUser, now: Date = new Date()): Promise<CustomerRow[]> {
  const [orgs, overview] = await Promise.all([listPlatformOrgs(session), session.supabase.rpc('platform_customer_overview')]);
  if (overview.error) throw new Error(`Müşteri durumu yüklenemedi: ${overview.error.message}`);
  const byOrg = new Map((overview.data ?? []).map((r) => [r.organization_id, r]));
  return orgs.map((o) => {
    const ov = byOrg.get(o.id);
    const flags = parseOnboardingFlags(ov?.onboarding);
    const siteStatus = (['active', 'maintenance', 'draft'] as const).find((s) => s === ov?.site_status) ?? 'active';
    return {
      ...o,
      ownerEmail: ov?.owner_email ?? null,
      ownerPending: ov?.owner_pending ?? false,
      invitationStatus: ov?.invitation_status ?? null,
      invitationExpiresAt: ov?.invitation_expires_at ?? null,
      siteStatus,
      publishedVersion: ov?.published_version ?? 0,
      publishedAt: ov?.published_at ?? null,
      domainsActive: ov?.domains_active ?? 0,
      domainsWaiting: ov?.domains_waiting ?? 0,
      notesCount: ov?.notes_count ?? 0,
      lastNoteAt: ov?.last_note_at ?? null,
      flags,
      progress: onboardingProgress(onboardingSteps(flags)),
      customer: customerStatus(
        {
          orgStatus: o.status,
          hasOwner: Boolean(ov?.owner_user_id),
          ownerPending: ov?.owner_pending ?? false,
          invitationStatus: ov?.invitation_status ?? null,
          subscriptionStatus: o.subscription_status ?? null,
          trialEndsAt: o.trial_ends_at ?? null,
          domainsWaiting: ov?.domains_waiting ?? 0,
          domainWaitingSince: ov?.domain_waiting_since ?? null,
          flags,
        },
        now,
      ),
    };
  });
}

export const CUSTOMER_FILTERS: CustomerStatusKey[] = ['attention', 'invited', 'setup', 'ready', 'live', 'suspended'];

export function isCustomerFilter(value: unknown): value is CustomerStatusKey {
  return typeof value === 'string' && (CUSTOMER_FILTERS as string[]).includes(value);
}

/** Ad, kısa ad, alan adı veya sahip e-postasında arar (büyük/küçük harf ve Türkçe İ/ı duyarsız) */
export function filterCustomers(rows: CustomerRow[], q: string, status: CustomerStatusKey | null): CustomerRow[] {
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  return rows.filter((r) => {
    if (status && r.customer.key !== status) return false;
    if (!needle) return true;
    return [r.name, r.slug, r.primary_domain, r.ownerEmail].some((v) => v?.toLocaleLowerCase('tr-TR').includes(needle));
  });
}

/** Operasyon metrikleri (yeni altyapı yok: aynı liste üzerinden sayılır) */
export function customerMetrics(rows: CustomerRow[]) {
  const by = (key: CustomerStatusKey) => rows.filter((r) => r.customer.key === key).length;
  const plans = new Map<string, number>();
  for (const r of rows) if (r.status !== 'cancelled') plans.set(r.plan_id ?? '—', (plans.get(r.plan_id ?? '—') ?? 0) + 1);
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    setup: by('setup'),
    ready: by('ready'),
    live: by('live'),
    attention: by('attention'),
    invited: by('invited'),
    suspended: by('suspended'),
    pendingInvitations: rows.filter((r) => r.status === 'active' && r.ownerPending).length,
    publishedSites: rows.filter((r) => r.status === 'active' && r.siteStatus === 'active' && r.publishedVersion > 0).length,
    domainsWaiting: rows.filter((r) => r.status === 'active' && r.domainsWaiting > 0).length,
    plans,
  };
}
