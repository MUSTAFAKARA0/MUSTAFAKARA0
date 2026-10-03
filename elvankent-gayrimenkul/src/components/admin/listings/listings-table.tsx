'use client';

import Link from '@/components/common/intent-link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Heart,
  MoreHorizontal,
  PencilLine,
  QrCode,
  Rocket,
  Star,
  StarOff,
  Trash2,
  X,
} from 'lucide-react';
import { ListingStatusBadge } from '@/components/panel/ui';
import { MediaImage } from '@/components/gallery/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { bulkPropertyAction, duplicateProperty, type BulkAction, type BulkResult } from '@/app/actions/admin-properties';
import { formatListingPrice, formatNumber, formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { AdminListRow } from '@/modules/properties/admin-queries';

interface Permissions {
  publish: boolean;
  delete: boolean;
  create: boolean;
  pdf: boolean;
}

const ACTION_LABELS: Record<BulkAction, { verb: string; done: string }> = {
  publish: { verb: 'Yayınla', done: 'yayınlandı' },
  archive: { verb: 'Arşivle', done: 'arşivlendi' },
  feature: { verb: 'Öne çıkar', done: 'öne çıkarıldı' },
  unfeature: { verb: 'Öne çıkarmayı kaldır', done: 'öne çıkanlardan kaldırıldı' },
  delete: { verb: 'Çöpe taşı', done: 'çöp kutusuna taşındı' },
  restore: { verb: 'Geri yükle', done: 'geri yüklendi' },
  purge: { verb: 'Kalıcı olarak sil', done: 'kalıcı olarak silindi' },
};

const CONFIRM: Partial<Record<BulkAction, { title: string; description: string; destructive?: boolean }>> = {
  delete: {
    title: 'Seçili ilanlar çöp kutusuna taşınsın mı?',
    description: 'İlanlar sitede yayından kalkar. Çöp kutusundan istediğiniz zaman geri yükleyebilirsiniz.',
  },
  purge: {
    title: 'Seçili ilanlar kalıcı olarak silinsin mi?',
    description: 'İlan bilgileri, fotoğrafları ve istatistikleri kalıcı olarak silinir. Bu işlem geri alınamaz.',
    destructive: true,
  },
  archive: {
    title: 'Seçili ilanlar arşivlensin mi?',
    description: 'Arşivlenen ilanlar sitede görünmez; daha sonra yeniden yayınlayabilirsiniz.',
  },
};

function RowMenu({
  row,
  trash,
  perms,
  onAction,
  onDuplicate,
}: {
  row: AdminListRow;
  trash: boolean;
  perms: Permissions;
  onAction: (ids: string[], action: BulkAction) => void;
  onDuplicate: (id: string) => void;
}) {
  const isPublic = ['published', 'sold', 'rented'].includes(row.status) && !row.deletedAt;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`${row.title} için işlemler`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {!trash && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/ilanlar/${row.id}`}>
              <PencilLine /> Düzenle
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={isPublic ? `/ilan/${row.slug}` : `/onizleme/ilan/${row.id}`} target="_blank" rel="noopener noreferrer">
            {isPublic ? <ExternalLink /> : <Eye />} {isPublic ? 'Sitede görüntüle' : 'Önizle'}
          </a>
        </DropdownMenuItem>
        {!trash && perms.create && (
          <DropdownMenuItem onSelect={() => onDuplicate(row.id)}>
            <Copy /> Kopyasını oluştur
          </DropdownMenuItem>
        )}
        {!trash && (
          <DropdownMenuItem asChild>
            <a href={`/api/admin/properties/${row.id}/qr?format=png`} download={`${row.referenceNo}-qr.png`}>
              <QrCode /> QR kodu indir
            </a>
          </DropdownMenuItem>
        )}
        {!trash && perms.pdf && (
          <DropdownMenuItem asChild>
            <a href={`/admin/ilanlar/${row.id}/brosur`} target="_blank" rel="noopener noreferrer">
              <FileText /> PDF broşür
            </a>
          </DropdownMenuItem>
        )}
        {perms.delete && <DropdownMenuSeparator />}
        {perms.delete && !trash && (
          <DropdownMenuItem destructive onSelect={() => onAction([row.id], 'delete')}>
            <Trash2 /> Çöpe taşı
          </DropdownMenuItem>
        )}
        {perms.delete && trash && (
          <>
            <DropdownMenuItem onSelect={() => onAction([row.id], 'restore')}>
              <ArchiveRestore /> Geri yükle
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => onAction([row.id], 'purge')}>
              <Trash2 /> Kalıcı olarak sil
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Thumb({ row }: { row: AdminListRow }) {
  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:size-16">
      {row.cover && <MediaImage media={row.cover} alt="" fill sizes="64px" className="object-cover" />}
    </span>
  );
}

export function ListingsTable({ rows, trash, perms }: { rows: AdminListRow[]; trash: boolean; perms: Permissions }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; action: BulkAction } | null>(null);
  const [failures, setFailures] = useState<{ result: BulkResult; action: BulkAction } | null>(null);
  const [pending, startTransition] = useTransition();
  const titles = useMemo(() => new Map(rows.map((r) => [r.id, `${r.referenceNo} · ${r.title}`])), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(ids: string[], action: BulkAction) {
    const res = await bulkPropertyAction(ids, action);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const { done, failed } = res.data;
    if (done > 0) toast.success(`${done} ilan ${ACTION_LABELS[action].done}.`);
    if (failed.length > 0) setFailures({ result: res.data, action });
    setSelected(new Set());
    startTransition(() => router.refresh());
    return true;
  }

  function request(ids: string[], action: BulkAction) {
    if (CONFIRM[action]) setConfirm({ ids, action });
    else void run(ids, action);
  }

  async function duplicate(id: string) {
    const res = await duplicateProperty(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? 'İlan kopyalandı.');
    router.push(`/admin/ilanlar/${res.data.id}`);
  }

  const bulkActions: BulkAction[] = trash
    ? perms.delete
      ? ['restore', 'purge']
      : []
    : [...(perms.publish ? (['publish', 'archive', 'feature', 'unfeature'] as BulkAction[]) : []), ...(perms.delete ? (['delete'] as BulkAction[]) : [])];

  return (
    <>
      {/* Masaüstü tablo */}
      <div className={cn('hidden md:block', pending && 'opacity-60 transition-opacity')}>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3">
                {bulkActions.length > 0 && (
                  <input
                    type="checkbox"
                    aria-label="Sayfadaki tüm ilanları seç"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-[18px] cursor-pointer rounded-[5px] accent-[var(--primary)]"
                  />
                )}
              </th>
              <th className="px-2 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">İlan</th>
              <th className="px-3 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">Durum</th>
              <th className="px-3 py-3 text-right text-[12px] font-bold tracking-wide text-muted-foreground uppercase">Fiyat</th>
              <th className="hidden px-3 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase xl:table-cell">Konum</th>
              <th className="hidden px-3 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase lg:table-cell">Etkileşim</th>
              <th className="px-3 py-3 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">{trash ? 'Silinme' : 'Güncelleme'}</th>
              <th className="w-12 px-3 py-3">
                <span className="sr-only">İşlemler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn('border-b border-border last:border-0 hover:bg-surface-muted/50', selected.has(row.id) && 'bg-primary-soft/40')}>
                <td className="px-4 py-3">
                  {bulkActions.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label={`${row.title} seç`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="size-[18px] cursor-pointer rounded-[5px] accent-[var(--primary)]"
                    />
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3.5">
                    <Thumb row={row} />
                    <div className="min-w-0">
                      {trash ? (
                        <span className="line-clamp-1 font-semibold">{row.title}</span>
                      ) : (
                        <Link href={`/admin/ilanlar/${row.id}`} className="line-clamp-1 font-semibold hover:underline">
                          {row.title}
                        </Link>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
                        <span className="numeric">{row.referenceNo}</span>
                        <span>
                          {LISTING_TYPE_LABELS[row.listingType]} · {row.typeName}
                        </span>
                        <span>{row.photos} fotoğraf</span>
                        {row.isFeatured && (
                          <Badge variant="accent-soft">
                            <Star /> Öne çıkan
                          </Badge>
                        )}
                        {row.isDemo && <Badge variant="neutral">Demo</Badge>}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <ListingStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
                </td>
                <td className="numeric px-3 py-3 text-right font-semibold whitespace-nowrap">{formatListingPrice(row.price, row.currency, row.listingType)}</td>
                <td className="hidden px-3 py-3 text-[13px] text-muted-foreground xl:table-cell">{row.location || '—'}</td>
                <td className="hidden px-3 py-3 text-[13px] text-muted-foreground lg:table-cell">
                  <span className="numeric inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1" title="Görüntülenme">
                      <Eye className="size-3.5" aria-hidden /> {formatNumber(row.views)}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Favori">
                      <Heart className="size-3.5" aria-hidden /> {formatNumber(row.favorites)}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-[13px] whitespace-nowrap text-muted-foreground">{formatRelativeDate(row.deletedAt ?? row.updatedAt)}</td>
                <td className="px-3 py-3">
                  <RowMenu row={row} trash={trash} perms={perms} onAction={request} onDuplicate={duplicate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kartlar */}
      <ul className={cn('divide-y divide-border md:hidden', pending && 'opacity-60')}>
        {rows.map((row) => (
          <li key={row.id} className={cn('flex items-start gap-3 px-4 py-4', selected.has(row.id) && 'bg-primary-soft/40')}>
            {bulkActions.length > 0 && (
              <input
                type="checkbox"
                aria-label={`${row.title} seç`}
                checked={selected.has(row.id)}
                onChange={() => toggle(row.id)}
                className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
              />
            )}
            <Thumb row={row} />
            <div className="min-w-0 flex-1">
              {trash ? (
                <p className="line-clamp-2 text-[14px] font-semibold">{row.title}</p>
              ) : (
                <Link href={`/admin/ilanlar/${row.id}`} className="line-clamp-2 text-[14px] font-semibold">
                  {row.title}
                </Link>
              )}
              <p className="numeric mt-0.5 text-[12.5px] text-muted-foreground">
                {row.referenceNo} · {formatListingPrice(row.price, row.currency, row.listingType)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <ListingStatusBadge status={row.status} deleted={Boolean(row.deletedAt)} />
                {row.isFeatured && <Badge variant="accent-soft">Öne çıkan</Badge>}
                {row.isDemo && <Badge variant="neutral">Demo</Badge>}
              </div>
            </div>
            <RowMenu row={row} trash={trash} perms={perms} onAction={request} onDuplicate={duplicate} />
          </li>
        ))}
      </ul>

      {/* Toplu işlem çubuğu */}
      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-surface-inverse p-2.5 pl-4 text-white shadow-lg sm:inset-x-6 lg:left-[calc(17rem+1.5rem)]">
          <span className="mr-auto text-sm font-semibold">{selected.size} ilan seçildi</span>
          {bulkActions.map((action) => {
            const Icon = { publish: Rocket, archive: Archive, feature: Star, unfeature: StarOff, delete: Trash2, restore: ArchiveRestore, purge: Trash2 }[action];
            return (
              <Button
                key={action}
                size="sm"
                variant={action === 'delete' || action === 'purge' ? 'danger' : 'inverse'}
                onClick={() => request([...selected], action)}
                disabled={pending}
              >
                <Icon /> <span className="hidden sm:inline">{ACTION_LABELS[action].verb}</span>
              </Button>
            );
          })}
          <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelected(new Set())} aria-label="Seçimi temizle">
            <X />
          </Button>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirm(null)}
          title={CONFIRM[confirm.action]?.title ?? ''}
          description={CONFIRM[confirm.action]?.description}
          destructive={CONFIRM[confirm.action]?.destructive}
          confirmLabel={ACTION_LABELS[confirm.action].verb}
          onConfirm={() => run(confirm.ids, confirm.action)}
        >
          {confirm.ids.length <= 5 && (
            <ul className="mt-4 space-y-1 text-[13px] text-muted-foreground">
              {confirm.ids.map((id) => (
                <li key={id} className="truncate">
                  • {titles.get(id)}
                </li>
              ))}
            </ul>
          )}
        </ConfirmDialog>
      )}

      {failures && (
        <Dialog open onOpenChange={(open) => !open && setFailures(null)}>
          <DialogContent
            title={`${failures.result.failed.length} ilan için işlem yapılamadı`}
            description={`"${ACTION_LABELS[failures.action].verb}" işlemi aşağıdaki ilanlara uygulanamadı:`}
          >
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {failures.result.failed.map((f) => (
                <li key={f.id} className="rounded-xl bg-surface-muted p-3 text-sm">
                  <p className="font-semibold">{titles.get(f.id) ?? f.id}</p>
                  <p className="mt-0.5 text-muted-foreground">{f.error}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setFailures(null)}>Tamam</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
