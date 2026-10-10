import 'server-only';
import { isUuid, one, toNumber } from '@/lib/utils';
import type { OrgContext } from '@/platform/auth/session';
import type { Enums } from '@/types/supabase';

export const CRM_PAGE_SIZE = 25;

export type LeadStatus = Enums<'lead_status'>;
export type LeadSource = Enums<'lead_source'>;
type Rel<T> = T | T[] | null;

export interface Member {
  id: string;
  name: string;
}

export async function getMembers(ctx: OrgContext): Promise<Member[]> {
  const { data } = await ctx.supabase.rpc('list_org_members', { p_org: ctx.org.id });
  return (data ?? []).filter((m) => m.status === 'active').map((m) => ({ id: m.user_id, name: m.full_name || m.email || 'Kullanıcı' }));
}

function searchTerm(q: string | undefined): string | undefined {
  const cleaned = (q ?? '').replace(/[^\p{L}\p{N}\s@.+-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return cleaned.length >= 2 ? cleaned : undefined;
}

export interface LeadListFilters {
  status?: LeadStatus;
  source?: LeadSource;
  assigned?: 'me' | 'none';
  customerId?: string;
  q?: string;
  deleted?: boolean;
  page: number;
}

export interface LeadRow {
  id: string;
  status: LeadStatus;
  source: LeadSource;
  intent: Enums<'lead_intent'>;
  message: string | null;
  createdAt: string;
  nextFollowUpAt: string | null;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  property: { id: string; title: string; referenceNo: string } | null;
  assignedTo: string | null;
  deletedAt: string | null;
}

export async function listLeads(ctx: OrgContext, f: LeadListFilters) {
  const q = searchTerm(f.q);
  let customerIds: string[] | undefined;
  if (q) {
    const digits = q.replace(/\D/g, '');
    const { data } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('organization_id', ctx.org.id)
      .or([`full_name.ilike.*${q}*`, `email.ilike.*${q}*`, digits.length >= 4 ? `phone_key.like.*${digits.slice(-10)}*` : null].filter(Boolean).join(','))
      .limit(200);
    customerIds = (data ?? []).map((c) => c.id);
    if (customerIds.length === 0) return { rows: [] as LeadRow[], total: 0, pageCount: 0 };
  }

  let query = ctx.supabase
    .from('leads')
    .select(
      'id, status, source, intent, message, created_at, next_follow_up_at, assigned_to, deleted_at, customer:customers(id, full_name, phone, email), property:properties(id, title, reference_no)',
      { count: 'exact' },
    )
    .eq('organization_id', ctx.org.id);
  query = f.deleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);
  if (f.status) query = query.eq('status', f.status);
  if (f.source) query = query.eq('source', f.source);
  if (f.assigned === 'me') query = query.eq('assigned_to', ctx.user.id);
  if (f.assigned === 'none') query = query.is('assigned_to', null);
  if (f.customerId && isUuid(f.customerId)) query = query.eq('customer_id', f.customerId);
  if (customerIds) query = query.in('customer_id', customerIds);

  const from = (f.page - 1) * CRM_PAGE_SIZE;
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range(from, from + CRM_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Talepler yüklenemedi: ${error.message}`);
  type Row = {
    id: string;
    status: LeadStatus;
    source: LeadSource;
    intent: Enums<'lead_intent'>;
    message: string | null;
    created_at: string;
    next_follow_up_at: string | null;
    assigned_to: string | null;
    deleted_at: string | null;
    customer: Rel<{ id: string; full_name: string; phone: string | null; email: string | null }>;
    property: Rel<{ id: string; title: string; reference_no: string }>;
  };
  const rows = ((data ?? []) as unknown as Row[]).map<LeadRow>((r) => {
    const c = one(r.customer);
    const p = one(r.property);
    return {
      id: r.id,
      status: r.status,
      source: r.source,
      intent: r.intent,
      message: r.message,
      createdAt: r.created_at,
      nextFollowUpAt: r.next_follow_up_at,
      customer: c ? { id: c.id, name: c.full_name, phone: c.phone, email: c.email } : null,
      property: p ? { id: p.id, title: p.title, referenceNo: p.reference_no } : null,
      assignedTo: r.assigned_to,
      deletedAt: r.deleted_at,
    };
  });
  const total = count ?? 0;
  return { rows, total, pageCount: Math.ceil(total / CRM_PAGE_SIZE) };
}

export async function leadStatusCounts(ctx: OrgContext): Promise<Record<LeadStatus | 'all', number>> {
  const statuses: LeadStatus[] = ['new', 'contacted', 'meeting', 'appointment', 'follow_up', 'closed', 'cancelled'];
  const base = () => ctx.supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.org.id).is('deleted_at', null);
  const results = await Promise.all([base(), ...statuses.map((s) => base().eq('status', s))]);
  const counts = { all: results[0].count ?? 0 } as Record<LeadStatus | 'all', number>;
  statuses.forEach((s, i) => (counts[s] = results[i + 1].count ?? 0));
  return counts;
}

export async function getLeadDetail(ctx: OrgContext, id: string) {
  if (!isUuid(id)) return null;
  const { data: lead } = await ctx.supabase
    .from('leads')
    .select(
      'id, organization_id, status, source, intent, message, budget_min, budget_max, currency, desired_location, details, assigned_to, next_follow_up_at, closed_at, created_at, updated_at, deleted_at, customer_id, ' +
        'customer:customers(id, full_name, phone, email, notes, kvkk_consent_at, created_at), property:properties(id, title, reference_no, slug, status, price, currency, listing_type)',
    )
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();
  if (!lead) return null;
  const l = lead as unknown as Record<string, unknown> & { customer_id: string; customer: unknown; property: unknown };
  const [activities, appointments, otherLeads] = await Promise.all([
    ctx.supabase.from('lead_activities').select('id, kind, body, metadata, created_by, created_at').eq('lead_id', id).order('created_at', { ascending: false }).limit(100),
    ctx.can('appointments.read')
      ? ctx.supabase.from('appointments').select('id, scheduled_at, status, note, property:properties(title, reference_no)').eq('lead_id', id).order('scheduled_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    ctx.supabase.from('leads').select('id, status, source, created_at').eq('customer_id', l.customer_id).neq('id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    lead: {
      ...(lead as unknown as Record<string, unknown>),
      budget_min: toNumber(l.budget_min as number | string | null),
      budget_max: toNumber(l.budget_max as number | string | null),
      customer: one(l.customer as Rel<Record<string, unknown>>),
      property: one(l.property as Rel<Record<string, unknown>>),
    } as unknown as LeadDetail,
    activities: (activities.data ?? []) as LeadActivity[],
    appointments: (appointments.data ?? []) as unknown as { id: string; scheduled_at: string; status: Enums<'appointment_status'>; note: string | null; property: Rel<{ title: string; reference_no: string }> }[],
    otherLeads: (otherLeads.data ?? []) as { id: string; status: LeadStatus; source: LeadSource; created_at: string }[],
  };
}

export interface LeadDetail {
  id: string;
  status: LeadStatus;
  source: LeadSource;
  intent: Enums<'lead_intent'>;
  message: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  desired_location: string | null;
  details: Record<string, unknown> | null;
  assigned_to: string | null;
  next_follow_up_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_id: string;
  customer: { id: string; full_name: string; phone: string | null; email: string | null; notes: string | null; kvkk_consent_at: string | null; created_at: string } | null;
  property: { id: string; title: string; reference_no: string; slug: string; status: string; price: number | null; currency: string; listing_type: 'sale' | 'rent' } | null;
}

export interface LeadActivity {
  id: number;
  kind: Enums<'lead_activity_kind'>;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: LeadSource | null;
  createdAt: string;
  leads: number;
}

export async function listCustomers(ctx: OrgContext, f: { q?: string; page: number }) {
  const q = searchTerm(f.q);
  let query = ctx.supabase
    .from('customers')
    .select('id, full_name, phone, email, source, created_at, leads:leads(count)', { count: 'exact' })
    .eq('organization_id', ctx.org.id)
    .is('deleted_at', null);
  if (q) {
    const digits = q.replace(/\D/g, '');
    query = query.or([`full_name.ilike.*${q}*`, `email.ilike.*${q}*`, digits.length >= 4 ? `phone_key.like.*${digits.slice(-10)}*` : null].filter(Boolean).join(','));
  }
  const from = (f.page - 1) * CRM_PAGE_SIZE;
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + CRM_PAGE_SIZE - 1);
  if (error && error.code !== 'PGRST103') throw new Error(`Müşteriler yüklenemedi: ${error.message}`);
  const rows = ((data ?? []) as unknown as { id: string; full_name: string; phone: string | null; email: string | null; source: LeadSource | null; created_at: string; leads: { count: number }[] }[]).map<CustomerRow>((c) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
    email: c.email,
    source: c.source,
    createdAt: c.created_at,
    leads: c.leads?.[0]?.count ?? 0,
  }));
  return { rows, total: count ?? 0, pageCount: Math.ceil((count ?? 0) / CRM_PAGE_SIZE) };
}

export async function getCustomerDetail(ctx: OrgContext, id: string) {
  if (!isUuid(id)) return null;
  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id, full_name, phone, email, notes, source, kvkk_consent_at, created_at, updated_at, deleted_at')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();
  if (!customer) return null;
  const [leads, appointments, collections] = await Promise.all([
    ctx.supabase.from('leads').select('id, status, source, intent, created_at, property:properties(title, reference_no)').eq('customer_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    ctx.can('appointments.read')
      ? ctx.supabase.from('appointments').select('id, scheduled_at, status, property:properties(title, reference_no)').eq('customer_id', id).order('scheduled_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    ctx.can('collections.manage')
      ? ctx.supabase.from('collections').select('id, title, token, view_count, created_at, revoked_at, expires_at').eq('customer_id', id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  return {
    customer,
    leads: (leads.data ?? []) as unknown as { id: string; status: LeadStatus; source: LeadSource; intent: Enums<'lead_intent'>; created_at: string; property: Rel<{ title: string; reference_no: string }> }[],
    appointments: (appointments.data ?? []) as unknown as { id: string; scheduled_at: string; status: Enums<'appointment_status'>; property: Rel<{ title: string; reference_no: string }> }[],
    collections: (collections.data ?? []) as { id: string; title: string; token: string; view_count: number; created_at: string; revoked_at: string | null; expires_at: string | null }[],
  };
}

export interface AppointmentRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: Enums<'appointment_status'>;
  note: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  property: { id: string; title: string; referenceNo: string } | null;
  leadId: string | null;
  assignedTo: string | null;
}

export async function listAppointments(ctx: OrgContext, view: 'upcoming' | 'past' | 'cancelled') {
  const now = new Date().toISOString();
  let query = ctx.supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, status, note, lead_id, assigned_to, customer:customers(id, full_name, phone), property:properties(id, title, reference_no)')
    .eq('organization_id', ctx.org.id);
  if (view === 'upcoming') query = query.in('status', ['requested', 'confirmed']).gte('scheduled_at', new Date(Date.now() - 2 * 3_600_000).toISOString()).order('scheduled_at');
  else if (view === 'past') query = query.or(`status.eq.completed,and(status.in.(requested,confirmed),scheduled_at.lt.${now})`).order('scheduled_at', { ascending: false });
  else query = query.eq('status', 'cancelled').order('scheduled_at', { ascending: false });
  const { data, error } = await query.limit(200);
  if (error) throw new Error(`Randevular yüklenemedi: ${error.message}`);
  type Row = {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: Enums<'appointment_status'>;
    note: string | null;
    lead_id: string | null;
    assigned_to: string | null;
    customer: Rel<{ id: string; full_name: string; phone: string | null }>;
    property: Rel<{ id: string; title: string; reference_no: string }>;
  };
  return ((data ?? []) as unknown as Row[]).map<AppointmentRow>((r) => {
    const c = one(r.customer);
    const p = one(r.property);
    return {
      id: r.id,
      scheduledAt: r.scheduled_at,
      durationMinutes: r.duration_minutes,
      status: r.status,
      note: r.note,
      customer: c ? { id: c.id, name: c.full_name, phone: c.phone } : null,
      property: p ? { id: p.id, title: p.title, referenceNo: p.reference_no } : null,
      leadId: r.lead_id,
      assignedTo: r.assigned_to,
    };
  });
}

/** Seçim listeleri (randevu/seçki formları): müşteriler ve ilanlar */
export async function getPickerOptions(ctx: OrgContext, { onlyPublic = false } = {}) {
  let props = ctx.supabase
    .from('properties')
    .select('id, title, reference_no, status, listing_type, price, currency')
    .eq('organization_id', ctx.org.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (onlyPublic) props = props.in('status', ['published', 'sold', 'rented']);
  const [customers, properties] = await Promise.all([
    ctx.can('leads.read')
      ? ctx.supabase.from('customers').select('id, full_name, phone').eq('organization_id', ctx.org.id).is('deleted_at', null).order('updated_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [] }),
    props,
  ]);
  return {
    customers: ((customers.data ?? []) as { id: string; full_name: string; phone: string | null }[]).map((c) => ({ id: c.id, label: c.phone ? `${c.full_name} · ${c.phone}` : c.full_name })),
    properties: ((properties.data ?? []) as { id: string; title: string; reference_no: string; status: string }[]).map((p) => ({ id: p.id, label: `${p.reference_no} · ${p.title}`, status: p.status })),
  };
}

export interface CollectionRow {
  id: string;
  title: string;
  token: string;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  customer: { id: string; name: string } | null;
  items: number;
}

export async function listCollections(ctx: OrgContext): Promise<CollectionRow[]> {
  const { data, error } = await ctx.supabase
    .from('collections')
    .select('id, title, token, view_count, last_viewed_at, created_at, expires_at, revoked_at, customer:customers(id, full_name), items:collection_items(count)')
    .eq('organization_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Seçkiler yüklenemedi: ${error.message}`);
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    token: string;
    view_count: number;
    last_viewed_at: string | null;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    customer: Rel<{ id: string; full_name: string }>;
    items: { count: number }[];
  }[]).map((c) => {
    const customer = one(c.customer);
    return {
      id: c.id,
      title: c.title,
      token: c.token,
      viewCount: c.view_count,
      lastViewedAt: c.last_viewed_at,
      createdAt: c.created_at,
      expiresAt: c.expires_at,
      revokedAt: c.revoked_at,
      customer: customer ? { id: customer.id, name: customer.full_name } : null,
      items: c.items?.[0]?.count ?? 0,
    };
  });
}

export async function getCollection(ctx: OrgContext, id: string) {
  if (!isUuid(id)) return null;
  const { data } = await ctx.supabase
    .from('collections')
    .select('id, title, message, token, customer_id, expires_at, revoked_at, view_count, created_at, items:collection_items(property_id, note, sort_order)')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();
  if (!data) return null;
  const items = ((data.items ?? []) as { property_id: string; note: string | null; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  return { ...data, items };
}
