import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { ShieldCheck } from 'lucide-react';
import { AuditList } from '@/components/panel/audit-list';
import { AdminPageHeader, EmptyPanel, Panel } from '@/components/panel/ui';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { formatNumber } from '@/lib/format';
import { firstParam, isUuid, parsePositiveInt } from '@/lib/utils';
import { AUDIT_CATEGORIES, type AuditCategory } from '@/modules/audit/labels';
import { listAuditLogs } from '@/modules/audit/queries';
import { listPlatformOrgs } from '@/modules/platform/queries';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Sistem kayıtları' };

const DAYS = [1, 7, 30, 90];

export default async function PlatformLogsPage({ searchParams }: PageProps<'/platform/kayitlar'>) {
  const session = await requireSuperAdminPage();
  const sp = await searchParams;
  const orgParam = firstParam(sp.org);
  const orgId = orgParam === 'platform' ? null : isUuid(orgParam) ? orgParam : undefined;
  const category = (Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).find((c) => c === firstParam(sp.kategori));
  const days = DAYS.includes(Number(firstParam(sp.tarih))) ? Number(firstParam(sp.tarih)) : undefined;
  const q = firstParam(sp.q);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const [orgs, { rows, total, pageCount }] = await Promise.all([listPlatformOrgs(session), listAuditLogs(session.supabase, { orgId, category, days, q, page })]);
  const orgNames = new Map(orgs.map((o) => [o.id, o.name]));
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = firstParam(v);
      if (value && k !== 'sayfa') params.set(k, value);
    }
    if (p > 1) params.set('sayfa', String(p));
    const qs = params.toString();
    return qs ? `/platform/kayitlar?${qs}` : '/platform/kayitlar';
  };

  return (
    <>
      <AdminPageHeader title="Sistem kayıtları" description="Tüm organizasyonların ve platformun denetim kayıtları: giriş denemeleri, yetkisiz erişimler, veri değişiklikleri ve dışa aktarmalar." />
      <Panel bodyClassName="p-0 sm:p-0">
        <form action="/platform/kayitlar" className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5" aria-label="Kayıt filtreleri">
          <div>
            <label htmlFor="pl-q" className="sr-only">
              Kayıtta ara
            </label>
            <Input id="pl-q" name="q" defaultValue={q} placeholder="Hedef adında ara" className="h-10" />
          </div>
          <div>
            <label htmlFor="pl-org" className="sr-only">
              Organizasyon
            </label>
            <Select id="pl-org" name="org" defaultValue={orgParam ?? ''} className="h-10">
              <option value="">Tüm organizasyonlar</option>
              <option value="platform">Yalnızca platform</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="pl-kategori" className="sr-only">
              Kategori
            </label>
            <Select id="pl-kategori" name="kategori" defaultValue={category ?? ''} className="h-10">
              <option value="">Tüm işlemler</option>
              {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => (
                <option key={c} value={c}>
                  {AUDIT_CATEGORIES[c].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="pl-tarih" className="sr-only">
              Tarih
            </label>
            <Select id="pl-tarih" name="tarih" defaultValue={days ? String(days) : ''} className="h-10">
              <option value="">Tüm zamanlar</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? 'Son 24 saat' : `Son ${d} gün`}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-10 flex-1">
              Filtrele
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-10">
              <Link href="/platform/kayitlar">Temizle</Link>
            </Button>
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyPanel icon={ShieldCheck} title="Kayıt bulunamadı" />
        ) : (
          <>
            <AuditList rows={rows} orgNames={orgNames} linkTargets={false} />
            <p className="border-t border-border px-6 py-3 text-[12.5px] text-muted-foreground">{formatNumber(total)} kayıt</p>
          </>
        )}
      </Panel>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}
