import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { BarChart3, Eye, Heart, Inbox, MessageCircle, Phone, QrCode, Share2, Users } from 'lucide-react';
import { AreaChart, BarList } from '@/components/admin/charts';
import { AdminPageHeader, EmptyPanel, ListingStatusBadge, Panel, StatCard, TableWrap, td, th } from '@/components/panel/ui';
import { formatNumber } from '@/lib/format';
import { cn, firstParam, one } from '@/lib/utils';
import { LEAD_SOURCE_LABELS } from '@/modules/crm/constants';
import type { ListingStatus } from '@/modules/properties/constants';
import { requirePagePermission } from '@/platform/auth/session';
import type { Enums } from '@/types/supabase';

export const metadata: Metadata = { title: 'Etkileşim analitiği' };

const PERIODS = [7, 30, 90] as const;

const SORTS = {
  goruntulenme: { column: 'view_count', label: 'Görüntülenme' },
  whatsapp: { column: 'whatsapp_click_count', label: 'WhatsApp' },
  telefon: { column: 'phone_click_count', label: 'Telefon' },
  form: { column: 'contact_form_count', label: 'Form' },
  favori: { column: 'favorite_count', label: 'Favori' },
  paylasim: { column: 'share_count', label: 'Paylaşım' },
} as const;
type SortKey = keyof typeof SORTS;

interface Period {
  period: Record<'days' | 'views' | 'unique_visitors' | 'phone_clicks' | 'whatsapp_clicks' | 'favorites' | 'shares' | 'qr_visits', number>;
  leads: Record<'new' | 'open' | 'in_period', number>;
  lead_sources: { source: Enums<'lead_source'>; count: number }[];
  daily: { day: string; views: number; visitors: number; leads: number }[];
}

type PropertyRel = { id: string; title: string; reference_no: string; status: ListingStatus; deleted_at: string | null };

const percent = (part: number, whole: number) => (whole > 0 ? `%${((part / whole) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—');

/**
 * Ziyaretçi etkileşimleri. Kişisel veri toplanmaz: olaylar yalnızca günlük
 * değişen, geri döndürülemez bir oturum özeti (hash) ile sayılır.
 */
export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analitik'>) {
  const ctx = await requirePagePermission('analytics.read');
  if (!ctx.plan.features.analytics) {
    return (
      <>
        <AdminPageHeader title="Etkileşim analitiği" />
        <Panel>
          <EmptyPanel icon={BarChart3} title="Analitik planınızda bulunmuyor" description="İlan bazında görüntülenme, WhatsApp, telefon ve favori raporları için planınızı yükseltin." />
        </Panel>
      </>
    );
  }
  const sp = await searchParams;
  const requested = Number(firstParam(sp.gun));
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const sort: SortKey = (Object.keys(SORTS) as SortKey[]).includes(firstParam(sp.sirala) as SortKey) ? (firstParam(sp.sirala) as SortKey) : 'goruntulenme';
  const canLeads = ctx.can('leads.read');

  const [periodRes, statsRes] = await Promise.all([
    ctx.supabase.rpc('org_dashboard', { p_org: ctx.org.id, p_days: days }),
    ctx.supabase
      .from('property_stats')
      .select('property_id, view_count, phone_click_count, whatsapp_click_count, contact_form_count, favorite_count, share_count, property:properties(id, title, reference_no, status, deleted_at)')
      .eq('organization_id', ctx.org.id)
      .order(SORTS[sort].column, { ascending: false })
      .order('property_id')
      .limit(50),
  ]);
  const d = periodRes.data as unknown as Period | null;
  const rows = (statsRes.data ?? []).map((r) => ({ ...r, property: one(r.property as PropertyRel | PropertyRel[] | null) })).filter((r) => r.property);
  const hrefFor = (params: { gun?: number; sirala?: SortKey }) => {
    const q = new URLSearchParams();
    const g = params.gun ?? days;
    const s = params.sirala ?? sort;
    if (g !== 30) q.set('gun', String(g));
    if (s !== 'goruntulenme') q.set('sirala', s);
    const qs = q.toString();
    return qs ? `/admin/analitik?${qs}` : '/admin/analitik';
  };

  const p = d?.period;
  const contacts = p ? Number(p.whatsapp_clicks) + Number(p.phone_clicks) : 0;

  return (
    <>
      <AdminPageHeader
        title="Etkileşim analitiği"
        description="Ziyaretçilerin ilanlarınızla nasıl etkileşime girdiği. Kişisel veri toplanmaz; tekil ziyaretçi sayısı günlük değişen anonim bir özetle hesaplanır."
        actions={
          <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="group" aria-label="Dönem">
            {PERIODS.map((n) => (
              <Link
                key={n}
                href={hrefFor({ gun: n })}
                aria-current={n === days ? 'true' : undefined}
                className={cn('rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', n === days ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:text-foreground')}
              >
                {n} gün
              </Link>
            ))}
          </div>
        }
      />

      {!d || !p ? (
        <Panel>
          <EmptyPanel icon={BarChart3} title="Veriler yüklenemedi" description="Sayfayı yenileyerek tekrar deneyin." />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="İlan görüntülenmesi" value={formatNumber(p.views)} icon={Eye} tone="primary" hint={`${formatNumber(p.unique_visitors)} tekil ziyaretçi`} />
            <StatCard label="İletişim tıklaması" value={formatNumber(contacts)} icon={MessageCircle} tone="success" hint={`WhatsApp ${formatNumber(p.whatsapp_clicks)} · telefon ${formatNumber(p.phone_clicks)} · ziyaretçilerin ${percent(contacts, Number(p.unique_visitors))}`} />
            <StatCard label="Favoriye ekleme" value={formatNumber(p.favorites)} icon={Heart} tone="accent" hint={`Paylaşım ${formatNumber(p.shares)}`} />
            {canLeads ? (
              <StatCard label="Gelen talep" value={formatNumber(d.leads.in_period)} icon={Inbox} hint={`${formatNumber(d.leads.open)} açık talep`} href="/admin/talepler" />
            ) : (
              <StatCard label="QR ile ziyaret" value={formatNumber(p.qr_visits)} icon={QrCode} />
            )}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Panel title="Günlük görüntülenme" description="İlan görüntülenmeleri ve tekil ziyaretçiler" className="xl:col-span-2">
              <AreaChart
                primary={d.daily.map((x) => ({ label: x.day, value: Number(x.views) }))}
                secondary={d.daily.map((x) => ({ label: x.day, value: Number(x.visitors) }))}
                primaryLabel="Görüntülenme"
                secondaryLabel="Tekil ziyaretçi"
                caption={`Son ${days} günde günlük görüntülenme ve tekil ziyaretçi sayıları`}
              />
            </Panel>
            <Panel title="Talepler nereden geliyor?" description={`Son ${days} gün · talep kaynağına göre`}>
              {canLeads ? (
                <BarList items={d.lead_sources.map((s) => ({ key: s.source, label: LEAD_SOURCE_LABELS[s.source] ?? s.source, value: Number(s.count) }))} />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Talepleri görüntüleme yetkiniz yok.</p>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-[13px]">
                <div>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <QrCode className="size-3.5" aria-hidden /> QR ile ziyaret
                  </dt>
                  <dd className="numeric mt-0.5 text-[15px] font-bold">{formatNumber(p.qr_visits)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Share2 className="size-3.5" aria-hidden /> Paylaşım
                  </dt>
                  <dd className="numeric mt-0.5 text-[15px] font-bold">{formatNumber(p.shares)}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </>
      )}

      <Panel
        className="mt-6"
        title="İlan bazında etkileşim"
        description="Yayına alındığından bu yana toplam sayılar (ilk 50). Sütun başlığına tıklayarak sıralayın."
        bodyClassName="p-0 sm:p-0"
      >
        {rows.length === 0 ? (
          <EmptyPanel icon={Users} title="Henüz etkileşim verisi yok" description="İlanlarınız görüntülendikçe burada ilan bazında sayılar görünür." />
        ) : (
          <TableWrap className="[&_table]:min-w-[860px]">
            <thead className="border-b border-border bg-surface-muted/50">
              <tr>
                <th className={th}>İlan</th>
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <th key={key} className={cn(th, 'text-right')} aria-sort={key === sort ? 'descending' : undefined}>
                    <Link href={hrefFor({ sirala: key })} className={cn('hover:text-foreground', key === sort && 'text-foreground underline underline-offset-4')}>
                      {SORTS[key].label}
                    </Link>
                  </th>
                ))}
                <th className={cn(th, 'text-right')} title="(WhatsApp + telefon + form) / görüntülenme">
                  İletişim oranı
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const prop = r.property!;
                const contactsTotal = r.whatsapp_click_count + r.phone_click_count + r.contact_form_count;
                return (
                  <tr key={r.property_id} className="hover:bg-surface-muted/40">
                    <td className={cn(td, 'max-w-80')}>
                      <Link href={`/admin/ilanlar/${prop.id}?adim=yayin`} className="block truncate font-semibold hover:underline" title={prop.title}>
                        {prop.title}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                        {prop.reference_no} <ListingStatusBadge status={prop.status} deleted={Boolean(prop.deleted_at)} />
                      </span>
                    </td>
                    {(Object.keys(SORTS) as SortKey[]).map((key) => (
                      <td key={key} className={cn(td, 'numeric text-right', key === sort && 'font-semibold')}>
                        {formatNumber(r[SORTS[key].column])}
                      </td>
                    ))}
                    <td className={cn(td, 'numeric text-right text-muted-foreground')}>{percent(contactsTotal, r.view_count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Phone className="size-3.5" aria-hidden /> Telefon ve WhatsApp tıklamaları, ziyaretçinin ilgili düğmeye bastığı anlamına gelir; aramanın gerçekleştiğini göstermez.
      </p>
    </>
  );
}
