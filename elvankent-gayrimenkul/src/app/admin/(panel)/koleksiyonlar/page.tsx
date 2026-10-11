import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Ban, ExternalLink, FolderHeart, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { CopyLinkButton } from '@/components/admin/crm/copy-link-button';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteCollection, setCollectionRevoked } from '@/app/actions/admin-crm';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { isFutureDate } from '@/lib/utils';
import { listCollections } from '@/modules/crm/admin-queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Koleksiyonlar' };

export default async function CollectionsPage() {
  const ctx = await requirePagePermission('collections.manage');
  if (!ctx.plan.features.crm) {
    return (
      <>
        <AdminPageHeader title="Koleksiyonlar" />
        <EmptyPanel icon={FolderHeart} title="Seçkiler planınızda bulunmuyor" description="Müşterilerinize özel ilan seçkisi paylaşmak için planınızı yükseltin." />
      </>
    );
  }
  const [rows, tenant] = await Promise.all([listCollections(ctx), getTenant(ctx.org.slug)]);
  const linkFor = (token: string) => (tenant ? tenantUrl(tenant, `/koleksiyon/${token}`) : `/koleksiyon/${token}`);

  return (
    <>
      <AdminPageHeader
        title="Koleksiyonlar"
        description="Müşterilerinize özel ilan seçkileri. Bağlantıyı yalnızca paylaştığınız kişiler görebilir; arama motorlarında listelenmez."
        actions={
          <Button asChild>
            <Link href="/admin/koleksiyonlar/yeni">
              <Plus /> Yeni seçki
            </Link>
          </Button>
        }
      />
      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        {rows.length === 0 ? (
          <EmptyPanel icon={FolderHeart} title="Henüz seçki yok" description="Müşterinin kriterlerine uyan ilanları seçip tek bir bağlantıyla paylaşın; açılma sayısını buradan takip edin." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => {
              const expired = c.expiresAt ? !isFutureDate(c.expiresAt) : false;
              const state = c.revokedAt ? { label: 'İptal edildi', variant: 'neutral' as const } : expired ? { label: 'Süresi doldu', variant: 'warning' as const } : { label: 'Aktif', variant: 'success' as const };
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/koleksiyonlar/${c.id}`} className="text-[15px] font-semibold hover:underline">
                        {c.title}
                      </Link>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {[c.customer?.name, `${c.items} ilan`, `${c.viewCount} açılma`, c.lastViewedAt ? `son: ${formatRelativeDate(c.lastViewedAt)}` : null, c.expiresAt ? `bitiş: ${formatDate(c.expiresAt)}` : 'süresiz']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!c.revokedAt && !expired && <CopyLinkButton url={linkFor(c.token)} />}
                    {!c.revokedAt && !expired && (
                      <Button asChild size="xs" variant="ghost">
                        <a href={`/koleksiyon/${c.token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Aç
                        </a>
                      </Button>
                    )}
                    {c.revokedAt ? (
                      <ActionButton
                        size="xs"
                        action={async () => {
                          'use server';
                          return setCollectionRevoked(c.id, false);
                        }}
                      >
                        <RotateCcw /> Etkinleştir
                      </ActionButton>
                    ) : (
                      <ActionButton
                        size="xs"
                        variant="ghost"
                        confirm={{ title: 'Paylaşım bağlantısı iptal edilsin mi?', description: 'Bağlantıyı açan kişiler seçkiyi göremez. Daha sonra yeniden etkinleştirebilirsiniz.', confirmLabel: 'İptal et' }}
                        action={async () => {
                          'use server';
                          return setCollectionRevoked(c.id, true);
                        }}
                      >
                        <Ban /> İptal et
                      </ActionButton>
                    )}
                    <ActionButton
                      size="xs"
                      variant="danger-ghost"
                      confirm={{ title: 'Seçki silinsin mi?', description: 'Seçki ve paylaşım bağlantısı kalıcı olarak silinir.', confirmLabel: 'Sil', destructive: true }}
                      action={async () => {
                        'use server';
                        return deleteCollection(c.id);
                      }}
                    >
                      <Trash2 /> Sil
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
