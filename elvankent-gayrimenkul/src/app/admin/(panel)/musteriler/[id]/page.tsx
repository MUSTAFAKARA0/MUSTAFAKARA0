import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { notFound } from 'next/navigation';
import { Mail, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { ActionButton } from '@/components/panel/action-controls';
import { CustomerEditForm } from '@/components/admin/crm/customer-form';
import { AdminPageHeader, Panel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { setCustomerDeleted } from '@/app/actions/admin-crm';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDate, formatDateTime, formatRelativeDate } from '@/lib/format';
import { one } from '@/lib/utils';
import { getCustomerDetail } from '@/modules/crm/admin-queries';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES, LEAD_INTENT_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from '@/modules/crm/constants';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Müşteri' };

export default async function CustomerDetailPage({ params }: PageProps<'/admin/musteriler/[id]'>) {
  const ctx = await requirePagePermission('leads.read');
  const { id } = await params;
  const detail = await getCustomerDetail(ctx, id);
  if (!detail) notFound();
  const { customer, leads, appointments, collections } = detail;
  const tel = telHref(customer.phone);
  const wa = whatsappHref(customer.phone, `Merhaba ${customer.full_name.split(' ')[0]},`);

  return (
    <>
      <AdminPageHeader
        back={{ href: '/admin/musteriler', label: 'Müşteriler' }}
        title={customer.full_name}
        description={`Kayıt: ${formatDate(customer.created_at)}${customer.source ? ` · ${LEAD_SOURCE_LABELS[customer.source]}` : ''}`}
        actions={
          <>
            {tel && (
              <Button asChild variant="outline" size="sm">
                <a href={tel}>
                  <Phone /> Ara
                </a>
              </Button>
            )}
            {wa && (
              <Button asChild variant="whatsapp" size="sm">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              </Button>
            )}
            {customer.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${customer.email}`}>
                  <Mail /> E-posta
                </a>
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title={`Talepler (${leads.length})`} bodyClassName="p-0 sm:p-0">
            {leads.length === 0 ? (
              <p className="px-6 py-5 text-sm text-muted-foreground">Talep yok.</p>
            ) : (
              <ul className="divide-y divide-border">
                {leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/talepler/${l.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted/50 sm:px-6">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{one(l.property)?.title ?? (l.intent ? LEAD_INTENT_LABELS[l.intent] : 'Genel talep')}</span>
                        <span className="block text-[12.5px] text-muted-foreground">
                          {LEAD_SOURCE_LABELS[l.source]} · {formatRelativeDate(l.created_at)}
                        </span>
                      </span>
                      <Badge variant={LEAD_STATUS_TONES[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {appointments.length > 0 && (
            <Panel title="Randevular" bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-border">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="numeric block text-[14px] font-semibold">{formatDateTime(a.scheduled_at)}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{one(a.property)?.title ?? 'Genel görüşme'}</span>
                    </span>
                    <Badge variant={APPOINTMENT_STATUS_TONES[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {collections.length > 0 && (
            <Panel title="Paylaşılan seçkiler" bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-border">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/koleksiyonlar/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted/50 sm:px-6">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.title}</span>
                      <span className="text-[12.5px] text-muted-foreground">{c.view_count} görüntülenme</span>
                      {c.revoked_at && <Badge variant="neutral">İptal</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Bilgiler">
            <CustomerEditForm
              id={customer.id}
              initial={{ full_name: customer.full_name, phone: customer.phone, email: customer.email, notes: customer.notes }}
              disabled={!ctx.can('leads.update')}
            />
            {customer.kvkk_consent_at && (
              <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-success">
                <ShieldCheck className="size-4" aria-hidden /> KVKK aydınlatma onayı: {formatDate(customer.kvkk_consent_at)}
              </p>
            )}
          </Panel>
          {ctx.can('leads.delete') && (
            <div className="flex justify-end">
              <ActionButton
                variant="danger-ghost"
                redirectTo="/admin/musteriler"
                confirm={{ title: 'Müşteri silinsin mi?', description: 'Müşteri kaydı listeden kaldırılır. Talepler geçmişte kalır.', confirmLabel: 'Sil' }}
                action={async () => {
                  'use server';
                  return setCustomerDeleted(customer.id, true);
                }}
              >
                <Trash2 /> Müşteriyi sil
              </ActionButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
