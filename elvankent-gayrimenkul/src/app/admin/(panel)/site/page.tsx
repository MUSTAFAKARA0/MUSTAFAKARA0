import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { BrandForm } from '@/components/site-editor/brand-form';
import { brandValues } from '@/site-editor/brand-values';
import { getOfficeSite } from '@/app/admin/(panel)/site/site-data';

export const metadata: Metadata = { title: 'Site yönetimi' };

/** Genel: firma kimliği ve marka renkleri (taslağa kaydedilir) */
export default async function Page() {
  const { site } = await getOfficeSite();
  return (
    <div className="space-y-4">
      <BrandForm groups={['identity', 'colors']} initial={brandValues(site.brand)} pendingFields={Object.keys(site.draft.brand)} />
      <p className="max-w-4xl text-[13px] text-muted-foreground">
        Logo, site simgesi ve paylaşım görselleri{' '}
        <Link href="/admin/sirket" className="font-semibold text-primary hover:underline">
          Marka ve Görünüm
        </Link>{' '}
        sayfasından yüklenir.
      </p>
    </div>
  );
}
