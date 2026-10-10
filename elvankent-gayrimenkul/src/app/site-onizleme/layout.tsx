import type { Metadata, Viewport } from 'next';
import { RootDocument, rootMetadata, rootViewport } from '@/components/common/root-document';
import '@/app/globals.css';

/*
 * KARAY GERÇEK ÖNİZLEME kökü (Yeni Site Oluştur sihirbazı). Kiracı sitesinin kökü (app/t)
 * gibi yazı tipi veya tema CSS'i yüklemez: sayfa manifestten yalnızca seçili paketi yazar
 * (SiteFrame). Platform kökünün (Poppins, platform teması) hiçbir parçası buraya girmez,
 * önizleme kodu da kiracı sitesine veya sihirbaz paketine girmez (ayrı giriş noktası).
 */
export const metadata: Metadata = {
  ...rootMetadata,
  title: 'Site önizlemesi',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

export const viewport: Viewport = rootViewport('#fbfaf8');

export default function SitePreviewRootLayout({ children }: LayoutProps<'/site-onizleme'>) {
  return <RootDocument demoNotice={false}>{children}</RootDocument>;
}
