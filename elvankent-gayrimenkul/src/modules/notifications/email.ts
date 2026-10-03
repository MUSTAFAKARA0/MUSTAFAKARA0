import 'server-only';
import { serverEnv } from '@/lib/server-env';

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type EmailResult = { ok: true; provider: string; id: string | null } | { ok: false; provider: string; error: string; skipped?: boolean };

/**
 * E-posta sağlayıcı soyutlaması. Sağlayıcı değiştirmek için yalnızca bu dosyaya
 * yeni bir gönderici eklenir; bildirim modülleri değişmez.
 *
 *   EMAIL_PROVIDER=resend → Resend HTTP API (RESEND_API_KEY, EMAIL_FROM)
 *   EMAIL_PROVIDER=log    → yalnızca geliştirme: konu ve alıcı sayısı loglanır, içerik yazılmaz
 *   EMAIL_PROVIDER=none   → gönderilmez (varsayılan)
 *
 * Gönderici alan adında SPF, DKIM (ve önerilen DMARC) kayıtları Resend panelinden
 * alınıp DNS'e eklenmelidir; aksi halde e-postalar spam'e düşer veya reddedilir.
 */
export function emailProviderName(): string {
  return serverEnv.email.provider;
}

export function isEmailConfigured(): boolean {
  const { provider, resendApiKey, from } = serverEnv.email;
  if (provider === 'log') return true;
  if (provider === 'resend') return Boolean(resendApiKey && from);
  return false;
}

async function sendWithResend(message: EmailMessage): Promise<EmailResult> {
  const { resendApiKey, resendApiBase, from, replyTo } = serverEnv.email;
  try {
    const res = await fetch(`${resendApiBase}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...((message.replyTo ?? replyTo) ? { reply_to: message.replyTo ?? replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
    if (!res.ok) return { ok: false, provider: 'resend', error: `HTTP ${res.status}${body?.name ? ` ${body.name}` : ''}`.slice(0, 200) };
    return { ok: true, provider: 'resend', id: body?.id ?? null };
  } catch (error) {
    return { ok: false, provider: 'resend', error: error instanceof Error ? error.name : 'network_error' };
  }
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = serverEnv.email.provider;
  if (message.to.length === 0) return { ok: false, provider, error: 'no_recipients', skipped: true };
  if (!isEmailConfigured()) return { ok: false, provider, error: 'not_configured', skipped: true };
  if (provider === 'log') {
    console.info(`[email:log] "${message.subject}" → ${message.to.length} alıcı`);
    return { ok: true, provider: 'log', id: null };
  }
  return sendWithResend(message);
}
