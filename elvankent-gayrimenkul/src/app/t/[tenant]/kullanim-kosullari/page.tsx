import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/kullanim-kosullari'>) {
  return contentPageMetadata((await params).tenant, 'terms');
}

export default async function Page({ params }: PageProps<'/t/[tenant]/kullanim-kosullari'>) {
  return <ContentPageView tenantKey={(await params).tenant} pageKey="terms" />;
}
