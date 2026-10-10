import type { Metadata, Viewport } from 'next';
import { RootDocument, rootMetadata, rootViewport } from '@/components/common/root-document';
import '@/app/globals.css';

/*
 * Kiracı (emlak ofisi) sitelerinin kökü — Site Engine. Burada yazı tipi veya tema CSS'i
 * YÜKLENMEZ: app/t/[tenant]/layout.tsx sitenin manifestinden yalnızca seçili tipografi
 * paketini (typography/font-css.ts) ve seçili tema/varyant CSS'ini satır içi yazar.
 * Katalogdaki diğer yazı tipleri ve temalar bu sitenin sayfasına girmez.
 */
export const metadata: Metadata = {
  ...rootMetadata,
};

export const viewport: Viewport = rootViewport('#fbfaf8');

export default function SiteRootLayout({ children }: LayoutProps<'/t'>) {
  return <RootDocument>{children}</RootDocument>;
}
