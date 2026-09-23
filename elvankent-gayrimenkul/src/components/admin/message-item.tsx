'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Archive, Check, ExternalLink, Mail, Phone, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/form-controls';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { deleteContact, saveContactNote, updateContactStatus } from '@/app/actions/admin-messages';
import { CONTACT_STATUS_LABELS } from '@/lib/constants';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ContactWithProperty } from '@/lib/data/admin';
import type { ContactStatus } from '@/types/database';

const STATUS_VARIANT: Record<ContactStatus, 'warning' | 'neutral' | 'success' | 'info'> = {
  new: 'warning',
  read: 'neutral',
  replied: 'success',
  archived: 'info',
};

export function MessageItem({ c }: { c: ContactWithProperty }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(c.admin_note ?? '');
  const [noteOpen, setNoteOpen] = useState(Boolean(c.admin_note));
  const [confirm, setConfirm] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        after?.();
        router.refresh();
      } else toast.error(r.error ?? 'İşlem başarısız oldu.');
    });

  const tel = telHref(c.phone);
  const wa = whatsappHref(c.phone, `Merhaba ${c.full_name.split(' ')[0]}, web sitemizden ilettiğiniz mesajınız için yazıyorum.`);

  return (
    <li className={cn('rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70', c.status === 'new' && 'ring-2 ring-accent-300')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-ink">{c.full_name}</h2>
            <Badge variant={STATUS_VARIANT[c.status]}>{CONTACT_STATUS_LABELS[c.status]}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-sand-500">
            {formatDateTime(c.created_at)} · {c.source === 'property_detail' ? 'İlan sayfasından' : 'İletişim sayfasından'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tel && (
            <Button asChild variant="outline" size="sm">
              <a href={tel}>
                <Phone /> Ara
              </a>
            </Button>
          )}
          {wa && (
            <Button asChild variant="whatsapp" size="sm">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> WhatsApp
              </a>
            </Button>
          )}
          {c.email && (
            <Button asChild variant="outline" size="sm">
              <a href={`mailto:${c.email}`}>
                <Mail /> E-posta
              </a>
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-sand-700">
        {c.phone && (
          <div className="flex gap-1.5">
            <dt className="text-sand-500">Telefon:</dt>
            <dd className="font-semibold">{c.phone}</dd>
          </div>
        )}
        {c.email && (
          <div className="flex gap-1.5">
            <dt className="text-sand-500">E-posta:</dt>
            <dd className="font-semibold break-all">{c.email}</dd>
          </div>
        )}
      </dl>

      {c.property && (
        <p className="mt-3 rounded-xl bg-sand-50 px-3.5 py-2.5 text-sm ring-1 ring-line/70">
          <span className="text-sand-500">İlgilenilen ilan: </span>
          <Link href={`/admin/ilan/${c.property.id}`} className="font-semibold text-brand-700 hover:underline">
            {c.property.title}
          </Link>{' '}
          <span className="text-sand-500">(No {c.property.listing_no})</span>{' '}
          <a href={`/ilan/${c.property.slug}`} target="_blank" rel="noopener noreferrer" aria-label="İlanı sitede aç" className="inline-flex align-middle text-sand-500 hover:text-brand-700">
            <ExternalLink className="size-3.5" />
          </a>
        </p>
      )}

      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink">{c.message}</p>

      {noteOpen && (
        <div className="mt-4">
          <label htmlFor={`note-${c.id}`} className="mb-1 block text-[13px] font-semibold text-sand-700">
            Özel not (sadece siz görürsünüz)
          </label>
          <Textarea id={`note-${c.id}`} rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="subtle" className="mt-2" loading={pending} onClick={() => act(() => saveContactNote(c.id, note), 'Not kaydedildi')}>
            Notu kaydet
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
        {c.status !== 'replied' && (
          <Button size="sm" variant="subtle" disabled={pending} onClick={() => act(() => updateContactStatus(c.id, 'replied'), 'Yanıtlandı olarak işaretlendi')}>
            <Check /> Yanıtlandı
          </Button>
        )}
        {c.status === 'new' && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateContactStatus(c.id, 'read'), 'Okundu olarak işaretlendi')}>
            Okundu
          </Button>
        )}
        {c.status !== 'archived' && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => updateContactStatus(c.id, 'archived'), 'Arşive taşındı')}>
            <Archive /> Arşivle
          </Button>
        )}
        {!noteOpen && (
          <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}>
            <StickyNote /> Not ekle
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-red-50" onClick={() => setConfirm(true)}>
          <Trash2 /> Sil
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title="Mesaj silinsin mi?" description="Bu iletişim talebi kalıcı olarak silinecek. KVKK kapsamında silme talebi gelen kayıtlar için bu seçeneği kullanın.">
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Vazgeç</Button>
            </DialogClose>
            <Button variant="danger" loading={pending} onClick={() => act(() => deleteContact(c.id), 'Mesaj silindi', () => setConfirm(false))}>
              <Trash2 /> Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
