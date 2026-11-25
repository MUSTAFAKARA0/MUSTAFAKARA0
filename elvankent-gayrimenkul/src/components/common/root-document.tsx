import { Toaster } from 'sonner';
import { AppToaster } from '@/components/ui/toaster';
import { DemoNotice } from '@/components/common/demo-notice';
import { VercelInsights } from '@/components/common/vercel-insights';

/**
 * Kök layout'ların ortak <html>/<body> kabuğu. Her yüzeyin (kiracı sitesi, ofis paneli,
 * KARAY platformu, KARAY sayfası) kendi kök layout'u vardır ve yalnızca kendi yazı
 * tiplerini/CSS'ini yükler; bu bileşen yalnızca ortak iskeleti verir.
 *
 *   fontClassName  <html> üzerindeki yazı tipi değişken sınıfları (tokenlar :root'ta çözülür)
 *   demoNotice     demo ortamı şeridi (KARAY sayfasında yok: örnek veri içermez)
 *   appToaster     yalnızca panel (admin/platform) yüzeylerinde AppToaster; diğer yüzeyler önceki Toaster'ı korur
 */
export function RootDocument({ children, fontClassName, demoNotice = true, appToaster = false }: { children: React.ReactNode; fontClassName?: string; demoNotice?: boolean; appToaster?: boolean }) {
  return (
    <html lang="tr" data-scroll-behavior="smooth" className={fontClassName}>
      <body className="min-h-dvh">
        {demoNotice && <DemoNotice />}
        {children}
        {/* Vercel Speed Insights / Analytics yalnızca Vercel ortamında (VERCEL=1) */}
        {process.env.VERCEL === '1' && <VercelInsights />}
        {appToaster ? <AppToaster /> : <Toaster position="top-center" richColors closeButton toastOptions={{ classNames: { toast: 'font-sans rounded-xl' } }} />}
      </body>
    </html>
  );
}

/** Kök layout'ların ortak görünüm alanı ayarları (yalnızca tema rengi yüzeye göre değişir) */
export function rootViewport(themeColor: string) {
  return { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor } as const;
}

/** Kök layout'ların ortak meta verisi (her yüzey kendi meta verisine yayar) */
export const rootMetadata = { formatDetection: { telephone: false } } as const;
