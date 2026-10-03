import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PropertyDetailView } from '@/components/property/property-detail-view';
import { getPropertyForPreview } from '@/modules/properties/queries';
import { getSessionUser } from '@/platform/auth/session';
import { requireSiteTenant } from '@/site-config/load';

export const metadata: Metadata = {
  title: 'İlan önizleme',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

/**
 * Taslak / onay bekleyen ilan önizlemesi. Oturum istemcisi kullanılır: ilan
 * yalnızca kullanıcının "ilanları görüntüleme" yetkisi olan organizasyona
 * aitse RLS tarafından döndürülür. Sayfa önbelleğe alınmaz ve dizine eklenmez.
 */
export default async function PropertyPreviewPage({ params }: PageProps<'/t/[tenant]/onizleme/ilan/[id]'>) {
  const { tenant: key, id } = await params;
  const tenant = await requireSiteTenant(key);
  const session = await getSessionUser();
  if (!session) redirect(`/admin/giris?next=${encodeURIComponent(`/onizleme/ilan/${id}`)}`);

  const result = await getPropertyForPreview(session.supabase, id);
  if (!result || result.property.organizationId !== tenant.id) notFound();

  return <PropertyDetailView tenant={tenant} p={result.property} similar={[]} mode="preview" deletedAt={result.deletedAt} />;
}
