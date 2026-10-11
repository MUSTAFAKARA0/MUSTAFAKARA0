import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/kvkk'>) {
  return contentPageMetadata((await params).tenant, 'kvkk');
}

export default async function Page({ params }: PageProps<'/t/[tenant]/kvkk'>) {
  return <ContentPageView tenantKey={(await params).tenant} pageKey="kvkk" />;
}
