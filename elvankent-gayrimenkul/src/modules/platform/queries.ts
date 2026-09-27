import 'server-only';
import type { SessionUser } from '@/platform/auth/session';
import type { Database } from '@/types/supabase';

export type PlatformOrg = Database['public']['Functions']['platform_organizations']['Returns'][number];

export const ORG_STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Aktif', tone: 'success' },
  suspended: { label: 'Askıda', tone: 'warning' },
  cancelled: { label: 'Kapatıldı', tone: 'danger' },
};

export const SUBSCRIPTION_LABELS: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  trialing: { label: 'Deneme', tone: 'info' },
  active: { label: 'Aktif', tone: 'success' },
  past_due: { label: 'Ödeme gecikmiş', tone: 'warning' },
  cancelled: { label: 'İptal', tone: 'danger' },
  expired: { label: 'Süresi doldu', tone: 'danger' },
};

export async function listPlatformOrgs(session: SessionUser): Promise<PlatformOrg[]> {
  const { data, error } = await session.supabase.rpc('platform_organizations');
  if (error) throw new Error(`Organizasyonlar yüklenemedi: ${error.message}`);
  return data ?? [];
}

export async function listPlans(session: SessionUser) {
  const { data } = await session.supabase
    .from('plans')
    .select('id, name, description, max_users, max_properties, max_storage_mb, crm_enabled, analytics_enabled, pdf_enabled, custom_domain_enabled, price_monthly, currency, is_public, sort_order')
    .order('sort_order')
    .order('id');
  return data ?? [];
}
