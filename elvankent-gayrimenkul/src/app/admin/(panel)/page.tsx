import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Eye,
  FilePen,
  Inbox,
  Plus,
  Sparkles,
} from 'lucide-react';
import { OnboardingChecklist } from '@/components/admin/onboarding-checklist';
import { parseOnboardingFlags } from '@/modules/platform/customer-status';
import { AreaChart, BarList } from '@/components/admin/charts';
import { Sparkline } from '@/components/panel/sparkline';
import { AdminPageHeader, EmptyPanel, ListingStatusBadge, MetricStrip, Panel, StatCard } from '@/components/panel/ui';
import { MediaImage } from '@/components/common/media-image';
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

/** Son 14 gün toplamı / önceki 14 gün toplamı - 1 (yüzde). Yetersiz veri (< 28 gün) veya önceki dönem 0 ise null: uydurma yok. */
function deltaPercent(series: number[]): number | null {
  if (series.length < 28) return null;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const last = sum(series.slice(-14));
  const prev = sum(series.slice(-28, -14));
  return prev > 0 ? ((last - prev) / prev) * 100 : null;
}

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

  // Kurulum listesi yalnızca site ayarlarını yönetebilenlere (sahip / yönetici)
  const canSetup = ctx.can('settings.manage');
  const [dashboardRes, recentRes, leadsRes, appointmentsRes, onboardingRes] = await Promise.all([
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
    canSetup ? ctx.supabase.rpc('org_onboarding', { p_org: ctx.org.id }) : Promise.resolve({ data: null, error: null }),
  ]);
  // Hata (ör. migration uygulanmamış) → liste gösterilmez; panel çalışmaya devam eder
  const checklist = canSetup && !onboardingRes.error && onboardingRes.data ? <OnboardingChecklist flags={parseOnboardingFlags(onboardingRes.data)} /> : null;

  const d = dashboardRes.data as unknown as DashboardData | null;
  const firstName = (ctx.profile.fullName ?? '').split(' ')[0];
  const p = d?.properties;

  const header = (
    <AdminPageHeader
      title={firstName ? `Merhaba, ${firstName}` : 'Dashboard'}
      breadcrumbs={[{ label: ctx.org.name }, { label: 'Dashboard' }]}
      description={`Son ${days} günün özeti`}
      actions={
        <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Dönem">
          {PERIODS.map((n) => (
            <Link
              key={n}
              href={n === 30 ? '/admin' : `/admin?gun=${n}`}
              aria-current={n === days ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold transition max-sm:min-h-11',
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
        {checklist}
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

  // Gerçek günlük seriden son 14 gün / önceki 14 gün değişimi (en az 28 günlük veri yoksa gösterilmez)
  const viewsSeries = d.daily.map((x) => Number(x.views) || 0);
  const leadsSeries = d.daily.map((x) => Number(x.leads) || 0);
  const heroCards = [
    <StatCard key="aktif" label="Aktif ilan" value={p.published} icon={CheckCircle2} tone="success" href="/admin/ilanlar?durum=published" hint={`${formatNumber(p.total)} ilan içinde`} />,
    canAnalytics ? (
      <StatCard
        key="views"
        label={`Görüntülenme (${days} gün)`}
        value={d.period.views}
        icon={Eye}
        tone="primary"
        trend={deltaPercent(viewsSeries)}
        trendLabel="son 14 gün"
        sparkline={<Sparkline values={viewsSeries} label="Günlük görüntülenme" className="w-full" width={160} height={34} />}
      />
    ) : null,
    canLeads ? (
      <StatCard
        key="leads"
        label={`İletişim talepleri (${days} gün)`}
        value={d.leads.in_period}
        icon={Inbox}
        tone="primary"
        href="/admin/talepler"
        hint={`${formatNumber(d.leads.new)} yeni · ${formatNumber(d.leads.open)} açık`}
        trend={deltaPercent(leadsSeries)}
        trendLabel="son 14 gün"
        sparkline={<Sparkline values={leadsSeries} label="Günlük talep" className="w-full" width={160} height={34} />}
      />
    ) : null,
    canAppointments ? (
      <StatCard
        key="randevu"
        label="Yaklaşan randevular"
        value={d.appointments.upcoming}
        icon={CalendarClock}
        href="/admin/randevular"
        hint={d.appointments.requested ? `${d.appointments.requested} onay bekliyor` : 'Onay bekleyen yok'}
      />
    ) : null,
    <StatCard key="taslak" label="Taslak / onay bekleyen" value={`${formatNumber(p.draft)} / ${formatNumber(p.pending)}`} icon={FilePen} tone="warning" href={p.pending > 0 ? '/admin/ilanlar?durum=pending' : '/admin/ilanlar?durum=draft'} />,
  ]
    .filter(Boolean)
    .slice(0, 4);

  return (
    <>
      {header}
      {checklist}

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-hero-kpis>
        {heroCards}
      </div>

      <div className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-2">
        <MetricStrip
          title="Portföy"
          items={[
            { label: 'Toplam ilan', value: p.total, href: '/admin/ilanlar', hint: `${p.new_in_period} yeni` },
            { label: 'Satılan / kiralanan', value: `${formatNumber(p.sold)} / ${formatNumber(p.rented)}`, href: '/admin/ilanlar?durum=sold' },
            { label: 'Taslak / onay bekleyen', value: `${formatNumber(p.draft)} / ${formatNumber(p.pending)}`, href: p.pending > 0 ? '/admin/ilanlar?durum=pending' : '/admin/ilanlar?durum=draft' },
            { label: 'Öne çıkan', value: p.featured, href: '/admin/ilanlar?durum=published' },
          ]}
        />
        {canAnalytics && (
          <MetricStrip
            title={`Etkileşim · son ${days} gün`}
            items={[
              { label: 'Favoriler', value: d.period.favorites, hint: `Toplam ${formatNumber(d.totals.favorites)}` },
              { label: 'WhatsApp tıklaması', value: d.period.whatsapp_clicks, hint: `Toplam ${formatNumber(d.totals.whatsapp_clicks)}` },
              { label: 'Telefon tıklaması', value: d.period.phone_clicks, hint: `Toplam ${formatNumber(d.totals.phone_clicks)}` },
              { label: 'Tekil ziyaretçi', value: d.period.unique_visitors },
            ]}
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
