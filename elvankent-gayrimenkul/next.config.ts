import type { NextConfig } from 'next';
import { isIndexable } from './src/lib/site-env';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL) : null;

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
    localPatterns: [{ pathname: '/demo/**' }, { pathname: '/og-default.png' }, { pathname: '/placeholder-property.svg' }],
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
  },
  async headers() {
    // Production dışındaki ortamlar (demo, önizleme, yerel) hiçbir yanıtta dizine eklenmez
    const robots = isIndexable() ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [{ source: '/:path*', headers: [...securityHeaders, ...robots] }];
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
