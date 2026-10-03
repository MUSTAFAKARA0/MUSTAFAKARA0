import type { NextConfig } from 'next';
import { isIndexable } from './src/lib/site-env';

/** Değişken değeri (baştaki/sondaki boşluk ve satır sonları atılır) */
function envValue(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** Adres değişkenini okur; geçersizse hangi değişken olduğunu açıkça söyler */
function envUrl(name: string): URL | null {
  const raw = envValue(name);
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    const preview = raw.length > 30 ? `${raw.slice(0, 30)}…` : raw;
    throw new Error(
      `Ortam değişkeni ${name} geçerli bir adres değil (şu an: "${preview}"). ` +
        'Değer https:// ile başlamalıdır; değişkenin adını değer kutusuna yazmayın.',
    );
  }
}

/**
 * Vercel'de derleme başlamadan yaygın kurulum hatalarını tek seferde ve açıkça bildirir
 * (eksik değer, değer kutusuna değişken adının yazılması, anon ve service_role
 * anahtarlarının karıştırılması). Gizli değerlerin kendisi yazdırılmaz.
 */
function checkDeploymentEnv(): void {
  if (process.env.VERCEL !== '1') return;
  const problems: string[] = [];
  const looksLikeName = (v: string) => /^[A-Z][A-Z0-9_]+$/.test(v);
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'IP_HASH_SALT', 'CRON_SECRET'];
  for (const name of required) {
    const v = envValue(name);
    if (!v) problems.push(`${name} tanımlı değil veya boş.`);
    else if (looksLikeName(v)) problems.push(`${name}: değer kutusuna bir değişken adı yazılmış ("${v}"). Gerçek değeri yazın.`);
  }
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const v = envValue(name);
    if (v && !looksLikeName(v) && !/^https?:\/\/[^\s/]+/.test(v)) problems.push(`${name} https:// ile başlayan bir adres olmalı.`);
  }
  const anon = envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const service = envValue('SUPABASE_SERVICE_ROLE_KEY');
  if (anon && service && anon === service) problems.push('SUPABASE_SERVICE_ROLE_KEY, anon anahtarıyla aynı. Supabase\'deki service_role (secret) anahtarını girin.');
  if (anon.startsWith('sb_secret_')) problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY alanına gizli (sb_secret_) anahtar girilmiş. Buraya anon / publishable anahtar yazılır.');
  if (problems.length) {
    throw new Error(`Ortam değişkenlerinde ${problems.length} sorun var:\n  - ${problems.join('\n  - ')}\n`);
  }
}

checkDeploymentEnv();
const supabaseUrl = envUrl('NEXT_PUBLIC_SUPABASE_URL');
const storageUrl = envUrl('NEXT_PUBLIC_SUPABASE_STORAGE_URL');

const remotePatterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [
  { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
];
for (const origin of [supabaseUrl, storageUrl]) {
  if (origin && !origin.hostname.endsWith('.supabase.co')) {
    remotePatterns.push({
      protocol: origin.protocol.replace(':', '') as 'http' | 'https',
      hostname: origin.hostname,
      port: origin.port,
      pathname: '/storage/v1/object/public/**',
    });
  }
}

const supabaseOrigins = [supabaseUrl?.origin, storageUrl?.origin].filter(Boolean).join(' ');

/**
 * Content Security Policy. Next.js hidrasyonu için satır içi script'lere
 * izin verilir; dış kaynaklar yalnızca Supabase (veri, görseller ve büyük
 * dosya yüklemeleri için doğrudan depolama adresi) ile sınırlıdır. Harita
 * döşemeleri /api/tiles üzerinden aynı kaynaktan (self) sunulur; harita
 * sağlayıcısı anahtarı tarayıcıya hiç gönderilmez.
 */
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://*.supabase.co ${supabaseOrigins}`,
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co ${supabaseOrigins}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75, 85],
    // srcset genişlikleri sunucuda üretilen varyantlarla (320…2880) hizalıdır
    deviceSizes: [640, 960, 1440, 2048, 2880],
    imageSizes: [160, 320, 480],
    remotePatterns,
    localPatterns: [{ pathname: '/demo/**' }, { pathname: '/karay/**' }, { pathname: '/og-default.png' }, { pathname: '/placeholder-property.svg' }],
    // Yerel Supabase ile geliştirme/test için (canlıda kapalı kalmalı)
    dangerouslyAllowLocalIP: process.env.NEXT_IMAGE_ALLOW_LOCAL_IP === '1',
  },
  // OG görselleri için fontlar sunucu paketine dahil edilir
  outputFileTracingIncludes: {
    '/t/*/og': ['./assets/fonts/**/*'],
    '/t/*/ilan/*/og': ['./assets/fonts/**/*'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Yüzey başına ayrı kök layout (kiracı sitesi, ofis paneli, KARAY platformu, KARAY sayfası)
    // olduğundan hiçbir rotayla eşleşmeyen adreslerin 404'ü app/global-not-found.tsx'tir.
    globalNotFound: true,
  },
  async headers() {
    // Production dışındaki ortamlar (demo, önizleme, yerel) dizine eklenmez. İstisna: KARAY'ın
    // kendi şirket sayfası (/karay) — dizinlenme KARAY ayarlarından (sayfanın robots etiketi)
    // yönetilir; kiracı (demo) sitelerinin noindex kuralı değişmez.
    const robots = isIndexable() ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/:path*', headers: securityHeaders },
      ...(robots.length ? [{ source: '/:path((?!karay(?:/|$)).*)', headers: robots }] : []),
    ];
  },
  async redirects() {
    // Kalıcı (308) yönlendirmeler: eski site ve V1 adresleri.
    // İlan/sayfa bazlı dinamik yönlendirmeler veritabanındaki `redirects` tablosundadır.
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      { source: '/iletisim.html', destination: '/iletisim', permanent: true },
      { source: '/hakkimizda.html', destination: '/hakkimizda', permanent: true },
      // V1 → V2: "işyeri" kategorisi "ticari" oldu
      { source: '/isyeri', destination: '/ticari', permanent: true },
      { source: '/satilik-isyeri', destination: '/satilik-ticari', permanent: true },
      { source: '/kiralik-isyeri', destination: '/kiralik-ticari', permanent: true },
      // V1 yönetim paneli adresleri
      { source: '/admin/ilan-ekle', destination: '/admin/ilanlar/yeni', permanent: true },
      { source: '/admin/ilan/:id', destination: '/admin/ilanlar/:id', permanent: true },
      { source: '/admin/mesajlar', destination: '/admin/talepler', permanent: true },
    ];
  },
};

export default nextConfig;
