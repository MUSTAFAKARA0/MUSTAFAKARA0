import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/hakkimizda'>) {
  return contentPageMetadata((await params).tenant, 'about');
}

export default async function Page({ params }: PageProps<'/t/[tenant]/hakkimizda'>) {
  return <ContentPageView tenantKey={(await params).tenant} pageKey="about" />;
}
