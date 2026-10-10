import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Building2, SearchX, Users } from 'lucide-react';
import { AdminPageHeader, EmptyPanel, ListingStatusBadge, Panel } from '@/components/panel/ui';
import { formatListingPrice, formatPhoneDisplay } from '@/lib/format';
import { firstParam } from '@/lib/utils';
import type { CurrencyCode, ListingStatus, ListingType } from '@/modules/properties/constants';
import { requirePageContext } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Arama' };

/** Arama metnini PostgREST filtresine güvenle gömülebilir hâle getirir */
function clean(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s@.+-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export default async function AdminSearchPage({ searchParams }: PageProps<'/admin/ara'>) {
  const ctx = await requirePageContext('/admin/ara');
  const raw = firstParam((await searchParams).q) ?? '';
  const q = clean(raw);
  const upper = q.toLocaleUpperCase('tr-TR');
  const isReference = /^[A-Z]{2,5}-\d{4}-\d{2,}$/.test(upper);
  const digits = q.replace(/\D/g, '');

  const [propertiesRes, customersRes] = q.length >= 2
    ? await Promise.all([
        ctx.can('properties.read')
          ? ctx.supabase
              .from('properties')
              .select('id, reference_no, title, status, price, currency, listing_type, deleted_at')
              .eq('organization_id', ctx.org.id)
              .or(isReference ? `reference_no.eq.${upper}` : `title.ilike.*${q}*,reference_no.ilike.*${upper}*`)
              .order('updated_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
        ctx.can('leads.read')
          ? ctx.supabase
              .from('customers')
              .select('id, full_name, phone, email')
              .eq('organization_id', ctx.org.id)
              .is('deleted_at', null)
              .or(
                [`full_name.ilike.*${q}*`, q.includes('@') ? `email.ilike.*${q}*` : null, digits.length >= 4 ? `phone_key.like.*${digits.slice(-10)}*` : null]
                  .filter(Boolean)
                  .join(','),
              )
              .order('updated_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  const properties = (propertiesRes.data ?? []) as {
    id: string;
    reference_no: string;
    title: string;
    status: ListingStatus;
    price: number | null;
    currency: CurrencyCode;
    listing_type: ListingType;
    deleted_at: string | null;
  }[];
  const customers = (customersRes.data ?? []) as { id: string; full_name: string; phone: string | null; email: string | null }[];
  const nothing = q.length >= 2 && properties.length === 0 && customers.length === 0;

  return (
    <>
      <AdminPageHeader title="Arama" description={q ? `“${q}” için sonuçlar` : 'İlan numarası, başlık, müşteri adı, telefon veya e-posta ile arayın.'} />
      {q.length < 2 ? (
        <Panel>
          <EmptyPanel icon={SearchX} title="Aramak için en az 2 karakter yazın" />
        </Panel>
      ) : nothing ? (
        <Panel>
          <EmptyPanel icon={SearchX} title="Sonuç bulunamadı" description="Farklı bir kelime veya ilan numarasıyla tekrar deneyin." />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {ctx.can('properties.read') && (
            <Panel title={`İlanlar (${properties.length})`} bodyClassName="p-0 sm:p-0">
              {properties.length === 0 ? (
                <EmptyPanel icon={Building2} title="Eşleşen ilan yok" />
              ) : (
                <ul className="divide-y divide-border">
                  {properties.map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/ilanlar/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted/60 sm:px-6">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{p.title}</span>
                          <span className="numeric mt-0.5 block text-[12.5px] text-muted-foreground">
                            {p.reference_no} · {formatListingPrice(p.price, p.currency, p.listing_type)}
                          </span>
                        </span>
                        <ListingStatusBadge status={p.status} deleted={Boolean(p.deleted_at)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
          {ctx.can('leads.read') && (
            <Panel title={`Müşteriler (${customers.length})`} bodyClassName="p-0 sm:p-0">
              {customers.length === 0 ? (
                <EmptyPanel icon={Users} title="Eşleşen müşteri yok" />
              ) : (
                <ul className="divide-y divide-border">
                  {customers.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={ctx.plan.features.crm ? `/admin/musteriler/${c.id}` : `/admin/talepler?musteri=${c.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted/60 sm:px-6"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{c.full_name}</span>
                          <span className="numeric mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                            {[c.phone ? formatPhoneDisplay(c.phone) : null, c.email].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
