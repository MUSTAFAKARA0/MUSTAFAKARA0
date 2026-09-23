import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const remotePatterns: NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> = [
  { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
];
if (supabaseUrl && !supabaseUrl.hostname.endsWith('.supabase.co')) {
  remotePatterns.push({
    protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
    hostname: supabaseUrl.hostname,
    port: supabaseUrl.port,
    pathname: '/storage/v1/object/public/**',
  });
}

const supabaseOrigin = supabaseUrl ? supabaseUrl.origin : '';

/**
 * Content Security Policy. Next.js hidrasyonu için satır içi script'lere
 * izin verilir; dış kaynaklar yalnızca Supabase ile sınırlıdır. Harita
 * döşemeleri /api/tiles üzerinden aynı kaynaktan (self) sunulur.
 */
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://*.supabase.co ${supabaseOrigin}`,
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co ${supabaseOrigin}`,
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
    remotePatterns,
    localPatterns: [{ pathname: '/demo/**' }, { pathname: '/og-default.png' }],
    // Yerel Supabase ile geliştirme/test için (canlıda kapalı kalmalı)
    dangerouslyAllowLocalIP: process.env.NEXT_IMAGE_ALLOW_LOCAL_IP === '1',
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    // Kalıcı (301) yönlendirmeler: eski site URL'leri buraya eklenebilir.
    // Dinamik yönlendirmeler için veritabanındaki `redirects` tablosu kullanılır.
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      { source: '/iletisim.html', destination: '/iletisim', permanent: true },
      { source: '/hakkimizda.html', destination: '/hakkimizda', permanent: true },
    ];
  },
};

export default nextConfig;
