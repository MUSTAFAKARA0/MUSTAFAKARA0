import type { Metadata, Viewport } from 'next';
import { RootDocument, rootViewport } from '@/components/common/root-document';
import { fontVariables } from '@/theme-engine/typography/fonts';
import '@/app/globals.css';
import '@/theme-engine/css/themes.css';

/*
 * Kiracı (emlak ofisi) sitelerinin kökü — Site Engine. Theme Engine'in sunum CSS'i ve
 * yazı tipi kataloğu YALNIZCA burada (ve tema önizlemesinde) yüklenir; KARAY ve yönetim
 * panelleri bunları yüklemez. Kiracının teması app/t/[tenant]/layout.tsx'te veriden
 * (site yapılandırması) uygulanır.
 */
export const metadata: Metadata = {
  formatDetection: { telephone: false },
};

export const viewport: Viewport = rootViewport('#fbfaf8');

export default function SiteRootLayout({ children }: LayoutProps<'/t'>) {
  return <RootDocument fontClassName={fontVariables}>{children}</RootDocument>;
}
