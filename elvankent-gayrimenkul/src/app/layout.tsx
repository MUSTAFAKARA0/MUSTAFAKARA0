import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { Toaster } from 'sonner';
import { publicEnv } from '@/lib/env';
import { getSiteSettings } from '@/lib/data/settings';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name = settings.business_name;
  const description =
    settings.tagline ??
    `${name}: Etimesgut, Elvankent ve Ankara'da satılık ve kiralık daire, iş yeri ve arsa ilanları.`;
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${name} | Satılık ve Kiralık Emlak İlanları`, template: `%s | ${name}` },
    description,
    applicationName: name,
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      siteName: name,
      images: [{ url: '/og-default.png', width: 1200, height: 630, alt: name }],
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: '#0e4d45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: 'font-sans rounded-xl' } }}
        />
      </body>
    </html>
  );
}
