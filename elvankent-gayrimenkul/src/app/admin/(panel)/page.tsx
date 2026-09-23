import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Building2, Eye, Heart, Inbox, MessageSquareText, Phone, Share2, Star, ToggleLeft } from 'lucide-react';
import { AdminCard, AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { ViewsChart } from '@/components/admin/views-chart';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { requireAdminPage } from '@/lib/auth';
import { getDashboardStats, getRecentProperties, listContacts } from '@/lib/data/admin';
import { getSiteSettings } from '@/lib/data/settings';
import { formatDateTime, formatListingPrice, formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Panel' };

export default async function AdminDashboard() {
  const { supabase } = await requireAdminPage();
  const [stats, recent, contacts, settings] = await Promise.all([
    getDashboardStats(supabase),
    getRecentProperties(supabase, 5),
    listContacts(supabase, { page: 1, limit: 5 }),
    getSiteSettings(),
  ]);

  const tiles = [
    { label: 'Toplam ilan', value: stats?.total ?? 0, icon: Building2 },
    { label: 'Yayında', value: stats?.active ?? 0, icon: Eye },
    { label: 'Pasif / kapanan', value: stats?.passive ?? 0, icon: ToggleLeft },
    { label: 'Öne çıkan', value: stats?.featured ?? 0, icon: Star },
    { label: 'Toplam görüntülenme', value: stats?.total_views ?? 0, icon: Eye },
    { label: 'Yeni mesaj', value: stats?.new_contacts ?? 0, icon: Inbox, href: '/admin/mesajlar' },
  ];
  const period = stats?.period;
  const periodTiles = [
    { label: 'Görüntülenme', value: period?.views ?? 0, icon: Eye },
    { label: 'Telefon tıklaması', value: period?.phone_clicks ?? 0, icon: Phone },
    { label: 'WhatsApp tıklaması', value: period?.whatsapp_clicks ?? 0, icon: WhatsAppIcon },
    { label: 'İletişim formu', value: period?.contact_forms ?? 0, icon: MessageSquareText },
    { label: 'Favoriye ekleme', value: period?.favorites ?? 0, icon: Heart },
    { label: 'Paylaşım', value: period?.shares ?? 0, icon: Share2 },
  ];

  return (
    <>
      <AdminPageHeader title="Hoş geldiniz" description="İlanlarınızın ve gelen taleplerin genel durumu." showNewButton />

      {(!settings.phone || (stats?.demo ?? 0) > 0) && (
        <div className="mb-6 space-y-3">
          {!settings.phone && (
            <Notice>
              Telefon numarası henüz girilmemiş; sitede “Ara” ve “WhatsApp” butonları görünmüyor.{' '}
              <Link href="/admin/ayarlar" className="font-bold underline">
                Ayarlar’dan ekleyin
              </Link>
              .
            </Notice>
          )}
          {(stats?.demo ?? 0) > 0 && (
            <Notice>
              Sitede {stats?.demo} adet DEMO ilan var. Kendi ilanlarınızı ekledikten sonra{' '}
              <Link href="/admin/ayarlar#demo" className="font-bold underline">
                tek tıkla silebilirsiniz
              </Link>
              .
            </Notice>
          )}
        </div>
      )}

      {!stats && (
        <Notice>İstatistikler şu anda yüklenemedi. Sayfayı yenilemeyi deneyin.</Notice>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(({ label, value, icon: Icon, href }) => {
          const inner = (
            <>
              <Icon className="size-5 text-brand-600" aria-hidden />
              <p className="mt-3 text-2xl font-extrabold text-ink tabular-nums">{formatNumber(value)}</p>
              <p className="mt-0.5 text-[13px] text-sand-600">{label}</p>
            </>
          );
          return (
            <li key={label} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line/70">
              {href ? (
                <Link href={href} className="block">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Son 30 gün">
          <ViewsChart data={(stats?.daily ?? []).map((d) => ({ day: d.day, views: d.views }))} />
          <ul className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-3">
            {periodTiles.map(({ label, value, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg leading-tight font-bold text-ink tabular-nums">{formatNumber(value)}</span>
                  <span className="block text-[12px] text-sand-500">{label}</span>
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard
          title="Son iletişim talepleri"
          action={
            <Link href="/admin/mesajlar" className="text-sm font-semibold text-brand-700 hover:underline">
              Tümü
            </Link>
          }
        >
          {contacts.rows.length ? (
            <ul className="divide-y divide-line">
              {contacts.rows.map((c) => (
                <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-ink">{c.full_name}</p>
                    {c.status === 'new' && (
                      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-bold text-accent-800">Yeni</span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-sand-600">{c.message}</p>
                  <p className="mt-1 text-[12px] text-sand-500">
                    {formatDateTime(c.created_at)}
                    {c.property && ` · İlan ${c.property.listing_no}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-sand-500">Henüz iletişim talebi yok.</p>
          )}
        </AdminCard>
      </div>

      <AdminCard
        className="mt-6"
        title="Son eklenen ilanlar"
        action={
          <Link href="/admin/ilanlar" className="text-sm font-semibold text-brand-700 hover:underline">
            Tüm ilanlar
          </Link>
        }
      >
        {recent.length ? (
          <ul className="divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/admin/ilan/${p.id}`} className="line-clamp-1 font-semibold text-ink hover:text-brand-700">
                    {p.title}
                  </Link>
                  <p className="text-[13px] text-sand-500">
                    No {p.listing_no} · {p.location} · {formatListingPrice(p.price, p.currency, p.listing_type)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-sand-500">Henüz ilan eklenmedi.</p>
        )}
      </AdminCard>
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
