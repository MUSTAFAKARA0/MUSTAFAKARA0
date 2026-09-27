import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { Toaster } from 'sonner';
import { DemoNotice } from '@/components/common/demo-notice';
import { VercelInsights } from '@/components/common/vercel-insights';
import './globals.css';

/*
 * Tipografi: başlıklar için Fraunces (serif, güçlü ve premium), gövde ve
 * arayüz için Manrope (okunaklı, geniş rakam seti). Başka bir marka için
 * yalnızca bu iki tanım değiştirilir; bileşenler font-display / font-sans kullanır.
 */
const sans = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--font-sans-face', display: 'swap' });
const display = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display-face',
  // "optional": yavaş bağlantıda font ilk görüntülemeye yetişmezse o sayfada yedek
  // yazı tipi kalır (başlık satır kırılımı sonradan değişip içeriği kaydırmaz, CLS);
  // font önbelleğe alınır ve sonraki sayfa yüklemelerinde kullanılır.
  display: 'optional',
  weight: ['400', '500', '600'],
});

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
    <html lang="tr" data-scroll-behavior="smooth" className={`${sans.variable} ${display.variable}`}>
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
