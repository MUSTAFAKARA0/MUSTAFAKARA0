import { toCsv } from '@/modules/export/csv';
import { LEAD_INTENT_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '@/modules/crm/constants';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS, STATUS_LABELS } from '@/modules/properties/constants';
import { logSecurityEvent } from '@/platform/audit';
import { getOrgContext, type OrgContext } from '@/platform/auth/session';
import type { Permission } from '@/platform/auth/permissions';
import { getRequestFingerprint } from '@/lib/request';
import { one } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_ROWS = 10_000;
const PAGE = 1000;

type Entity = 'ilanlar' | 'musteriler' | 'talepler';
type Column = { key: string; label: string };
type Named = { name: string } | { name: string }[] | null;

const ENTITY_PERMISSION: Record<Entity, Permission> = {
  ilanlar: 'properties.read',
  musteriler: 'leads.read',
  talepler: 'leads.read',
};

const COLUMNS: Record<Entity, Column[]> = {
  ilanlar: [
    { key: 'reference_no', label: 'İlan no' },
    { key: 'title', label: 'Başlık' },
    { key: 'status', label: 'Durum' },
    { key: 'listing_type', label: 'İlan türü' },
    { key: 'category', label: 'Kategori' },
    { key: 'property_type', label: 'Emlak tipi' },
    { key: 'price', label: 'Fiyat' },
    { key: 'currency', label: 'Para birimi' },
    { key: 'city', label: 'İl' },
    { key: 'district', label: 'İlçe' },
    { key: 'neighborhood', label: 'Mahalle' },
    { key: 'gross_m2', label: 'Brüt m²' },
    { key: 'net_m2', label: 'Net m²' },
    { key: 'rooms_label', label: 'Oda' },
    { key: 'building_age', label: 'Bina yaşı' },
    { key: 'floor', label: 'Kat' },
    { key: 'is_demo', label: 'Demo' },
    { key: 'in_trash', label: 'Çöp kutusunda' },
    { key: 'slug', label: 'Adres' },
    { key: 'published_at', label: 'Yayın tarihi' },
    { key: 'created_at', label: 'Oluşturulma' },
    { key: 'updated_at', label: 'Güncellenme' },
  ],
  musteriler: [
    { key: 'full_name', label: 'Ad soyad' },
    { key: 'phone', label: 'Telefon' },
    { key: 'email', label: 'E-posta' },
    { key: 'source', label: 'Kaynak' },
    { key: 'notes', label: 'Notlar' },
    { key: 'kvkk_consent_at', label: 'KVKK onayı' },
    { key: 'created_at', label: 'Kayıt tarihi' },
  ],
  talepler: [
    { key: 'created_at', label: 'Tarih' },
    { key: 'status', label: 'Durum' },
    { key: 'source', label: 'Kaynak' },
    { key: 'intent', label: 'Talep türü' },
    { key: 'customer_name', label: 'Müşteri' },
    { key: 'customer_phone', label: 'Telefon' },
    { key: 'customer_email', label: 'E-posta' },
    { key: 'property_ref', label: 'İlan no' },
    { key: 'property_title', label: 'İlan' },
    { key: 'message', label: 'Mesaj' },
    { key: 'budget_min', label: 'Bütçe (en az)' },
    { key: 'budget_max', label: 'Bütçe (en fazla)' },
    { key: 'desired_location', label: 'İstenen bölge' },
    { key: 'next_follow_up_at', label: 'Sonraki takip' },
    { key: 'closed_at', label: 'Kapanış' },
  ],
};

async function fetchAll<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function loadRows(ctx: OrgContext, entity: Entity): Promise<Record<string, unknown>[]> {
  const db = ctx.supabase;
  if (entity === 'ilanlar') {
    const rows = await fetchAll((from, to) =>
      db
        .from('properties')
        .select(
          'reference_no, title, status, listing_type, category, price, currency, gross_m2, net_m2, rooms_label, building_age, floor, is_demo, deleted_at, slug, published_at, created_at, updated_at, type:property_types(name), city:cities(name), district:districts(name), neighborhood:neighborhoods(name)',
        )
        .eq('organization_id', ctx.org.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
    return rows.map((r) => ({
      ...r,
      status: STATUS_LABELS[r.status] ?? r.status,
      listing_type: LISTING_TYPE_LABELS[r.listing_type] ?? r.listing_type,
      category: CATEGORY_LABELS[r.category] ?? r.category,
      property_type: one(r.type as Named)?.name ?? null,
      city: one(r.city as Named)?.name ?? null,
      district: one(r.district as Named)?.name ?? null,
      neighborhood: one(r.neighborhood as Named)?.name ?? null,
      is_demo: r.is_demo ? 'Evet' : 'Hayır',
      in_trash: r.deleted_at ? 'Evet' : 'Hayır',
      slug: `/ilan/${r.slug}`,
    }));
  }
  if (entity === 'musteriler') {
    return fetchAll((from, to) =>
      db
        .from('customers')
        .select('full_name, phone, email, source, notes, kvkk_consent_at, created_at')
        .eq('organization_id', ctx.org.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }
  type Person = { full_name: string; phone: string | null; email: string | null };
  type Prop = { reference_no: string; title: string };
  const rows = await fetchAll((from, to) =>
    db
      .from('leads')
      .select(
        'created_at, status, source, intent, message, budget_min, budget_max, desired_location, next_follow_up_at, closed_at, customer:customers(full_name, phone, email), property:properties(reference_no, title)',
      )
      .eq('organization_id', ctx.org.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
  return rows.map((r) => {
    const c = one(r.customer as Person | Person[] | null);
    const p = one(r.property as Prop | Prop[] | null);
    return {
      ...r,
      status: LEAD_STATUS_LABELS[r.status] ?? r.status,
      source: LEAD_SOURCE_LABELS[r.source] ?? r.source,
      intent: r.intent ? (LEAD_INTENT_LABELS[r.intent] ?? r.intent) : null,
      customer_name: c?.full_name ?? null,
      customer_phone: c?.phone ?? null,
      customer_email: c?.email ?? null,
      property_ref: p?.reference_no ?? null,
      property_title: p?.title ?? null,
    };
  });
}

/**
 * Veri dışa aktarma (CSV/JSON): ilanlar, müşteriler, talepler. `data.export`
 * yetkisi ve ilgili okuma yetkisi gerekir; veriler RLS'e tabi oturum
 * istemcisiyle ve yalnızca aktif organizasyondan okunur. Her dışa aktarma
 * denetim kaydına yazılır.
 */
export async function GET(request: Request, { params }: RouteContext<'/api/admin/export/[entity]'>) {
  // Başka sitelerden tetiklenen indirmeler reddedilir
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Forbidden', { status: 403 });
  const ctx = await getOrgContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  const { entity } = (await params) as { entity: Entity };
  if (!(entity in COLUMNS)) return new Response('Not found', { status: 404 });
  const format = new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'csv';
  if (!ctx.can('data.export') || !ctx.can(ENTITY_PERMISSION[entity])) {
    await logSecurityEvent({ orgId: ctx.org.id, action: 'auth.forbidden', actorId: ctx.user.id, metadata: { permission: 'data.export', entity } });
    return new Response('Forbidden', { status: 403 });
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await loadRows(ctx, entity);
  } catch {
    console.error('[export] failed', { entity });
    return new Response('Dışa aktarma başarısız oldu. Lütfen tekrar deneyin.', { status: 500 });
  }
  const { ipHash } = await getRequestFingerprint();
  await logSecurityEvent({
    orgId: ctx.org.id,
    action: 'data.exported',
    actorId: ctx.user.id,
    targetType: entity,
    targetLabel: `${rows.length} kayıt (${format.toUpperCase()})`,
    metadata: { entity, format, rows: rows.length, truncated: rows.length >= MAX_ROWS },
    ipHash,
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${ctx.org.slug}-${entity}-${date}.${format}`;
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Content-Type-Options': 'nosniff',
  };
  if (format === 'json') {
    const columns = COLUMNS[entity];
    const body = rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? null])));
    return new Response(JSON.stringify({ entity, exported_at: new Date().toISOString(), count: body.length, rows: body }, null, 2), {
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  return new Response(toCsv(COLUMNS[entity], rows), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } });
}
