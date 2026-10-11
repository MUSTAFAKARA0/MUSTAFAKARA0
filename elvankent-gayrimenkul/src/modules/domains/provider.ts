/**
 * Özel alan adı sağlayıcı soyutlaması (saf modül; ortam değişkeni okumaz).
 *
 *  manual → alan adı yalnızca veritabanına kaydedilir; gereken DNS kayıtları
 *           hesaplanıp gösterilir, Vercel'e ekleme elle yapılır (varsayılan).
 *  vercel → Vercel REST API ile projeye otomatik eklenir/kaldırılır ve
 *           doğrulama durumu okunur (VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID).
 *
 * Yeni bir barındırma sağlayıcısı eklemek için yalnızca bu arayüz uygulanır.
 */
export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
}

export interface DomainStatus {
  /** Barındırmada alan adı doğrulandı ve DNS doğru yönlendiriliyor */
  ready: boolean;
  /** Eklenmesi gereken DNS kayıtları (yönlendirme + gerekirse sahiplik doğrulaması) */
  records: DnsRecord[];
  message?: string;
}

export type DomainResult = { ok: true; status: DomainStatus } | { ok: false; error: string };

export interface DomainProvider {
  id: 'manual' | 'vercel';
  add(hostname: string): Promise<DomainResult>;
  remove(hostname: string): Promise<{ ok: true } | { ok: false; error: string }>;
  status(hostname: string): Promise<DomainResult>;
}

/** Kök alan adı mı (example.com) yoksa alt alan adı mı (www.example.com)? .com.tr gibi uzantılar dikkate alınır. */
export function isApexDomain(hostname: string): boolean {
  const parts = hostname.split('.');
  const twoLevelTlds = ['com.tr', 'net.tr', 'org.tr', 'gen.tr', 'biz.tr', 'info.tr', 'web.tr', 'av.tr', 'co.uk'];
  const suffix = parts.slice(-2).join('.');
  return twoLevelTlds.includes(suffix) ? parts.length === 3 : parts.length === 2;
}

/** Vercel'in belgelenmiş genel yönlendirme değerleri (panelde projeye özel değer gösterilirse o kullanılır) */
export function vercelDnsRecords(hostname: string): DnsRecord[] {
  return isApexDomain(hostname)
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [{ type: 'CNAME', name: hostname.split('.')[0], value: 'cname.vercel-dns.com' }];
}

export function createManualProvider(): DomainProvider {
  const status = async (hostname: string): Promise<DomainResult> => ({
    ok: true,
    status: { ready: false, records: vercelDnsRecords(hostname), message: 'Alan adını Vercel › Project › Domains bölümüne ekleyin ve DNS kaydını tanımlayın.' },
  });
  return { id: 'manual', add: status, remove: async () => ({ ok: true }), status };
}

interface VercelConfig {
  token: string;
  projectId: string;
  teamId?: string;
  fetch?: typeof fetch;
}

type VercelDomain = { name: string; verified: boolean; verification?: { type: string; domain: string; value: string }[] };

export function createVercelProvider(config: VercelConfig): DomainProvider {
  const http = config.fetch ?? fetch;
  const q = config.teamId ? `?teamId=${encodeURIComponent(config.teamId)}` : '';
  const project = encodeURIComponent(config.projectId);
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };

  async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null; code?: string }> {
    const res = await http(`https://api.vercel.com${path}${q}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10_000) });
    const data = (await res.json().catch(() => null)) as (T & { error?: { code?: string } }) | null;
    return { ok: res.ok, status: res.status, data, code: data?.error?.code };
  }

  async function status(hostname: string): Promise<DomainResult> {
    const d = await call<VercelDomain>('GET', `/v9/projects/${project}/domains/${encodeURIComponent(hostname)}`);
    if (!d.ok || !d.data) return { ok: false, error: d.status === 404 ? 'Alan adı Vercel projesinde yok.' : `Vercel API hatası (${d.status}).` };
    const cfg = await call<{ misconfigured: boolean }>('GET', `/v6/domains/${encodeURIComponent(hostname)}/config`);
    const verification = (d.data.verification ?? []).map((v) => ({ type: 'TXT' as const, name: v.domain, value: v.value }));
    const misconfigured = cfg.data?.misconfigured ?? true;
    return {
      ok: true,
      status: {
        ready: d.data.verified && !misconfigured,
        records: [...(misconfigured ? vercelDnsRecords(hostname) : []), ...verification],
        message: d.data.verified ? (misconfigured ? 'DNS kaydı henüz doğru yönlendirilmiyor.' : 'Alan adı hazır.') : 'Sahiplik doğrulaması bekleniyor (TXT kaydı).',
      },
    };
  }

  return {
    id: 'vercel',
    async add(hostname) {
      const res = await call<VercelDomain>('POST', `/v10/projects/${project}/domains`, { name: hostname });
      if (!res.ok && res.code !== 'domain_already_in_use_by_project' && res.status !== 409) {
        return { ok: false, error: res.status === 403 ? 'Vercel API yetkisi yok (token/proje kontrol edin).' : `Vercel'e eklenemedi (${res.code ?? res.status}).` };
      }
      if (res.status === 409 && res.code !== 'domain_already_in_use_by_project') return { ok: false, error: 'Bu alan adı başka bir Vercel projesinde kullanılıyor.' };
      return status(hostname);
    },
    async remove(hostname) {
      const res = await call('DELETE', `/v9/projects/${project}/domains/${encodeURIComponent(hostname)}`);
      return res.ok || res.status === 404 ? { ok: true } : { ok: false, error: `Vercel'den kaldırılamadı (${res.status}).` };
    },
    status,
  };
}
