'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { DropdownMenu } from 'radix-ui';
import { ExternalLink, EyeOff, MoreHorizontal, Pencil, Rocket, Star, StarOff, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/form-controls';
import { NumberInput } from '@/components/forms/number-input';
import {
  deleteProperty,
  setPropertyFeatured,
  setPropertyStatus,
  updatePropertyPrice,
} from '@/app/actions/admin-properties';
import type { PropertyStatus } from '@/types/database';

interface Props {
  id: string;
  slug: string;
  title: string;
  status: PropertyStatus;
  isFeatured: boolean;
  price: number;
}

const itemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink outline-none data-[highlighted]:bg-sand-100 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45';

export function PropertyRowActions({ id, slug, title, status, isFeatured, price }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(String(Math.round(price)));
  const isActive = status === 'active';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else {
        toast.error(res.error ?? 'İşlem başarısız oldu.');
      }
    });

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/ilan/${id}`} title="Düzenle">
          <Pencil /> <span className="md:max-xl:sr-only">Düzenle</span>
        </Link>
      </Button>
      <Button
        variant={isActive ? 'ghost' : 'subtle'}
        size="sm"
        loading={pending}
        onClick={() =>
          run(
            () => setPropertyStatus(id, isActive ? 'passive' : 'active'),
            isActive ? 'İlan yayından kaldırıldı' : 'İlan yayına alındı',
          )
        }
        className="hidden sm:inline-flex"
        title={isActive ? 'Yayından kaldır' : 'Yayına al'}
      >
        {!pending && (isActive ? <EyeOff /> : <Rocket />)}
        {/* Dar tablolarda sadece ikon; ekran okuyucu için metin korunur */}
        <span className="sr-only 2xl:not-sr-only">{isActive ? 'Yayından kaldır' : 'Yayına al'}</span>
      </Button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${title} için diğer işlemler`} disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line">
            <DropdownMenu.Item className={itemClass} disabled={!isActive} asChild={isActive}>
              {isActive ? (
                <a href={`/ilan/${slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> Sitede görüntüle
                </a>
              ) : (
                <span>
                  <ExternalLink className="size-4" /> Sitede görüntüle (yayında değil)
                </span>
              )}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={`${itemClass} sm:hidden`}
              onSelect={() =>
                run(
                  () => setPropertyStatus(id, isActive ? 'passive' : 'active'),
                  isActive ? 'İlan yayından kaldırıldı' : 'İlan yayına alındı',
                )
              }
            >
              {isActive ? <EyeOff className="size-4" /> : <Rocket className="size-4" />}
              {isActive ? 'Yayından kaldır' : 'Yayına al'}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={itemClass}
              onSelect={() =>
                run(() => setPropertyFeatured(id, !isFeatured), isFeatured ? 'Öne çıkarma kaldırıldı' : 'İlan öne çıkarıldı')
              }
            >
              {isFeatured ? <StarOff className="size-4" /> : <Star className="size-4" />}
              {isFeatured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => setPriceOpen(true)}>
              <Tag className="size-4" /> Fiyatı değiştir
            </DropdownMenu.Item>
            {(['sold', 'rented', 'draft'] as PropertyStatus[])
              .filter((s) => s !== status)
              .map((s) => (
                <DropdownMenu.Item
                  key={s}
                  className={itemClass}
                  onSelect={() => run(() => setPropertyStatus(id, s), 'İlan durumu güncellendi')}
                >
                  <span className="size-4" aria-hidden />
                  {s === 'sold' ? 'Satıldı olarak işaretle' : s === 'rented' ? 'Kiralandı olarak işaretle' : 'Taslağa al'}
                </DropdownMenu.Item>
              ))}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item className={`${itemClass} text-danger`} onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> İlanı sil
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title="İlan silinsin mi?" description={`“${title}” ilanı ve tüm fotoğrafları kalıcı olarak silinecek. Bu işlem geri alınamaz.`}>
          <p className="mt-3 text-sm text-sand-600">
            İlanı yalnızca geçici olarak gizlemek istiyorsanız “Yayından kaldır” seçeneğini kullanın.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Vazgeç</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(() => deleteProperty(id), 'İlan silindi', () => setConfirmDelete(false))}
            >
              <Trash2 /> Kalıcı olarak sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent title="Fiyatı değiştir" description={title}>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updatePropertyPrice(id, Number(newPrice)), 'Fiyat güncellendi', () => setPriceOpen(false));
            }}
          >
            <Label htmlFor={`price-${id}`}>Yeni fiyat</Label>
            <NumberInput id={`price-${id}`} value={newPrice} onValueChange={setNewPrice} autoFocus />
            <div className="mt-6 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" type="button">
                  Vazgeç
                </Button>
              </DialogClose>
              <Button type="submit" loading={pending} disabled={!newPrice || Number(newPrice) <= 0}>
                Kaydet
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
