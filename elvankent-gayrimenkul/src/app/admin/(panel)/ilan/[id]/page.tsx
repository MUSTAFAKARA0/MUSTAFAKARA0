import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Eye, Heart, MessageSquareText, Phone, Share2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PropertyForm } from '@/components/admin/property-form';
import { StatusBadge } from '@/components/admin/status-badge';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { Button } from '@/components/ui/button';
import { requireAdminPage } from '@/lib/auth';
import { getAdminProperty } from '@/lib/data/admin';
import { getTaxonomy } from '@/lib/data/taxonomy';
import { formatDateTime, formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'İlan Düzenle' };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPropertyPage({ params }: PageProps<'/admin/ilan/[id]'>) {
  const { id } = await params;
  if (!uuidRe.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [detail, tax] = await Promise.all([getAdminProperty(supabase, id), getTaxonomy()]);
  if (!detail) notFound();
  const { property: p, stats } = detail;

  const metrics = [
    { label: 'Görüntülenme', value: stats?.view_count ?? 0, icon: Eye },
    { label: 'Telefon', value: stats?.phone_click_count ?? 0, icon: Phone },
    { label: 'WhatsApp', value: stats?.whatsapp_click_count ?? 0, icon: WhatsAppIcon },
    { label: 'Form', value: stats?.contact_form_count ?? 0, icon: MessageSquareText },
    { label: 'Favori', value: stats?.favorite_count ?? 0, icon: Heart },
    { label: 'Paylaşım', value: stats?.share_count ?? 0, icon: Share2 },
  ];

  return (
    <>
      <AdminPageHeader
        title="İlanı Düzenle"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>İlan No {p.listing_no}</span>
            <StatusBadge status={p.status} />
            <span className="text-sand-500">· Son güncelleme {formatDateTime(p.updated_at)}</span>
          </span>
        }
        action={
          p.status === 'active' ? (
            <Button asChild variant="outline">
              <a href={`/ilan/${p.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Sitede görüntüle
              </a>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href="/admin/ilanlar">İlanlara dön</Link>
            </Button>
          )
        }
      />
      <ul className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="İlan istatistikleri">
        {metrics.map(({ label, value, icon: Icon }) => (
          <li key={label} className="rounded-xl bg-surface px-3 py-2.5 ring-1 ring-line/70">
            <span className="flex items-center gap-1.5 text-[12px] text-sand-500">
              <Icon className="size-3.5" aria-hidden /> {label}
            </span>
            <span className="text-lg font-bold text-ink tabular-nums">{formatNumber(value)}</span>
          </li>
        ))}
      </ul>
      <PropertyForm key={p.updated_at} options={tax} initial={detail} />
    </>
  );
}
