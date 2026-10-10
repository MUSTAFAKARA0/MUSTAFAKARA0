import 'server-only';
import { formatDateTime } from '@/lib/format';
import type { EmailMessage } from '@/modules/notifications/email';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Sahip davet e-postası (P0.4). Bağlantı yalnızca gövdede bulunur; konu satırında token veya
 * bağlantı yoktur (bildirim önizlemeleri / posta sunucusu logları). Şifre içermez.
 */
export function buildInvitationEmail(input: { organizationName: string; link: string; expiresAt: string }): Omit<EmailMessage, 'to'> {
  const subject = `${input.organizationName} yönetim paneli hesabınız hazır`;
  const until = formatDateTime(input.expiresAt);
  const intro = `${input.organizationName} için yönetim paneli hesabınız oluşturuldu. Hesabınızı etkinleştirmek ve şifrenizi belirlemek için aşağıdaki bağlantıyı kullanın.`;
  const note = `Bağlantı tek kullanımlıktır ve ${until} tarihine kadar geçerlidir. Bu daveti siz beklemiyorsanız e-postayı yok sayabilirsiniz.`;
  const text = ['KARAY\'a hoş geldiniz.', '', intro, '', `Hesabımı etkinleştir: ${input.link}`, '', note].join('\n');
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1d2321">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #dfe3e1">
<tr><td style="padding:20px 24px 8px;font-size:18px;font-weight:bold">KARAY'a hoş geldiniz</td></tr>
<tr><td style="padding:0 24px 12px;font-size:14px;line-height:1.5;color:#3d4643">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:8px 24px 16px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#0e4d45;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Hesabımı etkinleştir</a></td></tr>
<tr><td style="padding:0 24px 24px;font-size:12.5px;line-height:1.5;color:#5d6763">${escapeHtml(note)}</td></tr>
</table>
</td></tr></table></body></html>`;
  return { subject, text, html };
}
