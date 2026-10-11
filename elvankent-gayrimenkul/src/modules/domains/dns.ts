import 'server-only';
import { Resolver } from 'node:dns/promises';

/**
 * DNS sorgu soyutlaması (P0.5). Doğrulama ve bağlantı denetimi yalnızca bu arayüzü kullanır.
 *
 *  system → işletim sisteminin DNS çözümleyicisi (varsayılan)
 *  doh    → DOMAIN_DNS_RESOLVER_URL tanımlıysa DNS-over-HTTPS JSON API
 *           (ör. https://cloudflare-dns.com/dns-query; testlerde yerel sahte sunucu)
 *
 * Hata / zaman aşımı "kayıt yok" sayılır (doğrulama başarısız, durum değişmez). DNS sağlayıcısı
 * hesaplarına bağlanılmaz; kayıtları müşteri kendisi ekler.
 */
export interface DnsResolver {
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
  a(name: string): Promise<string[]>;
}

const TIMEOUT_MS = 5000;

function systemResolver(): DnsResolver {
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 2 });
  const safe = async <T>(fn: () => Promise<T[]>): Promise<T[]> => fn().catch(() => [] as T[]);
  return {
    txt: async (name) => (await safe(() => resolver.resolveTxt(name))).map((parts) => parts.join('')),
    cname: (name) => safe(() => resolver.resolveCname(name)),
    a: (name) => safe(() => resolver.resolve4(name)),
  };
}

type DohAnswer = { type: number; data: string };
const TYPES = { A: 1, CNAME: 5, TXT: 16 } as const;

export function dohResolver(endpoint: string, http: typeof fetch = fetch): DnsResolver {
  async function query(name: string, type: keyof typeof TYPES): Promise<string[]> {
    try {
      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}name=${encodeURIComponent(name)}&type=${type}`;
      const res = await http(url, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
      if (!res.ok) return [];
      const body = (await res.json()) as { Answer?: DohAnswer[] };
      return (body.Answer ?? [])
        .filter((a) => a.type === TYPES[type])
        .map((a) => (type === 'TXT' ? a.data.replace(/^"|"$/g, '').replace(/"\s*"/g, '') : a.data.replace(/\.$/, '').toLowerCase()));
    } catch {
      return [];
    }
  }
  return { txt: (n) => query(n, 'TXT'), cname: (n) => query(n, 'CNAME'), a: (n) => query(n, 'A') };
}

export function getDnsResolver(): DnsResolver {
  const doh = process.env.DOMAIN_DNS_RESOLVER_URL?.trim();
  return doh && /^https?:\/\//.test(doh) ? dohResolver(doh) : systemResolver();
}
