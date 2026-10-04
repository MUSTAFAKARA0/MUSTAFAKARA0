import 'server-only';
import { canonicalHostname, type DomainPolicy } from '@/modules/domains/hostname';
import { defaultHostsFromSiteUrl, karayHostsFromEnv } from '@/platform/tenant/host';

/**
 * Özel alan adı yapılandırması — TAMAMEN ortamdan (kodda üretim alan adı yok).
 *
 *  Ayrılmış ad alanı (müşteri alan adı olamaz): PLATFORM_ROOT_DOMAIN, KARAY_HOSTS,
 *    NEXT_PUBLIC_SITE_URL alan adı (varsayılan kiracı), barındırma önizleme alanı (vercel.app)
 *    ve isteğe bağlı DOMAIN_RESERVED_SUFFIXES (virgülle).
 *  Doğrulama kaydı: DOMAIN_VERIFICATION_RECORD (varsayılan _karay-verification) → TXT
 *  Bağlantı hedefi: DOMAIN_TARGET_CNAME (alt alan adları) ve DOMAIN_TARGET_A (kök alan adı, virgülle
 *    IPv4). Barındırmanın verdiği GERÇEK değerler girilir; tanımlı değilse ekran "hedef KARAY
 *    tarafından bildirilir" der ve bağlantıyı yalnızca süper admin elle onaylayabilir.
 */
export interface DomainConfig {
  policy: DomainPolicy;
  verificationRecord: string;
  targetCname: string | null;
  targetA: string[];
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function domainConfigFromEnv(env: Record<string, string | undefined>): DomainConfig {
  const reserved = new Set<string>(['vercel.app']);
  const root = canonicalHostname(env.PLATFORM_ROOT_DOMAIN);
  if (root) reserved.add(root);
  for (const h of karayHostsFromEnv(env.KARAY_HOSTS)) {
    const c = canonicalHostname(h);
    if (c) reserved.add(c.replace(/^www\./, ''));
  }
  for (const h of defaultHostsFromSiteUrl(env.NEXT_PUBLIC_SITE_URL)) {
    const c = canonicalHostname(h);
    if (c) reserved.add(c.replace(/^www\./, ''));
  }
  for (const h of (env.DOMAIN_RESERVED_SUFFIXES ?? '').split(',')) {
    const c = canonicalHostname(h);
    if (c) reserved.add(c);
  }
  const record = (env.DOMAIN_VERIFICATION_RECORD ?? '').trim().toLowerCase();
  return {
    policy: { reservedSuffixes: [...reserved], production: env.SITE_ENV === 'production' },
    verificationRecord: /^_[a-z0-9-]{1,60}$/.test(record) ? record : '_karay-verification',
    targetCname: canonicalHostname(env.DOMAIN_TARGET_CNAME),
    targetA: (env.DOMAIN_TARGET_A ?? '').split(',').map((v) => v.trim()).filter((v) => IPV4.test(v)),
  };
}

export function domainConfig(): DomainConfig {
  return domainConfigFromEnv(process.env);
}
