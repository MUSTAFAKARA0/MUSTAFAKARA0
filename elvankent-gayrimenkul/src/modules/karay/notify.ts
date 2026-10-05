import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/modules/notifications/email';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Yeni KARAY talebi → Platform › KARAY ayarları'ndaki bildirim adreslerine e-posta.
 * Adres yoksa veya e-posta sağlayıcısı yapılandırılmamışsa sessizce atlanır (talep yine
 * de Platform › KARAY talepleri ekranındadır). Kiracı bildirimlerinden tamamen ayrıdır.
 */
export async function notifyPlatformLead(leadId: string): Promise<void> {
  const service = createServiceClient();
  if (!service) return;
  const [{ data: settings }, { data: lead }] = await Promise.all([
    service.from('platform_settings').select('lead_notify_emails').eq('id', true).maybeSingle(),
    service.from('platform_leads').select('kind, full_name, email, phone, company, city, message').eq('id', leadId).maybeSingle(),
  ]);
  const to = settings?.lead_notify_emails ?? [];
  if (!lead || to.length === 0) return;
  const kind = lead.kind === 'demo' ? 'Demo talebi' : 'Bilgi talebi';
  const rows: [string, string | null][] = [
    ['Ad soyad', lead.full_name],
    ['E-posta', lead.email],
    ['Telefon', lead.phone],
    ['Emlak ofisi', lead.company],
    ['Şehir', lead.city],
    ['Mesaj', lead.message],
  ];
  const text = `${kind}\n\n${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n\nPlatform › KARAY talepleri ekranından yanıtlayın.`;
  const html = `<p><strong>${kind}</strong></p><table>${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#5b6b85">${k}</td><td>${escapeHtml(v!)}</td></tr>`)
    .join('')}</table><p>Platform › KARAY talepleri ekranından yanıtlayın.</p>`;
  const result = await sendEmail({ to, subject: `KARAY · ${kind}: ${lead.full_name}`, text, html, replyTo: lead.email ?? undefined }, { idempotencyKey: `platform-lead/${leadId}` });
  if (!result.ok && !('skipped' in result && result.skipped)) console.warn('[karay-lead] bildirim gönderilemedi', result.error);
}
