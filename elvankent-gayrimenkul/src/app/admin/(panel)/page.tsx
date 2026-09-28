import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  FilePen,
  Heart,
  Inbox,
  KeyRound,
  Phone,
  Plus,
  Sparkles,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { AreaChart, BarList } from '@/components/admin/charts';
import { AdminPageHeader, EmptyPanel, ListingStatusBadge, Panel, StatCard } from '@/components/admin/ui';
import { MediaImage } from '@/components/gallery/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatListingPrice, formatNumber, formatRelativeDate } from '@/lib/format';
import { cn, firstParam, one } from '@/lib/utils';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from '@/modules/crm/constants';
import type { MediaSource } from '@/modules/media/variants';
import type { CurrencyCode, ListingStatus, ListingType } from '@/modules/properties/constants';
import { requirePageContext } from '@/platform/auth/session';
import type { Enums } from '@/types/supabase';

export const metadata: Metadata = { title: 'Dashboard' };

const PERIODS = [7, 30, 90] as const;

interface DashboardData {
  properties: Record<'total' | 'draft' | 'pending' | 'published' | 'sold' | 'rented' | 'archived' | 'trash' | 'featured' | 'demo' | 'new_in_period', number>;
  totals: Record<'views' | 'favorites' | 'whatsapp_clicks' | 'phone_clicks', number>;
  period: Record<'days' | 'views' | 'unique_visitors' | 'phone_clicks' | 'whatsapp_clicks' | 'favorites' | 'shares' | 'qr_visits', number>;
  leads: Record<'new' | 'open' | 'in_period', number>;
  lead_sources: { source: Enums<'lead_source'>; count: number }[];
  appointments: Record<'upcoming' | 'requested', number>;
  daily: { day: string; views: number; visitors: number; leads: number }[];
  top_viewed: { id: string; reference_no: string; title: string; slug: string; views: number }[];
  top_favorited: { id: string; reference_no: string; title: string; slug: string; favorites: number }[];
  popular_locations: { district: string | null; neighborhood: string | null; views: number }[];
}

export default async function DashboardPage({ searchParams }: PageProps<'/admin'>) {
  const ctx = await requirePageContext('/admin');
  const requested = Number(firstParam((await searchParams).gun));
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const canLeads = ctx.can('leads.read');
  const canAnalytics = ctx.can('analytics.read');
  const canAppointments = ctx.plan.features.crm && ctx.can('appointments.read');

  const [dashboardRes, recentRes, leadsRes, appointmentsRes] = await Promise.all([
    ctx.supabase.rpc('org_dashboard', { p_org: ctx.org.id, p_days: days }),
    ctx.supabase
      .from('properties')
      .select(
        'id, reference_no, title, status, price, currency, listing_type, created_at, is_demo, cover:media_assets!media_assets_property_id_fkey(public_base, legacy_path, variant_widths, width, height)',
      )
      .eq('organization_id', ctx.org.id)
      .is('deleted_at', null)
      .eq('cover.is_cover', true)
      .order('created_at', { ascending: false })
      .limit(5),
    canLeads
      ? ctx.supabase
          .from('leads')
          .select('id, status, source, created_at, customer:customers(full_name), property:properties(title, reference_no)')
          .eq('organization_id', ctx.org.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    canAppointments
      ? ctx.supabase
          .from('appointments')
          .select('id, scheduled_at, status, customer:customers(full_name), property:properties(title, reference_no)')
          .eq('organization_id', ctx.org.id)
          .in('status', ['requested', 'confirmed'])
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const d = dashboardRes.data as unknown as DashboardData | null;
  const firstName = (ctx.profile.fullName ?? '').split(' ')[0];
  const p = d?.properties;

  const header = (
    <AdminPageHeader
      title={firstName ? `Merhaba, ${firstName}` : 'Dashboard'}
      description={`${ctx.org.name} · son ${days} günün özeti`}
      actions={
        <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Dönem">
          {PERIODS.map((n) => (
            <Link
              key={n}
              href={n === 30 ? '/admin' : `/admin?gun=${n}`}
              aria-current={n === days ? 'true' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
                n === days ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {n} gün
            </Link>
          ))}
        </div>
      }
    />
  );

  if (!d || !p) {
    return (
      <>
        {header}
        <Panel>
          <EmptyPanel icon={Sparkles} title="Özet yüklenemedi" description="Sayfayı yenileyerek tekrar deneyin." />
        </Panel>
      </>
    );
  }

  const recent = (recentRes.data ?? []) as unknown as {
    id: string;
    reference_no: string;
    title: string;
    status: ListingStatus;
    price: number | null;
    currency: CurrencyCode;
    listing_type: ListingType;
    created_at: string;
    is_demo: boolean;
    cover: MediaSource[] | null;
  }[];
  const leads = (leadsRes.data ?? []) as unknown as {
    id: string;
    status: Enums<'lead_status'>;
    source: Enums<'lead_source'>;
    created_at: string;
    customer: { full_name: string } | { full_name: string }[] | null;
    property: { title: string; reference_no: string } | { title: string; reference_no: string }[] | null;
  }[];
  const appointments = (appointmentsRes.data ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    status: Enums<'appointment_status'>;
    customer: { full_name: string } | { full_name: string }[] | null;
    property: { title: string; reference_no: string } | { title: string; reference_no: string }[] | null;
  }[];

  return (
    <>
      {header}

      {p.demo > 0 && (
        <div role="note" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-5 py-3.5 text-sm text-warning">
          <p>
            <strong>{p.demo} demo ilan</strong> bulunuyor. Gerçek ilanlarınızı ekledikten sonra demo içeriği tek tıkla kaldırabilirsiniz.
          </p>
          {ctx.can('settings.manage') && (
            <Link href="/admin/ayarlar#demo" className="font-semibold underline underline-offset-2">
              Demo içeriği yönet
            </Link>
          )}
        </div>
      )}

      {p.total === 0 && ctx.can('properties.create') ? (
        <Panel className="mb-6">
          <EmptyPanel
            icon={Building2}
            title="İlk ilanınızı ekleyin"
            description="İlan sihirbazı sizi adım adım yönlendirir; yazarken otomatik kaydedilir."
            action={
              <Button asChild>
                <Link href="/admin/ilanlar/yeni">
                  <Plus /> Yeni ilan
                </Link>
              </Button>
            }
          />
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Toplam ilan"
          value={formatNumber(p.total)}
          icon={Building2}
          href="/admin/ilanlar"
          hint={`${p.new_in_period} yeni · ${p.featured} öne çıkan`}
        />
        <StatCard label="Aktif ilan" value={formatNumber(p.published)} icon={CheckCircle2} tone="success" href="/admin/ilanlar?durum=published" />
        <StatCard
          label="Satılan / kiralanan"
          value={`${formatNumber(p.sold)} / ${formatNumber(p.rented)}`}
          icon={KeyRound}
          tone="accent"
          href="/admin/ilanlar?durum=sold"
        />
        <StatCard
          label="Taslak / onay bekleyen"
          value={`${formatNumber(p.draft)} / ${formatNumber(p.pending)}`}
          icon={FilePen}
          tone="warning"
          href={p.pending > 0 ? '/admin/ilanlar?durum=pending' : '/admin/ilanlar?durum=draft'}
        />
        {canAnalytics && (
          <>
            <StatCard
              label={`Görüntülenme (${days} gün)`}
              value={formatNumber(d.period.views)}
              icon={Eye}
              tone="primary"
              hint={`${formatNumber(d.period.unique_visitors)} tekil ziyaretçi · toplam ${formatNumber(Number(d.totals.views) || 0)}`}
            />
            <StatCard label={`Favoriler (${days} gün)`} value={formatNumber(d.period.favorites)} icon={Heart} hint={`Toplam ${formatNumber(d.totals.favorites)}`} />
            <StatCard
              label={`WhatsApp tıklaması (${days} gün)`}
              value={formatNumber(d.period.whatsapp_clicks)}
              icon={WhatsAppIcon}
              hint={`Toplam ${formatNumber(d.totals.whatsapp_clicks)}`}
            />
            <StatCard label={`Telefon tıklaması (${days} gün)`} value={formatNumber(d.period.phone_clicks)} icon={Phone} hint={`Toplam ${formatNumber(d.totals.phone_clicks)}`} />
          </>
        )}
        {canLeads && (
          <StatCard
            label={`İletişim talepleri (${days} gün)`}
            value={formatNumber(d.leads.in_period)}
            icon={Inbox}
            tone="primary"
            href="/admin/talepler"
            hint={`${formatNumber(d.leads.new)} yeni · ${formatNumber(d.leads.open)} açık`}
          />
        )}
        {canAppointments && (
          <StatCard
            label="Yaklaşan randevular"
            value={formatNumber(d.appointments.upcoming)}
            icon={CalendarClock}
            href="/admin/randevular"
            hint={d.appointments.requested ? `${d.appointments.requested} onay bekliyor` : 'Onay bekleyen yok'}
          />
        )}
      </div>

      {canAnalytics && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Görüntülenme ve talepler" description="Günlük ilan görüntülenmeleri ve gelen talepler" className="xl:col-span-2">
            <AreaChart
              primary={d.daily.map((x) => ({ label: x.day, value: x.views }))}
              secondary={canLeads ? d.daily.map((x) => ({ label: x.day, value: x.leads })) : undefined}
              primaryLabel="Görüntülenme"
              secondaryLabel={canLeads ? 'Talep' : undefined}
              caption={`Son ${days} günde günlük görüntülenme${canLeads ? ' ve talep' : ''} sayıları`}
            />
          </Panel>
          <Panel title="Talep kaynakları" description={`Son ${days} gün`}>
            <BarList
              tone="accent"
              items={(canLeads ? d.lead_sources : []).map((s) => ({ key: s.source, label: LEAD_SOURCE_LABELS[s.source] ?? s.source, value: Number(s.count) }))}
              emptyText={canLeads ? 'Bu dönemde talep yok.' : 'Talepleri görüntüleme yetkiniz yok.'}
            />
          </Panel>
        </div>
      )}

      {canAnalytics && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="En çok görüntülenen ilanlar">
            <BarList items={d.top_viewed.map((t) => ({ key: t.id, label: t.title, value: Number(t.views), href: `/admin/ilanlar/${t.id}`, hint: t.reference_no }))} />
          </Panel>
          <Panel title="En çok favorilenen ilanlar">
            <BarList
              tone="accent"
              items={d.top_favorited.map((t) => ({ key: t.id, label: t.title, value: Number(t.favorites), href: `/admin/ilanlar/${t.id}`, hint: t.reference_no }))}
            />
          </Panel>
          <Panel title="Popüler konumlar" description="Görüntülenmelere göre">
            <BarList
              items={d.popular_locations.map((l, i) => ({
                key: `${l.district}-${l.neighborhood}-${i}`,
                label: [l.neighborhood, l.district].filter(Boolean).join(', ') || 'Belirtilmemiş',
                value: Number(l.views),
              }))}
            />
          </Panel>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel
          title="Son eklenen ilanlar"
          actions={
            <Link href="/admin/ilanlar" className="text-[13px] font-semibold text-primary-ink hover:underline">
              Tümü
            </Link>
          }
          bodyClassName="p-0 sm:p-0"
        >
          {recent.length === 0 ? (
            <EmptyPanel icon={Building2} title="Henüz ilan yok" />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/ilanlar/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-muted/60 sm:px-6">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                      {r.cover?.[0] && <MediaImage media={r.cover[0]} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{r.title}</span>
                      <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                        <span className="numeric">{r.reference_no}</span> · {formatRelativeDate(r.created_at)}
                        {r.is_demo && ' · Demo'}
                      </span>
                    </span>
                    <span className="hidden text-right sm:block">
                      <span className="numeric block text-[13.5px] font-semibold">{formatListingPrice(r.price, r.currency, r.listing_type)}</span>
                      <span className="mt-1 block">
                        <ListingStatusBadge status={r.status} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canLeads && (
          <Panel
            title="Son talepler"
            actions={
              <Link href="/admin/talepler" className="text-[13px] font-semibold text-primary-ink hover:underline">
                Tümü
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            {leads.length === 0 ? (
              <EmptyPanel icon={Inbox} title="Henüz talep yok" description="Sitedeki formlardan gelen talepler burada görünür." />
            ) : (
              <ul className="divide-y divide-border">
                {leads.map((l) => {
                  const property = one(l.property);
                  return (
                    <li key={l.id}>
                      <Link href={`/admin/talepler/${l.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-muted/60 sm:px-6">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{one(l.customer)?.full_name ?? 'İsimsiz'}</span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                            {LEAD_SOURCE_LABELS[l.source]}
                            {property ? ` · ${property.reference_no}` : ''} · {formatRelativeDate(l.created_at)}
                          </span>
                        </span>
                        <Badge variant={LEAD_STATUS_TONES[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {canAppointments && appointments.length > 0 && (
          <Panel title="Yaklaşan randevular" bodyClassName="p-0 sm:p-0">
            <ul className="divide-y divide-border">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                  <CalendarClock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{one(a.customer)?.full_name ?? 'Müşteri'}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{one(a.property)?.title ?? 'Genel görüşme'}</span>
                  </span>
                  <span className="numeric shrink-0 text-[13px] font-semibold">{formatDateTime(a.scheduled_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
