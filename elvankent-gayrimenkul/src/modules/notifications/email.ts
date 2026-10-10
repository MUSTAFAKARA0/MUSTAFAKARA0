import 'server-only';
import { serverEnv } from '@/lib/server-env';

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type EmailResult =
  | { ok: true; provider: string; id: string | null; attempts?: number }
  | { ok: false; provider: string; error: string; skipped?: boolean; attempts?: number };

export interface SendOptions {
  /**
   * Aynı mantıksal gönderimin kimliği (ör. "invitation/<davet-id>/<son-gönderim>"). Yeniden
   * denemede sağlayıcıya iletilir; sağlayıcı aynı anahtarla gelen ikinci isteği yeni e-posta
   * olarak göndermez (zaman aşımından sonra yeniden denemede çift e-posta önlenir).
   */
  idempotencyKey?: string;
  /** Geçici hatalarda en fazla kaç kez daha denensin (varsayılan 2, üst sınır 3) */
  retries?: number;
}

/** Tek bir denemenin sonucu; retryable: ağ hatası, zaman aşımı, 429 veya 5xx */
type AttemptResult = { ok: true; id: string | null } | { ok: false; error: string; retryable: boolean };

/**
 * E-posta sağlayıcı arayüzü. Uygulamanın geri kalanı yalnızca sendEmail / auth-emails
 * fonksiyonlarını kullanır; sağlayıcı değiştirmek için bu dosyaya yeni bir EmailProvider
 * eklenir (ör. SES, Postmark, SMTP) ve EMAIL_PROVIDER ile seçilir.
 *
 *   EMAIL_PROVIDER=resend → Resend HTTP API (RESEND_API_KEY, EMAIL_FROM)
 *   EMAIL_PROVIDER=log    → yalnızca geliştirme: konu ve alıcı sayısı loglanır, içerik yazılmaz
 *   EMAIL_PROVIDER=none   → gönderilmez (varsayılan)
 *
 * Gönderici alan adında SPF, DKIM (ve önerilen DMARC) kayıtları sağlayıcı panelinden
 * alınıp DNS'e eklenmelidir; aksi halde e-postalar spam'e düşer veya reddedilir.
 */
export interface EmailProvider {
  readonly name: string;
  configured(): boolean;
  send(message: EmailMessage, idempotencyKey?: string): Promise<AttemptResult>;
}

const resendProvider: EmailProvider = {
  name: 'resend',
  configured() {
    return Boolean(serverEnv.email.resendApiKey && serverEnv.email.from);
  },
  async send(message, idempotencyKey) {
    const { resendApiKey, resendApiBase, from, replyTo } = serverEnv.email;
    try {
      const res = await fetch(`${resendApiBase}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {}),
        },
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
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}${body?.name ? ` ${body.name}` : ''}`.slice(0, 200), retryable: res.status === 429 || res.status >= 500 };
      }
      return { ok: true, id: body?.id ?? null };
    } catch (error) {
      // TimeoutError / TypeError (ağ) — içerik / adres loglanmaz
      return { ok: false, error: error instanceof Error ? error.name : 'network_error', retryable: true };
    }
  },
};

const logProvider: EmailProvider = {
  name: 'log',
  configured: () => true,
  async send(message) {
    console.info(`[email:log] "${message.subject}" → ${message.to.length} alıcı`);
    return { ok: true, id: null };
  },
};

const PROVIDERS: Record<string, EmailProvider> = { resend: resendProvider, log: logProvider };

function provider(): EmailProvider | null {
  return PROVIDERS[serverEnv.email.provider] ?? null;
}

export function emailProviderName(): string {
  return serverEnv.email.provider;
}

export function isEmailConfigured(): boolean {
  return provider()?.configured() ?? false;
}

/** Yeniden deneme bekleme süreleri (ms): kısa tutulur — sunucusuz istek süresi sınırlıdır */
export const RETRY_DELAYS_MS = [400, 1200, 2500] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * İşlemsel e-posta gönderir (sendTransactional). Geçici hatalarda (ağ, zaman aşımı, 429, 5xx)
 * sınırlı sayıda yeniden dener; kalıcı hatalarda (4xx: geçersiz anahtar, gönderici, alıcı)
 * hemen döner. Sonuç her durumda döner, istisna fırlatmaz.
 */
export async function sendEmail(message: EmailMessage, options: SendOptions = {}): Promise<EmailResult> {
  const name = serverEnv.email.provider;
  if (message.to.length === 0) return { ok: false, provider: name, error: 'no_recipients', skipped: true };
  const p = provider();
  if (!p || !p.configured()) return { ok: false, provider: name, error: 'not_configured', skipped: true };
  const retries = Math.max(0, Math.min(options.retries ?? 2, RETRY_DELAYS_MS.length));
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const result = await p.send(message, options.idempotencyKey);
    if (result.ok) return { ok: true, provider: p.name, id: result.id, attempts: attempt };
    if (!result.retryable || attempt > retries) return { ok: false, provider: p.name, error: result.error, attempts: attempt };
    await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
}

export const sendTransactional = sendEmail;
