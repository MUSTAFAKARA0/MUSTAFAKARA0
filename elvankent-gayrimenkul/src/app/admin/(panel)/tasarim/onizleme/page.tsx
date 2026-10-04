import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock, Monitor, Smartphone } from 'lucide-react';
import { AdminPageHeader } from '@/components/panel/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectableFamilies } from '@/modules/platform/design-access';
import { requirePagePermission } from '@/platform/auth/session';
import { parseSiteConfig } from '@/site-config/schema';
import { DESIGN_FAMILIES } from '@/site-factory/families';

export const metadata: Metadata = { title: 'Tasarım önizlemesi' };

const SURFACES = [
  { id: 'ana-sayfa', label: 'Ana sayfa' },
  { id: 'ilanlar', label: 'Arama / ilanlar' },
  { id: 'ilan', label: 'İlan detayı' },
] as const;
const DEVICES = [
  { id: 'masaustu', label: 'Masaüstü', icon: Monitor },
  { id: 'mobil', label: 'Telefon', icon: Smartphone },
] as const;

const pick = <T extends { id: string }>(list: readonly T[], raw: unknown): T => list.find((x) => x.id === raw) ?? list[0];

/**
 * Ofis yöneticisi › Site tasarımı › Önizle: izinli bir tasarım ailesini YAYINLAMADAN, sitenin
 * gerçek verisiyle ana sayfa, arama ve ilan detayında görür. Çerçeve /site-onizleme/ofis
 * (aynı köken); yetki ve aile izni orada da ayrıca doğrulanır. Yalnızca izinli aileler listelenir.
 */
export default async function OfficeDesignPreviewPage({ searchParams }: PageProps<'/admin/tasarim/onizleme'>) {
  const ctx = await requirePagePermission('settings.manage');
  const sp = await searchParams;
  const [access, site] = await Promise.all([
    selectableFamilies(ctx.supabase, ctx.org.id),
    ctx.supabase.from('site_configs').select('published').eq('organization_id', ctx.org.id).maybeSingle(),
  ]);
  const families = DESIGN_FAMILIES.filter((f) => access.families.includes(f.id));
  const currentId = parseSiteConfig(site.data?.published).style.origin?.family ?? null;
  const family = families.find((f) => f.id === sp.aile) ?? families.find((f) => f.id === currentId) ?? families[0];
  const surface = pick(SURFACES, sp.s);
  const device = pick(DEVICES, sp.g);
  const href = (q: { aile?: string; s?: string; g?: string }) =>
    `/admin/tasarim/onizleme?${new URLSearchParams({ aile: q.aile ?? family?.id ?? '', s: q.s ?? surface.id, g: q.g ?? device.id })}`;

  return (
    <>
      <AdminPageHeader
        title="Tasarım önizlemesi"
        description="Tasarımı yayınlamadan sitenizin gerçek ilanları ve içerikleriyle görün. Önizleme hiçbir şeyi değiştirmez."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/site/tasarim">
              <ArrowLeft /> Site yönetimi › Tasarım
            </Link>
          </Button>
        }
      />
      {!family ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold">Önizlenebilecek tasarım yok</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-muted-foreground">KARAY ekibi sizin için tasarım açtığında burada önizleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <nav aria-label="Tasarım" className="flex flex-wrap gap-2">
              {families.map((f) => (
                <Link
                  key={f.id}
                  href={href({ aile: f.id })}
                  aria-current={f.id === family.id ? 'page' : undefined}
                  className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold ring-1 transition', f.id === family.id ? 'bg-foreground text-background ring-foreground' : 'bg-surface text-muted-foreground ring-border hover:text-foreground')}
                >
                  {f.name}
                  {f.id === currentId ? ' · kullanılıyor' : ''}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav aria-label="Sayfa" className="flex flex-wrap rounded-full bg-surface-muted p-1 ring-1 ring-border">
                {SURFACES.map((x) => (
                  <Link
                    key={x.id}
                    href={href({ s: x.id })}
                    aria-current={x.id === surface.id ? 'page' : undefined}
                    className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium transition', x.id === surface.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {x.label}
                  </Link>
                ))}
              </nav>
              <nav aria-label="Cihaz" className="flex rounded-full bg-surface-muted p-1 ring-1 ring-border">
                {DEVICES.map((x) => (
                  <Link
                    key={x.id}
                    href={href({ g: x.id })}
                    aria-label={x.label}
                    title={x.label}
                    aria-current={x.id === device.id ? 'page' : undefined}
                    className={cn('grid size-8 place-items-center rounded-full transition', x.id === device.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <x.icon className="size-4" aria-hidden />
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border">
            <iframe
              key={`${family.id}-${surface.id}`}
              title={`${family.name} · ${surface.label} önizlemesi`}
              src={`/site-onizleme/ofis?${new URLSearchParams({ aile: family.id, s: surface.id })}`}
              className="mx-auto block max-w-full border-0 bg-white"
              style={{ height: 760, width: device.id === 'mobil' ? 390 : '100%' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
