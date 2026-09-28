import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { DemoNotice } from '@/components/common/demo-notice';
import { fontVariables } from '@/platform/site/fonts';
import { VercelInsights } from '@/components/common/vercel-insights';
import './globals.css';

/*
 * Tipografi: varsayılan başlık yazı tipi Fraunces (serif), gövde Manrope. Kiracı sitesi
 * kendi yapılandırmasıyla (tema/tipografi) katalogdaki başka bir yazı tipini seçebilir
 * (src/platform/site/fonts.ts). Bileşenler font-display / font-sans kullanır.
 */
export const metadata: Metadata = {
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fbfaf8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" data-scroll-behavior="smooth" className={fontVariables}>
      <body className="min-h-dvh">
        <DemoNotice />
        {children}
        {/* Vercel Speed Insights / Analytics yalnızca Vercel ortamında (VERCEL=1) */}
        {process.env.VERCEL === '1' && <VercelInsights />}
        <Toaster position="top-center" richColors closeButton toastOptions={{ classNames: { toast: 'font-sans rounded-xl' } }} />
      </body>
    </html>
  );
}
