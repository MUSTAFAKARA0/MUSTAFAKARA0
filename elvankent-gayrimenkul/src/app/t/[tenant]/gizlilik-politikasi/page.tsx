import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/gizlilik-politikasi'>) {
  return contentPageMetadata((await params).tenant, 'privacy');
}

export default async function Page({ params }: PageProps<'/t/[tenant]/gizlilik-politikasi'>) {
  return <ContentPageView tenantKey={(await params).tenant} pageKey="privacy" />;
}
