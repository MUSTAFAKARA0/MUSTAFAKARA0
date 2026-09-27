import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, Mail, Phone, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { ActionButton, AutoSaveSelect } from '@/components/admin/action-controls';
import { ActivityComposer, FollowUpControl, NewAppointmentDialog } from '@/components/admin/crm/lead-controls';
import { AdminPageHeader, Panel } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { setLeadDeleted, updateLead } from '@/app/actions/admin-crm';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDate, formatDateTime, formatListingPrice, formatNumber, formatPhoneDisplay, formatRelativeDate } from '@/lib/format';
import { one } from '@/lib/utils';
import { getLeadDetail, getMembers, getPickerOptions } from '@/modules/crm/admin-queries';
import {
  ACTIVITY_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  LEAD_INTENT_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  LEAD_STATUSES,
} from '@/modules/crm/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Talep' };

const DETAIL_LABELS: Record<string, string> = {
  kind: 'Form',
  valuation_location: 'Değerleme konumu',
  valuation_m2: 'Brüt alan (m²)',
  valuation_rooms: 'Oda',
  valuation_age: 'Bina yaşı',
  valuation_condition: 'Durum',
  appointment_at: 'İstenen randevu',
};

export default async function LeadDetailPage({ params }: PageProps<'/admin/talepler/[id]'>) {
  const ctx = await requirePagePermission('leads.read');
  const { id } = await params;
  const [detail, members] = await Promise.all([getLeadDetail(ctx, id), getMembers(ctx)]);
  if (!detail) notFound();
  const { lead, activities, appointments, otherLeads } = detail;
  const customer = lead.customer;
  const canUpdate = ctx.can('leads.update') && !lead.deleted_at;
  const canAppointments = ctx.plan.features.crm && ctx.can('appointments.manage');
  const picker = canAppointments ? await getPickerOptions(ctx) : { customers: [], properties: [] };
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const tel = telHref(customer?.phone);
  const whatsapp = whatsappHref(customer?.phone, `Merhaba ${customer?.full_name?.split(' ')[0] ?? ''}, ${ctx.org.name} olarak talebiniz hakkında yazıyoruz.`);
  const details = Object.entries(lead.details ?? {}).filter(([k, v]) => DETAIL_LABELS[k] && v !== null && v !== '' && k !== 'kind');

  return (
    <>
      <AdminPageHeader
        back={{ href: '/admin/talepler', label: 'Talepler' }}
        title={customer?.full_name ?? 'Talep'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={LEAD_STATUS_TONES[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            {LEAD_SOURCE_LABELS[lead.source]} · {formatDateTime(lead.created_at)}
            {lead.deleted_at && <Badge variant="danger">Silindi</Badge>}
          </span>
        }
        actions={
          <>
            {tel && (
              <Button asChild variant="outline" size="sm">
                <a href={tel}>
                  <Phone /> Ara
                </a>
              </Button>
            )}
            {whatsapp && (
              <Button asChild variant="whatsapp" size="sm">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              </Button>
            )}
            {customer?.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${customer.email}`}>
                  <Mail /> E-posta
                </a>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Talep">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {lead.intent && (
                <div>
                  <dt className="text-[12.5px] font-semibold text-muted-foreground">Talep türü</dt>
                  <dd className="mt-0.5 text-[14.5px]">{LEAD_INTENT_LABELS[lead.intent]}</dd>
                </div>
              )}
              {(lead.budget_min || lead.budget_max) && (
                <div>
                  <dt className="text-[12.5px] font-semibold text-muted-foreground">Bütçe</dt>
                  <dd className="numeric mt-0.5 text-[14.5px]">
                    {[lead.budget_min, lead.budget_max].map((v) => (v ? `${formatNumber(v)} ₺` : '—')).join(' – ')}
                  </dd>
                </div>
              )}
              {lead.desired_location && (
                <div>
                  <dt className="text-[12.5px] font-semibold text-muted-foreground">İstenen bölge</dt>
                  <dd className="mt-0.5 text-[14.5px]">{lead.desired_location}</dd>
                </div>
              )}
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12.5px] font-semibold text-muted-foreground">{DETAIL_LABELS[k]}</dt>
                  <dd className="mt-0.5 text-[14.5px]">{k === 'appointment_at' ? formatDateTime(String(v)) : String(v)}</dd>
                </div>
              ))}
            </dl>
            {lead.message && (
              <blockquote className="mt-5 rounded-xl bg-surface-muted p-4 text-[14.5px] leading-relaxed whitespace-pre-line text-foreground/90">{lead.message}</blockquote>
            )}
            {lead.property && (
              <Link
                href={`/admin/ilanlar/${lead.property.id}`}
                className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-border p-4 transition hover:border-border-strong"
              >
                <span className="min-w-0">
                  <span className="numeric block text-[12.5px] font-semibold text-muted-foreground">{lead.property.reference_no}</span>
                  <span className="block truncate text-[14.5px] font-semibold">{lead.property.title}</span>
                </span>
                <span className="numeric shrink-0 text-[14px] font-semibold">
                  {formatListingPrice(lead.property.price, lead.property.currency as 'TRY', lead.property.listing_type)}
                </span>
              </Link>
            )}
          </Panel>

          <Panel title="Görüşme geçmişi" description="Aramalar, yazışmalar ve notlar. Durum değişiklikleri otomatik kaydedilir.">
            {canUpdate && (
              <div className="mb-6">
                <ActivityComposer leadId={lead.id} />
              </div>
            )}
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
            ) : (
              <ol className="space-y-4 border-l border-border pl-5">
                {activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <p className="text-[13px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{ACTIVITY_KIND_LABELS[a.kind]}</span> ·{' '}
                      {a.created_by ? (memberName.get(a.created_by) ?? 'Ekip üyesi') : 'Sistem'} · {formatDateTime(a.created_at)}
                    </p>
                    {a.kind === 'status_change' && a.metadata ? (
                      <p className="mt-0.5 text-[14px]">
                        {LEAD_STATUS_LABELS[a.metadata.from as keyof typeof LEAD_STATUS_LABELS] ?? String(a.metadata.from)} →{' '}
                        <strong>{LEAD_STATUS_LABELS[a.metadata.to as keyof typeof LEAD_STATUS_LABELS] ?? String(a.metadata.to)}</strong>
                      </p>
                    ) : (
                      a.body && <p className="mt-0.5 text-[14px] leading-relaxed whitespace-pre-line">{a.body}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Takip">
            <div className="space-y-4">
              <AutoSaveSelect
                label="Durum"
                value={lead.status}
                options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
                onSave={async (v) => {
                  'use server';
                  return updateLead(lead.id, { status: v as (typeof LEAD_STATUSES)[number] });
                }}
                disabled={!canUpdate}
              />
              <AutoSaveSelect
                label="Sorumlu"
                value={lead.assigned_to}
                options={members.map((m) => ({ value: m.id, label: m.name }))}
                allowEmpty
                emptyLabel="Atanmadı"
                onSave={async (v) => {
                  'use server';
                  return updateLead(lead.id, { assigned_to: v });
                }}
                disabled={!canUpdate}
              />
              <FollowUpControl leadId={lead.id} value={lead.next_follow_up_at} disabled={!canUpdate} />
              {lead.closed_at && <p className="text-[12.5px] text-muted-foreground">Kapanış: {formatDateTime(lead.closed_at)}</p>}
            </div>
          </Panel>

          <Panel
            title="Müşteri"
            actions={
              ctx.plan.features.crm &&
              customer && (
                <Link href={`/admin/musteriler/${customer.id}`} className="text-[13px] font-semibold text-primary-ink hover:underline">
                  Profil
                </Link>
              )
            }
          >
            {customer && (
              <dl className="space-y-3 text-[14px]">
                {customer.phone && (
                  <div>
                    <dt className="text-[12.5px] font-semibold text-muted-foreground">Telefon</dt>
                    <dd className="numeric">{formatPhoneDisplay(customer.phone)}</dd>
                  </div>
                )}
                {customer.email && (
                  <div>
                    <dt className="text-[12.5px] font-semibold text-muted-foreground">E-posta</dt>
                    <dd className="break-all">{customer.email}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[12.5px] font-semibold text-muted-foreground">Kayıt</dt>
                  <dd>{formatDate(customer.created_at)}</dd>
                </div>
                {customer.kvkk_consent_at && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-success">
                    <ShieldCheck className="size-4" aria-hidden /> KVKK aydınlatma onayı: {formatDate(customer.kvkk_consent_at)}
                  </p>
                )}
              </dl>
            )}
            {otherLeads.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[12.5px] font-semibold text-muted-foreground">Diğer talepleri</p>
                <ul className="mt-2 space-y-1.5">
                  {otherLeads.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/talepler/${o.id}`} className="flex items-center justify-between gap-2 text-[13.5px] hover:underline">
                        <span>{LEAD_SOURCE_LABELS[o.source]} · {formatRelativeDate(o.created_at)}</span>
                        <Badge variant={LEAD_STATUS_TONES[o.status]}>{LEAD_STATUS_LABELS[o.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {ctx.plan.features.crm && ctx.can('appointments.read') && (
            <Panel
              title="Randevular"
              actions={
                canAppointments &&
                canUpdate &&
                customer && (
                  <NewAppointmentDialog
                    customers={picker.customers}
                    properties={picker.properties}
                    members={members}
                    defaults={{ customerId: customer.id, propertyId: lead.property?.id ?? null, leadId: lead.id }}
                    triggerLabel="Ekle"
                  />
                )
              }
            >
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Randevu yok.</p>
              ) : (
                <ul className="space-y-3">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-[13.5px]">
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="numeric block font-semibold">{formatDateTime(a.scheduled_at)}</span>
                        <span className="block truncate text-muted-foreground">{one(a.property)?.title ?? 'Genel görüşme'}</span>
                      </span>
                      <Badge variant={APPOINTMENT_STATUS_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {ctx.can('leads.delete') && (
            <div className="flex justify-end">
              {lead.deleted_at ? (
                <ActionButton
                  action={async () => {
                    'use server';
                    return setLeadDeleted(lead.id, false);
                  }}
                >
                  <Undo2 /> Geri yükle
                </ActionButton>
              ) : (
                <ActionButton
                  variant="danger-ghost"
                  redirectTo="/admin/talepler"
                  confirm={{ title: 'Talep silinsin mi?', description: 'Talep listeden kaldırılır; “Silinenler” sekmesinden geri yüklenebilir.', confirmLabel: 'Sil' }}
                  action={async () => {
                    'use server';
                    return setLeadDeleted(lead.id, true);
                  }}
                >
                  <Trash2 /> Talebi sil
                </ActionButton>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
