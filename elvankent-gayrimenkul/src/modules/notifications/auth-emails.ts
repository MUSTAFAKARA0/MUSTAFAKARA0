import 'server-only';
import { sendEmail, type EmailMessage, type EmailResult } from '@/modules/notifications/email';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Şifre sıfırlama e-postası (FAZ 0). Supabase Auth'un kendi e-posta servisi yerine KARAY'ın e-posta
 * sağlayıcısıyla gönderilir: aynı sağlayıcı, aynı gönderici kimliği; Supabase tarafında ayrı SMTP
 * ve her özel alan adı için ayrı "Redirect URL" tanımı gerekmez. Bağlantı yalnızca gövdededir
 * (konuda yok); süresi Supabase Auth'un e-posta bağlantısı süresidir (varsayılan 1 saat).
 */
export function buildPasswordResetEmail(input: { link: string; platform: boolean }): Omit<EmailMessage, 'to'> {
  const product = input.platform ? 'KARAY platform' : 'Yönetim paneli';
  const subject = `${product} şifre yenileme`;
  const intro = `${product} hesabınız için şifre yenileme istendi. Yeni şifrenizi belirlemek için aşağıdaki bağlantıyı kullanın.`;
  const note = 'Bağlantı tek kullanımlıktır ve kısa süre geçerlidir. Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz; şifreniz değişmez.';
  const text = [intro, '', `Şifremi yenile: ${input.link}`, '', note].join('\n');
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1d2321">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #dfe3e1">
<tr><td style="padding:20px 24px 8px;font-size:18px;font-weight:bold">${escapeHtml(subject)}</td></tr>
<tr><td style="padding:0 24px 12px;font-size:14px;line-height:1.5;color:#3d4643">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:8px 24px 16px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#0e4d45;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:10px">Şifremi yenile</a></td></tr>
<tr><td style="padding:0 24px 24px;font-size:12.5px;line-height:1.5;color:#5d6763">${escapeHtml(note)}</td></tr>
</table>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** sendPasswordReset: tek alıcıya; aynı bağlantı için yeniden denemede çift e-posta gitmez */
export function sendPasswordResetEmail(to: string, input: { link: string; platform: boolean; idempotencyKey: string }): Promise<EmailResult> {
  return sendEmail({ ...buildPasswordResetEmail(input), to: [to] }, { idempotencyKey: input.idempotencyKey });
}
