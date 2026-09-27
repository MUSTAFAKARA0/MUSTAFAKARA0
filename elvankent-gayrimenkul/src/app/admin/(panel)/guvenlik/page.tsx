import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { AuditList } from '@/components/admin/audit-list';
import { AdminPageHeader, EmptyPanel, Panel } from '@/components/admin/ui';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { formatNumber } from '@/lib/format';
import { firstParam, parsePositiveInt } from '@/lib/utils';
import { AUDIT_CATEGORIES, type AuditCategory } from '@/modules/audit/labels';
import { listAuditLogs } from '@/modules/audit/queries';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Güvenlik ve işlem kayıtları' };

const DAYS = [1, 7, 30, 90];

export default async function SecurityLogPage({ searchParams }: PageProps<'/admin/guvenlik'>) {
  const ctx = await requirePagePermission('audit.read');
  const sp = await searchParams;
  const category = (Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).find((c) => c === firstParam(sp.kategori));
  const days = DAYS.includes(Number(firstParam(sp.tarih))) ? Number(firstParam(sp.tarih)) : undefined;
  const actorId = firstParam(sp.kisi);
  const q = firstParam(sp.q);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const [{ rows, total, pageCount }, { data: members }] = await Promise.all([
    listAuditLogs(ctx.supabase, { orgId: ctx.org.id, category, actorId, days, q, page }),
    ctx.supabase.rpc('list_org_members', { p_org: ctx.org.id }),
  ]);
  const filtered = Boolean(category || days || actorId || q);
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = firstParam(v);
      if (value && k !== 'sayfa') params.set(k, value);
    }
    if (p > 1) params.set('sayfa', String(p));
    const qs = params.toString();
    return qs ? `/admin/guvenlik?${qs}` : '/admin/guvenlik';
  };

  return (
    <>
      <AdminPageHeader
        title="Güvenlik ve işlem kayıtları"
        description="Kim, ne zaman, hangi kayıtta ne yaptı. Kayıtlar değiştirilemez; şifre ve oturum bilgisi tutulmaz. Kayıtlar 2 yıl saklanır."
      />
      <Panel bodyClassName="p-0 sm:p-0">
        <form action="/admin/guvenlik" className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5" aria-label="Kayıt filtreleri">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="log-q" className="sr-only">
              Kayıtta ara
            </label>
            <Input id="log-q" name="q" defaultValue={q} placeholder="İlan, kişi, içerik adı" className="h-10" />
          </div>
          <div>
            <label htmlFor="log-kategori" className="sr-only">
              Kategori
            </label>
            <Select id="log-kategori" name="kategori" defaultValue={category ?? ''} className="h-10">
              <option value="">Tüm işlemler</option>
              {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[])
                .filter((c) => c !== 'platform')
                .map((c) => (
                  <option key={c} value={c}>
                    {AUDIT_CATEGORIES[c].label}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label htmlFor="log-kisi" className="sr-only">
              Kişi
            </label>
            <Select id="log-kisi" name="kisi" defaultValue={actorId ?? ''} className="h-10">
              <option value="">Tüm kişiler</option>
              {(members ?? []).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || 'Kullanıcı'}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="log-tarih" className="sr-only">
              Tarih
            </label>
            <Select id="log-tarih" name="tarih" defaultValue={days ? String(days) : ''} className="h-10">
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
            {filtered && (
              <Button asChild size="sm" variant="ghost" className="h-10">
                <Link href="/admin/guvenlik">Temizle</Link>
              </Button>
            )}
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyPanel icon={ShieldCheck} title={filtered ? 'Bu filtrelere uygun kayıt yok' : 'Henüz kayıt yok'} />
        ) : (
          <>
            <AuditList rows={rows} />
            <p className="border-t border-border px-6 py-3 text-[12.5px] text-muted-foreground">{formatNumber(total)} kayıt</p>
          </>
        )}
      </Panel>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}
