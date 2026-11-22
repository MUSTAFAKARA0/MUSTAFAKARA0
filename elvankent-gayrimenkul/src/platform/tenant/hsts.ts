/**
 * Strict-Transport-Security kararı (D-15 / PF-10, KI-32).
 *
 * `includeSubDomains; preload` alan adının TÜM alt alan adlarını HTTPS'e zorlar ve preload
 * listesine girme taahhüdüdür. Bu yalnızca KARAYS'ın kendi alan adlarında verilebilir; müşterinin
 * bağladığı özel alan adında (ve {slug}.{kök} kiracı adreslerinde) müşterinin başka alt alan
 * adlarını (posta, eski site…) etkilememek için yalnızca `max-age` gönderilir.
 *
 *  - KARAY_HOSTS, platform kök alan adı (PLATFORM_ROOT_DOMAIN ve www) ve *.vercel.app → tam değer
 *  - kiracı / özel alan adları (boş Host dahil) → yalnızca max-age
 *  - localhost, *.localhost, IP adresleri → başlık yok (HTTPS olmayan geliştirme adresleri)
 *
 * Proxy (src/proxy.ts) bu kararı her yanıta uygular. Proxy'nin atladığı statik dosya yolları
 * (/_next/static, /_next/image, uzantılı public dosyalar) için next.config.ts aynı kararı
 * `has`/`missing` host koşullarıyla verir (hstsStaticHeaderRules). Statik dosyalarda da
 * KARAY alan adında tam değer gönderilmesi şarttır: tarayıcı her yeni HSTS başlığıyla kayıtlı
 * kuralı günceller (RFC 6797 §8.1), sade max-age KARAY alan adındaki includeSubDomains'i siler.
 */
import { hostSurface, normalizeHost, type KarayHostConfig } from './host';

/** İki yıl */
export const HSTS_MAX_AGE = 63072000;
export const HSTS_KARAY = `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`;
export const HSTS_TENANT = `max-age=${HSTS_MAX_AGE}`;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** HTTPS olmayan yerel geliştirme adresleri: HSTS gönderilmez */
function isLocalDevHost(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[');
}

/** Bu Host için gönderilecek Strict-Transport-Security değeri; null → başlık gönderilmez */
export function hstsForHost(rawHost: string | null | undefined, config: KarayHostConfig): string | null {
  const host = normalizeHost(rawHost);
  if (host && isLocalDevHost(host)) return null;
  // Yerel adresler elendikten sonra 'shared' yalnızca platform kökü (www dahil) ve *.vercel.app'tir
  return hostSurface(host, config) === 'tenant' ? HSTS_TENANT : HSTS_KARAY;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * next.config.ts `has`/`missing` host koşulları için düzenli ifadeler. Next değeri
 * `^${value}$` olarak derler ve Host'u port olmadan, küçük harfle karşılaştırır; bu yüzden
 * alternatifler (?:…) içine alınır.
 */
export function hstsHostPatterns(config: KarayHostConfig): { karay: string; localDev: string } {
  const exact = [...config.karayHosts];
  const root = config.platformRootDomain;
  if (root) exact.push(root, `www.${root}`);
  const karay = [...new Set(exact)].filter((h) => !isLocalDevHost(h)).map(escapeRegex);
  karay.push('[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.vercel\\.app');
  return {
    karay: `(?:${karay.join('|')})`,
    localDev: '(?:localhost|[^.]+(?:\\.[^.]+)*\\.localhost|\\d{1,3}(?:\\.\\d{1,3}){3}|\\[.*)',
  };
}

// src/proxy.ts matcher'ının TAM tersi: proxy'nin çalışmadığı statik dosya ve Next iç kaynak yolları.
// Matcher değişirse bu da değişmeli (tests/unit/hsts.test.mjs ikisinin örtüşmediğini ve boşluk bırakmadığını sınar).
export const STATIC_ASSET_PATHS =
  '/:path((?!(?:platform|site-onizleme|admin|api|karay|t)/)(?:_next/static|_next/image|__nextjs|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|css|js|map|woff2?|ttf|otf|webm|mp4|vtt)$).*)';

interface HeaderRule {
  source: string;
  has?: { type: 'host'; value: string }[];
  missing?: { type: 'host'; value: string }[];
  headers: { key: string; value: string }[];
}

/**
 * Proxy'nin çalışmadığı yollar için (`source`) HSTS kuralları: hstsForHost ile aynı karar,
 * yapılandırma derleme anında okunur (Vercel'de ortam değişkeni değişikliği zaten yeniden yayın ister).
 */
export function hstsStaticHeaderRules(source: string, config: KarayHostConfig): HeaderRule[] {
  const p = hstsHostPatterns(config);
  return [
    { source, has: [{ type: 'host', value: p.karay }], headers: [{ key: 'Strict-Transport-Security', value: HSTS_KARAY }] },
    {
      source,
      missing: [
        { type: 'host', value: p.karay },
        { type: 'host', value: p.localDev },
      ],
      headers: [{ key: 'Strict-Transport-Security', value: HSTS_TENANT }],
    },
  ];
}
