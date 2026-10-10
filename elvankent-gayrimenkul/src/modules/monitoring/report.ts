import { siteEnv } from '@/lib/site-env';

/**
 * Hata raporlama (sağlayıcıdan bağımsız, ek SDK gerektirmez).
 *
 *  1) Her hata tek satır JSON olarak loglanır → Vercel › Logs / Log Drains.
 *  2) SENTRY_DSN tanımlıysa Sentry'ye (envelope HTTP API) gönderilir.
 *  3) ERROR_WEBHOOK_URL tanımlıysa JSON gönderilir ({ text } alanı Slack/Discord
 *     uyumlu webhook'larda doğrudan mesaj olarak görünür).
 *
 * Gizlilik: istek başlıkları, çerezler, form verisi ve sorgu parametreleri
 * (ör. şifre sıfırlama kodu) ASLA gönderilmez; mesajlardaki e-posta, telefon
 * ve uzun anahtar benzeri değerler maskelenir.
 */

export interface ErrorReport {
  kind: 'server' | 'client';
  message: string;
  name?: string;
  digest?: string;
  stack?: string;
  path?: string;
  method?: string;
  routePath?: string;
  routeType?: string;
  source?: string;
}

const MAX = 1000;

export function scrub(value: string | undefined, max = MAX): string | undefined {
  if (!value) return value;
  return value
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, '[e-posta]')
    .replace(/\+?\d[\d\s()-]{8,}\d/g, '[telefon]')
    .replace(/\b(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,})\b/g, '[jwt]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[anahtar]')
    .slice(0, max);
}

/** Sorgu parametreleri ve parça (#) atılır */
export function cleanPath(path: string | undefined): string | undefined {
  if (!path) return path;
  return path.split(/[?#]/)[0].slice(0, 300);
}

// Aynı hata kısa sürede tekrar ederse dış servislere yalnızca bir kez gönderilir (log her zaman yazılır)
const recent = new Map<string, number>();
function shouldForward(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > 60_000) recent.delete(k);
  if (recent.has(key)) return false;
  recent.set(key, now);
  return recent.size < 500;
}

function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, '');
    if (!u.username || !projectId) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, publicKey: u.username };
  } catch {
    return null;
  }
}

async function toSentry(report: ErrorReport, dsn: string): Promise<void> {
  const target = parseDsn(dsn);
  if (!target) return;
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: report.kind === 'client' ? 'javascript' : 'node',
    level: 'error',
    environment: siteEnv(),
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    transaction: report.routePath ?? report.path,
    tags: { kind: report.kind, route_type: report.routeType, digest: report.digest },
    request: report.path ? { url: report.path, method: report.method } : undefined,
    exception: { values: [{ type: report.name ?? 'Error', value: report.message, stacktrace: undefined }] },
    extra: report.stack ? { stack: report.stack } : undefined,
  };
  const body = [JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
  await fetch(target.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=emlak-platform/1.0`,
    },
    body,
    signal: AbortSignal.timeout(4000),
  });
}

async function toWebhook(report: ErrorReport, webhook: string): Promise<void> {
  const text = `[${siteEnv()}] ${report.kind === 'client' ? 'Tarayıcı' : 'Sunucu'} hatası: ${report.message}${report.path ? ` (${report.method ?? ''} ${report.path})` : ''}${report.digest ? ` digest=${report.digest}` : ''}`;
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 1500), ...report, environment: siteEnv() }),
    signal: AbortSignal.timeout(4000),
  });
}

// Kullanıcının bağlantıyı kesmesi gibi uygulama hatası olmayan durumlar
const IGNORED = [/destination stream closed early/i, /aborted/i, /ResizeObserver loop/i, /Load failed$/i, /NetworkError when attempting to fetch/i];

export async function reportError(input: ErrorReport): Promise<void> {
  if (IGNORED.some((re) => re.test(input.message))) return;
  const report: ErrorReport = {
    ...input,
    message: scrub(input.message) ?? 'Bilinmeyen hata',
    stack: scrub(input.stack, 4000),
    path: cleanPath(input.path),
  };
  // Tek satır JSON: Vercel loglarında aranabilir ("level":"error")
  console.error(JSON.stringify({ level: 'error', source: 'app', ...report, stack: undefined, env: siteEnv() }));

  const key = `${report.kind}:${report.digest ?? report.message}:${report.path ?? ''}`;
  if (!shouldForward(key)) return;
  const tasks: Promise<void>[] = [];
  if (process.env.SENTRY_DSN) tasks.push(toSentry(report, process.env.SENTRY_DSN));
  if (process.env.ERROR_WEBHOOK_URL) tasks.push(toWebhook(report, process.env.ERROR_WEBHOOK_URL));
  // Raporlama hatası uygulamayı etkilemez
  await Promise.allSettled(tasks);
}
