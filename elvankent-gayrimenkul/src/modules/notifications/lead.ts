import 'server-only';
import { formatDateTime } from '@/lib/format';
import { serverEnv } from '@/lib/server-env';
import { createServiceClient } from '@/lib/supabase/server';
import { LEAD_INTENT_LABELS, LEAD_SOURCE_LABELS } from '@/modules/crm/constants';
import { sendEmail, type EmailMessage } from '@/modules/notifications/email';
import { tenantUrl, type Tenant } from '@/platform/tenant/tenant';

/**
 * Yeni talep bildirimi.
 *
 * Akış: web formu → submit_lead (veritabanı + CRM kaydı) → panelde "yeni talep"
 * rozeti → yanıt gönderildikten sonra (after) bu fonksiyon → e-posta →
 * notification_deliveries kaydı. Hata ziyaretçiye yansımaz; kayıt panelde kalır.
 *
 * Yeni bir kanal (ör. WhatsApp Business) eklemek için `deliver*` benzeri bir
 * fonksiyon yazılıp notification_deliveries tablosuna channel='whatsapp' ile
 * kaydedilir; talep akışı değişmez.
 */

type LeadForEmail = {
  id: string;
  source: keyof typeof LEAD_SOURCE_LABELS;
  intent: keyof typeof LEAD_INTENT_LABELS | null;
  message: string | null;
  created_at: string;
  customer: { full_name: string; phone: string | null; email: string | null } | null;
  property: { title: string; reference_no: string | null } | null;
  appointments: { scheduled_at: string }[] | null;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bildirim alıcıları: ayarlardaki adresler; yoksa şirket e-postası. */
export async function leadNotificationRecipients(orgId: string): Promise<{ enabled: boolean; emails: string[] }> {
  const db = createServiceClient();
  if (!db) return { enabled: false, emails: [] };
  const [{ data: prefs }, { data: settings }] = await Promise.all([
    db.from('organization_notification_settings').select('notify_new_lead, emails').eq('organization_id', orgId).maybeSingle(),
    db.from('organization_settings').select('email').eq('organization_id', orgId).maybeSingle(),
  ]);
  const enabled = prefs?.notify_new_lead ?? true;
  const configured = (prefs?.emails ?? []).filter((e) => EMAIL_RE.test(e));
  const emails = configured.length > 0 ? configured : settings?.email && EMAIL_RE.test(settings.email) ? [settings.email] : [];
  return { enabled, emails: [...new Set(emails.map((e) => e.toLowerCase()))].slice(0, 5) };
}

export function buildLeadEmail(tenant: Pick<Tenant, 'name' | 'baseUrl'>, lead: LeadForEmail, details: 'minimal' | 'full'): Omit<EmailMessage, 'to'> {
  const source = LEAD_SOURCE_LABELS[lead.source] ?? 'Web sitesi';
  const intent = lead.intent ? LEAD_INTENT_LABELS[lead.intent] : null;
  const appointment = lead.appointments?.[0]?.scheduled_at ?? null;
  const link = tenantUrl(tenant, `/admin/talepler/${lead.id}`);

  const rows: [string, string][] = [
    ['Kaynak', source],
    ...(intent ? ([['Talep türü', intent]] as [string, string][]) : []),
    ...(lead.property ? ([['İlan', `${lead.property.title}${lead.property.reference_no ? ` (${lead.property.reference_no})` : ''}`]] as [string, string][]) : []),
    ...(appointment ? ([['İstenen randevu', formatDateTime(appointment)]] as [string, string][]) : []),
    ['Geliş zamanı', formatDateTime(lead.created_at)],
  ];
  if (details === 'full' && lead.customer) {
    rows.push(['Ad soyad', lead.customer.full_name]);
    if (lead.customer.phone) rows.push(['Telefon', lead.customer.phone]);
    if (lead.customer.email) rows.push(['E-posta', lead.customer.email]);
    if (lead.message) rows.push(['Mesaj', lead.message.slice(0, 1000)]);
  }

  const subject = `Yeni talep: ${appointment ? 'Randevu isteği' : source}${lead.property?.reference_no ? ` · ${lead.property.reference_no}` : ''}`;
  const intro = details === 'full' ? 'Web sitenizden yeni bir talep geldi.' : 'Web sitenizden yeni bir talep geldi. Kişi bilgilerini güvenlik gereği yalnızca panelde görebilirsiniz.';
  const text = [intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Talebi açın: ${link}`, '', `— ${tenant.name}`].join('\n');
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1d2321">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #dfe3e1">
<tr><td style="padding:20px 24px 8px;font-size:18px;font-weight:bold">${escapeHtml(subject)}</td></tr>
<tr><td style="padding:0 24px 12px;font-size:14px;color:#5d6763">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5d6763;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0;white-space:pre-line">${escapeHtml(v)}</td></tr>`).join('\n')}
</table></td></tr>
<tr><td style="padding:16px 24px 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0e4d45;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Talebi panelde aç</a></td></tr>
</table>
<p style="font-size:12px;color:#8a938f;margin:12px 0 0">${escapeHtml(tenant.name)} · Bu e-posta talep bildirimi ayarlarınız nedeniyle gönderildi.</p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Yeni web talebi için bildirimleri gönderir ve sonucu kaydeder. Hiçbir zaman hata fırlatmaz. */
export async function notifyNewLead(tenant: Pick<Tenant, 'id' | 'name' | 'baseUrl'>, leadId: string): Promise<void> {
  const db = createServiceClient();
  if (!db) return;
  try {
    const { enabled, emails } = await leadNotificationRecipients(tenant.id);
    const record = (status: 'sent' | 'failed' | 'skipped', provider: string, extra: { id?: string | null; error?: string } = {}) =>
      db.from('notification_deliveries').insert({
        organization_id: tenant.id,
        channel: 'email',
        event: 'lead.created',
        lead_id: leadId,
        recipients: emails,
        status,
        provider,
        provider_message_id: extra.id ?? null,
        error: extra.error ? extra.error.slice(0, 300) : null,
      });

    if (!enabled) {
      await record('skipped', serverEnv.email.provider, { error: 'disabled' });
      return;
    }
    const { data: lead } = await db
      .from('leads')
      .select(
        'id, source, intent, message, created_at, customer:customers!leads_customer_id_fkey(full_name, phone, email), property:properties!leads_property_id_fkey(title, reference_no), appointments!appointments_lead_id_fkey(scheduled_at)',
      )
      .eq('id', leadId)
      .eq('organization_id', tenant.id)
      .maybeSingle();
    if (!lead) return;

    const message = buildLeadEmail(tenant, lead as unknown as LeadForEmail, serverEnv.email.leadDetails);
    const result = await sendEmail({ ...message, to: emails });
    if (result.ok) await record('sent', result.provider, { id: result.id });
    else await record(result.skipped ? 'skipped' : 'failed', result.provider, { error: result.error });
    if (!result.ok && !result.skipped) console.error('[notify] lead email failed', result.provider, result.error);
  } catch (error) {
    console.error('[notify] lead notification error', error instanceof Error ? error.name : 'unknown');
  }
}
