import type { Metadata } from 'next';
import { NotFoundView } from '@/components/common/error-view';

export const metadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false } };

export default function SiteNotFound() {
  return <NotFoundView />;
}
