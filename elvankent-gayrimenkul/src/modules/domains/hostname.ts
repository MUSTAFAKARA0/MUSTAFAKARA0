/**
 * Alan adı normalizasyonu ve doğrulaması (P0.5) — saf modül (ortam okumaz; proxy, sunucu ve
 * testler aynı kuralı kullanır).
 *
 *  canonicalHostname  karşılaştırma / arama için: "HTTPS://WWW.Example.COM/yol?x#y" → "www.example.com"
 *  parseDomainInput   kullanıcı girişi için KATI: yalnızca çıplak alan adı kabul edilir
 *                     (şema, yol, sorgu, port, IP, localhost, iç/ayrılmış ad, KARAY ad alanı reddedilir)
 */

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^[a-z]{2,63}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
/** Hiçbir ortamda müşteri alan adı olamayan iç / özel kullanım uzantıları */
const INTERNAL_TLDS = ['local', 'localhost', 'internal', 'intranet', 'lan', 'home', 'corp', 'private', 'localdomain', 'arpa', 'onion'];
/** RFC 2606 deneme uzantıları: yalnızca üretim DIŞINDA (yerel/E2E) kabul edilir */
const TEST_TLDS = ['test', 'example', 'invalid'];

export type DomainInputError = 'empty' | 'url' | 'port' | 'ip' | 'invalid' | 'internal' | 'reserved' | 'single_label';

export const DOMAIN_INPUT_MESSAGES: Record<DomainInputError, string> = {
  empty: 'Alan adı girin.',
  url: 'Yalnızca alan adını yazın (ör. ornekemlak.com) — https://, yol veya parametre olmadan.',
  port: 'Alan adına port eklenemez.',
  ip: 'IP adresi alan adı olarak eklenemez.',
  invalid: 'Geçerli bir alan adı girin (ör. ornekemlak.com veya www.ornekemlak.com).',
  internal: 'Bu bir iç / yerel ağ adı; herkese açık bir alan adı girin.',
  reserved: 'Bu alan adı platforma ayrılmıştır; kendi alan adınızı girin.',
  single_label: 'Alan adı uzantısıyla birlikte yazılmalı (ör. ornekemlak.com).',
};

export interface DomainPolicy {
  /** Platform / KARAY ad alanı: bu adlar ve tüm alt alan adları reddedilir */
  reservedSuffixes: string[];
  /** Üretimde RFC 2606 deneme uzantıları da reddedilir */
  production: boolean;
}

function syntaxOk(host: string): boolean {
  if (host.length < 4 || host.length > 253) return false;
  const labels = host.split('.');
  if (labels.length < 2) return false;
  return labels.every((l) => LABEL.test(l)) && TLD.test(labels[labels.length - 1]);
}

/** Karşılaştırma için kanonik biçim; geçersizse null */
export function canonicalHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/^[^@/?#]*@/, '');
  value = value.split(/[/?#]/, 1)[0] ?? '';
  value = value.replace(/:\d+$/, '').replace(/\.+$/, '');
  return syntaxOk(value) && !IPV4.test(value) ? value : null;
}

/** host, listedeki bir adın kendisi veya alt alan adı mı? */
export function isUnderSuffix(host: string, suffixes: string[]): boolean {
  return suffixes.some((s) => s && (host === s || host.endsWith(`.${s}`)));
}

export function parseDomainInput(raw: unknown, policy: DomainPolicy): { ok: true; hostname: string } | { ok: false; error: DomainInputError; message: string } {
  const fail = (error: DomainInputError) => ({ ok: false as const, error, message: DOMAIN_INPUT_MESSAGES[error] });
  if (typeof raw !== 'string' || !raw.trim()) return fail('empty');
  const value = raw.trim().toLowerCase();
  if (value.length > 260) return fail('invalid');
  if (/[\s@]/.test(value) || /^[a-z][a-z0-9+.-]*:\/\//.test(value) || /[/?#\\]/.test(value)) return fail('url');
  if (value.startsWith('[') || value.includes('::')) return fail('ip');
  if (/:\d*$/.test(value)) return fail('port');
  if (value.includes(':')) return fail('invalid');
  const host = value.replace(/\.$/, '');
  if (IPV4.test(host) || /^\d+(\.\d+)*$/.test(host)) return fail('ip');
  if (!host.includes('.')) return host === 'localhost' ? fail('internal') : fail('single_label');
  if (!syntaxOk(host)) return fail('invalid');
  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (INTERNAL_TLDS.includes(tld)) return fail('internal');
  if (policy.production && TEST_TLDS.includes(tld)) return fail('internal');
  if (isUnderSuffix(host, policy.reservedSuffixes.map((s) => canonicalHostname(s) ?? s.toLowerCase()))) return fail('reserved');
  return { ok: true, hostname: host };
}
