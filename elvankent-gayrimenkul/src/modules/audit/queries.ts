import 'server-only';
import { AUDIT_CATEGORIES, type AuditCategory } from '@/modules/audit/labels';
import type { DB } from '@/lib/supabase/server';

export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters {
  /** null → platform (organizasyonsuz) kayıtlar; undefined → tümü (yalnızca süper admin) */
  orgId?: string | null;
  category?: AuditCategory;
  actorId?: string;
  days?: number;
  q?: string;
  page: number;
}

export interface AuditEntry {
  id: number;
  organization_id: string | null;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  metadata: unknown;
  created_at: string;
}

/**
 * Denetim kayıtları. RLS: organizasyon için audit.read, platform için süper
 * admin. Organizasyon sayfası her zaman kendi organizasyonuyla sınırlanır
 * (süper admin olan bir üye de yalnızca o organizasyonun kayıtlarını görür).
 */
export async function listAuditLogs(db: DB, f: AuditFilters) {
  const from = (f.page - 1) * AUDIT_PAGE_SIZE;
  let query = db
    .from('audit_logs')
    .select('id, organization_id, action, actor_id, actor_label, target_type, target_id, target_label, metadata, created_at', { count: 'exact' });
  if (f.orgId === null) query = query.is('organization_id', null);
  else if (f.orgId) query = query.eq('organization_id', f.orgId);
  if (f.category) query = query.or(AUDIT_CATEGORIES[f.category].prefixes.map((p) => `action.like.${p}*`).join(','));
  if (f.actorId && /^[0-9a-f-]{36}$/i.test(f.actorId)) query = query.eq('actor_id', f.actorId);
  if (f.days) query = query.gte('created_at', new Date(Date.now() - f.days * 86_400_000).toISOString());
  const term = (f.q ?? '').replace(/[^\p{L}\p{N}\s.@-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (term.length >= 2) query = query.ilike('target_label', `%${term}%`);
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + AUDIT_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Kayıtlar yüklenemedi: ${error.message}`);
  const total = count ?? 0;
  return { rows: (data ?? []) as AuditEntry[], total, pageCount: Math.ceil(total / AUDIT_PAGE_SIZE) };
}
