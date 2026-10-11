import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/cerez-politikasi'>) {
  return contentPageMetadata((await params).tenant, 'cookies');
}

export default async function Page({ params }: PageProps<'/t/[tenant]/cerez-politikasi'>) {
  return <ContentPageView tenantKey={(await params).tenant} pageKey="cookies" />;
}
