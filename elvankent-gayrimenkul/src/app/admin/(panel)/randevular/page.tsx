import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { CalendarDays } from 'lucide-react';
import { AppointmentActions } from '@/components/admin/crm/appointment-actions';
import { NewAppointmentDialog } from '@/components/admin/crm/lead-controls';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { formatPhoneDisplay, formatTime, formatWeekday } from '@/lib/format';
import { cn, firstParam } from '@/lib/utils';
import { getMembers, getPickerOptions, listAppointments } from '@/modules/crm/admin-queries';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from '@/modules/crm/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Randevular' };

const VIEWS = [
  { value: 'upcoming', label: 'Yaklaşan' },
  { value: 'past', label: 'Geçmiş' },
  { value: 'cancelled', label: 'İptal edilen' },
] as const;

const dayKey = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayLabel = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });

export default async function AppointmentsPage({ searchParams }: PageProps<'/admin/randevular'>) {
  const ctx = await requirePagePermission('appointments.read');
  if (!ctx.plan.features.crm) {
    return (
      <>
        <AdminPageHeader title="Randevular" />
        <EmptyPanel icon={CalendarDays} title="Randevu yönetimi planınızda bulunmuyor" description="Gösterim randevularını yönetmek için planınızı yükseltin." />
      </>
    );
  }
  const requested = firstParam((await searchParams).gorunum);
  const view = VIEWS.some((v) => v.value === requested) ? (requested as (typeof VIEWS)[number]['value']) : 'upcoming';
  const canManage = ctx.can('appointments.manage');
  const [rows, members, picker] = await Promise.all([
    listAppointments(ctx, view),
    getMembers(ctx),
    canManage ? getPickerOptions(ctx) : Promise.resolve({ customers: [], properties: [] }),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = dayKey.format(new Date(r.scheduledAt));
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <>
      <AdminPageHeader
        title="Randevular"
        description="Web sitesinden gelen gösterim talepleri ve ekibinizin oluşturduğu randevular."
        actions={canManage && <NewAppointmentDialog customers={picker.customers} properties={picker.properties} members={members} triggerLabel="Yeni randevu" triggerVariant="primary" />}
      />
      <nav aria-label="Randevu görünümü" className="mb-5 flex gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === 'upcoming' ? '/admin/randevular' : `/admin/randevular?gorunum=${v.value}`}
            aria-current={v.value === view ? 'page' : undefined}
            className={cn(
              'rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition',
              v.value === view ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:bg-surface hover:text-foreground',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface">
          <EmptyPanel icon={CalendarDays} title={view === 'upcoming' ? 'Yaklaşan randevu yok' : 'Kayıt yok'} description="İlan sayfasındaki “Randevu talep et” formundan gelen talepler burada görünür." />
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([key, items]) => (
            <section key={key} aria-label={dayLabel.format(new Date(items[0].scheduledAt))} className="rounded-2xl border border-border bg-surface shadow-xs">
              <h2 className="border-b border-border px-5 py-3 text-[14px] font-bold sm:px-6">
                {dayLabel.format(new Date(items[0].scheduledAt))} <span className="font-medium text-muted-foreground">· {formatWeekday(items[0].scheduledAt)}</span>
              </h2>
              <ul className="divide-y divide-border">
                {items.map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
                    <span className="numeric w-24 shrink-0 text-[17px] font-bold">
                      {formatTime(a.scheduledAt)}
                      <span className="block text-[12px] font-medium text-muted-foreground">{a.durationMinutes} dk</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {a.customer ? (
                          <Link href={`/admin/musteriler/${a.customer.id}`} className="text-[15px] font-semibold hover:underline">
                            {a.customer.name}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-semibold">Müşteri</span>
                        )}
                        <Badge variant={APPOINTMENT_STATUS_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                      </span>
                      <span className="numeric mt-0.5 block text-[13px] text-muted-foreground">
                        {[a.customer?.phone ? formatPhoneDisplay(a.customer.phone) : null, a.property ? `${a.property.referenceNo} · ${a.property.title}` : 'Genel görüşme', a.assignedTo ? `Sorumlu: ${memberName.get(a.assignedTo) ?? '—'}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {a.note && <span className="mt-1 block text-[13.5px] text-foreground/80">{a.note}</span>}
                      {a.leadId && (
                        <Link href={`/admin/talepler/${a.leadId}`} className="mt-1 inline-block text-[12.5px] font-semibold text-primary-ink hover:underline">
                          Talebi aç
                        </Link>
                      )}
                    </span>
                    {canManage && <AppointmentActions id={a.id} status={a.status} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
