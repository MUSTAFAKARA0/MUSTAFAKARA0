import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { ExternalLink, MapPinned, PencilLine, Plus, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteRegionPage } from '@/app/actions/admin-content';
import { formatRelativeDate } from '@/lib/format';
import { listAdminRegions } from '@/modules/content/admin-queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Bölge sayfaları' };

export default async function RegionsPage() {
  const ctx = await requirePagePermission('content.manage');
  const [rows, tenant] = await Promise.all([listAdminRegions(ctx), getTenant(ctx.org.slug)]);
  const siteLink = (path: string) => (tenant ? tenantUrl(tenant, path) : path);

  return (
    <>
      <AdminPageHeader
        title="Bölge sayfaları"
        description="Hizmet verdiğiniz il, ilçe ve mahalleler için rehber sayfaları. Sayfada o bölgedeki yayında ilanlar ve ilanlardan hesaplanan fiyat aralıkları otomatik listelenir."
        actions={
          <Button asChild>
            <Link href="/admin/bolgeler/yeni">
              <Plus /> Yeni bölge sayfası
            </Link>
          </Button>
        }
      />
      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        {rows.length === 0 ? (
          <EmptyPanel
            icon={MapPinned}
            title="Henüz bölge sayfası yok"
            description="Örneğin mahalleniz için ulaşım, sosyal olanaklar ve konut dokusunu anlatan bir rehber sayfası oluşturun."
            action={
              <Button asChild>
                <Link href="/admin/bolgeler/yeni">
                  <Plus /> Yeni bölge sayfası
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/bolgeler/${r.id}`} className="text-[15px] font-semibold hover:underline">
                      {r.name}
                    </Link>
                    {r.status === 'published' ? <Badge variant="success">Yayında</Badge> : <Badge>Taslak</Badge>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {[r.location, `/bolgeler/${r.slug}`, `${r.faqCount} soru`, r.bodyLength < 400 ? 'rehber metni kısa' : null, `güncellendi ${formatRelativeDate(r.updatedAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/admin/bolgeler/${r.id}`}>
                      <PencilLine /> Düzenle
                    </Link>
                  </Button>
                  {r.status === 'published' && (
                    <Button asChild size="xs" variant="ghost">
                      <a href={siteLink(`/bolgeler/${r.slug}`)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Görüntüle
                      </a>
                    </Button>
                  )}
                  <ActionButton
                    size="xs"
                    variant="danger-ghost"
                    confirm={{ title: `“${r.name}” sayfası silinsin mi?`, description: 'Sayfa kalıcı olarak silinir. Yayındaysa adresi bölgeler sayfasına yönlendirilir.', confirmLabel: 'Sil', destructive: true }}
                    action={async () => {
                      'use server';
                      return deleteRegionPage(r.id);
                    }}
                  >
                    <Trash2 /> Sil
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
