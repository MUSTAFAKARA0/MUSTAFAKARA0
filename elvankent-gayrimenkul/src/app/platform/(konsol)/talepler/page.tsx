import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Inbox, Mail, MapPin, Phone } from 'lucide-react';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { KarayLeadEditor } from '@/components/platform/karay-forms';
import { LEAD_STATUS } from '@/modules/karay/lead-status';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { cn, firstParam } from '@/lib/utils';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'KARAY talepleri' };

const FILTERS = [
  { key: 'acik', label: 'Açık', statuses: ['new', 'contacted', 'qualified'] },
  { key: 'yeni', label: 'Yeni', statuses: ['new'] },
  { key: 'kapali', label: 'Kapananlar', statuses: ['closed'] },
  { key: 'tumu', label: 'Tümü', statuses: ['new', 'contacted', 'qualified', 'closed'] },
] as const;

/**
 * KARAY'a gelen potansiyel müşteri (emlak ofisi) talepleri — /karay formu. Kiracıların
 * kendi talep/CRM kayıtlarından tamamen ayrıdır (ayrı tablo, ayrı yetki).
 */
export default async function KarayLeadsPage({ searchParams }: PageProps<'/platform/talepler'>) {
  const session = await requireSuperAdminPage();
  const key = firstParam((await searchParams).durum) ?? 'acik';
  const filter = FILTERS.find((f) => f.key === key) ?? FILTERS[0];
  const { data, error } = await session.supabase
    .from('platform_leads')
    .select('id, created_at, kind, full_name, email, phone, company, city, message, status, note, handled_at')
    .in('status', [...filter.statuses])
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = error ? [] : (data ?? []);
  return (
    <>
      <AdminPageHeader
        title="KARAY talepleri"
        description="KARAY şirket sayfasındaki (/karay) Bilgi al / Demo talep et formundan gelen emlak ofisi adayları. Ofislerin kendi müşteri talepleriyle karışmaz."
        actions={
          <a href="/karay#iletisim" target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-semibold text-primary-ink hover:underline">
            Formu görüntüle ↗
          </a>
        }
      />
      <nav aria-label="Talep filtresi" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/platform/talepler?durum=${f.key}`}
            aria-current={f.key === filter.key ? 'page' : undefined}
            className={cn('rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold', f.key === filter.key ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-foreground/80 hover:border-border-strong')}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {error && <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Talepler yüklenemedi. KARAY migration&apos;ı (20261002000001) uygulanmış mı?</p>}
      {rows.length === 0 ? (
        <EmptyPanel icon={Inbox} title="Bu filtrede talep yok" description="KARAY sayfasından gelen talepler burada listelenir." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const st = LEAD_STATUS[r.status] ?? LEAD_STATUS.new;
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[15.5px] font-bold">{r.full_name}</span>
                      <Badge variant={r.kind === 'demo' ? 'primary-soft' : 'neutral'}>{r.kind === 'demo' ? 'Demo talebi' : 'Bilgi talebi'}</Badge>
                      <Badge variant={st.tone}>{st.label}</Badge>
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {[r.company, formatDateTime(r.created_at)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
                  {r.email && (
                    <li className="inline-flex items-center gap-1.5">
                      <Mail className="size-4 text-muted-foreground" aria-hidden />
                      <a href={`mailto:${r.email}`} className="break-all hover:underline">
                        {r.email}
                      </a>
                    </li>
                  )}
                  {r.phone && (
                    <li className="inline-flex items-center gap-1.5">
                      <Phone className="size-4 text-muted-foreground" aria-hidden />
                      <a href={`tel:${r.phone.replace(/[^+0-9]/g, '')}`} className="hover:underline">
                        {r.phone}
                      </a>
                    </li>
                  )}
                  {r.city && (
                    <li className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-muted-foreground" aria-hidden /> {r.city}
                    </li>
                  )}
                </ul>
                {r.message && <p className="mt-3 rounded-xl bg-surface-muted px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line">{r.message}</p>}
                <KarayLeadEditor id={r.id} status={r.status} note={r.note} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
