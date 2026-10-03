import type { Metadata, Viewport } from 'next';
import { RootDocument, rootMetadata, rootViewport } from '@/components/common/root-document';
import { fontVariables } from '@/theme-engine/typography/fonts';
import '@/app/globals.css';

/*
 * Kiracı (emlak ofisi) sitelerinin kökü — Site Engine. Tema yazı tipi kataloğu YALNIZCA
 * burada (ve tema önizlemesinde) yüklenir; KARAY ve yönetim panelleri yüklemez. Tema sunum
 * kuralları global CSS değildir: app/t/[tenant]/layout.tsx sitenin manifestinden yalnızca
 * seçili tema/varyantların CSS'ini satır içi yazar (Theme Engine › applyTheme).
 */
export const metadata: Metadata = {
  ...rootMetadata,
};

export const viewport: Viewport = rootViewport('#fbfaf8');

export default function SiteRootLayout({ children }: LayoutProps<'/t'>) {
  return <RootDocument fontClassName={fontVariables}>{children}</RootDocument>;
}
