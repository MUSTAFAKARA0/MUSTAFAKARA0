import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { MessageItem } from '@/components/admin/message-item';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { requireAdminPage } from '@/lib/auth';
import { CONTACT_STATUS_LABELS } from '@/lib/constants';
import { listContacts } from '@/lib/data/admin';
import { cn, firstParam, parsePositiveInt } from '@/lib/utils';
import type { ContactStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Mesajlar' };

const TABS: (ContactStatus | 'all')[] = ['all', 'new', 'read', 'replied', 'archived'];

export default async function MessagesPage({ searchParams }: PageProps<'/admin/mesajlar'>) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const raw = firstParam(sp.durum) as ContactStatus | 'all' | undefined;
  const status = raw && TABS.includes(raw) ? raw : 'all';
  const page = parsePositiveInt(firstParam(sp.sayfa), 1000) || 1;
  const { rows, total, pageCount } = await listContacts(supabase, { status, page });
  const href = (s: string, p = 1) => {
    const q = new URLSearchParams();
    if (s !== 'all') q.set('durum', s);
    if (p > 1) q.set('sayfa', String(p));
    const qs = q.toString();
    return qs ? `/admin/mesajlar?${qs}` : '/admin/mesajlar';
  };

  return (
    <>
      <AdminPageHeader title="Mesajlar" description="Web sitesinden gelen iletişim ve bilgi talepleri." />
      <nav aria-label="Mesaj filtresi" className="scrollbar-none mb-5 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t}
            href={href(t)}
            aria-current={status === t ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
              status === t ? 'bg-brand-700 text-white' : 'bg-surface text-sand-700 ring-1 ring-line hover:bg-sand-50',
            )}
          >
            {t === 'all' ? 'Tümü (arşiv hariç)' : CONTACT_STATUS_LABELS[t]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Mesaj yok" description="Bu görünümde gösterilecek iletişim talebi bulunmuyor." />
      ) : (
        <>
          <p className="mb-3 text-sm text-sand-600">{total} mesaj</p>
          <ul className="space-y-4">
            {rows.map((c) => (
              <MessageItem key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}
      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => href(status, p)} />
    </>
  );
}
