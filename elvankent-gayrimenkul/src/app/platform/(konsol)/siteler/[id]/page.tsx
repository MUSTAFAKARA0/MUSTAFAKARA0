import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { CheckCircle2, Circle } from 'lucide-react';
import { Panel } from '@/components/admin/ui';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { SiteStatusForm } from '@/components/platform/site/status-form';
import { formatDate } from '@/lib/format';
import { getSiteOr404 } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';
import { findPalette } from '@/platform/site/palettes';
import { THEMES } from '@/platform/site/themes';

export const metadata: Metadata = { title: 'Site Kontrol Merkezi' };

export default async function SiteGeneralPage({ params }: PageProps<'/platform/siteler/[id]'>) {
  const session = await requireSuperAdminPage();
  const site = await getSiteOr404(session, (await params).id);
  const d = site.draft;
  const colorLabel = d.colors.mode === 'brand' ? 'Ofisin marka renkleri' : `${findPalette(d.colors.preset)?.name ?? 'Palet'}${d.colors.mode === 'custom' ? ' (özelleştirilmiş)' : ''}`;
  const rows: [string, string, string][] = [
    ['Tema', THEMES[d.theme].name, 'tema'],
    ['Renkler', colorLabel, 'renkler'],
    ['Menü', d.navigation ? `${d.navigation.length} öğe (özel)` : 'Varsayılan menü', 'menu'],
    ['Ana sayfa', d.home ? `${d.home.sections.filter((s) => s.enabled).length} bölüm (özel sıra)` : 'Varsayılan bölümler', 'ana-sayfa'],
    ['SEO', d.seo.robots === 'noindex' ? 'Arama motorlarına kapalı' : 'Arama motorlarına açık', 'seo'],
  ];
  // Kurulum kontrol listesi (gerçek kayıtlardan; taslaktaki marka dahil)
  const b = site.brand;
  const checklist: { label: string; done: boolean; tab: string }[] = [
    { label: 'Logo yüklendi', done: Boolean(b.logo_url), tab: 'marka' },
    { label: 'İletişim bilgisi (telefon veya e-posta)', done: Boolean(b.phone || b.email), tab: 'marka' },
    { label: 'Adres girildi', done: Boolean(b.address_line || b.address_city), tab: 'marka' },
    { label: 'Tema seçildi', done: 'theme' in site.draftRaw, tab: 'tema' },
    { label: 'SEO başlığı ve açıklaması', done: Boolean((d.seo.title || site.settings.seo_title) && (d.seo.description || site.settings.seo_description)), tab: 'seo' },
    { label: 'Paylaşım görseli', done: Boolean(b.og_image_url), tab: 'marka' },
    { label: 'Özel alan adı bağlandı', done: Boolean(site.primaryDomain), tab: 'alan-adi' },
    { label: 'Site yayınlandı', done: site.version > 0 && site.status === 'active', tab: '' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <Panel
          title="Kurulum kontrol listesi"
          description={doneCount === checklist.length ? 'Tüm adımlar tamam.' : `${doneCount} / ${checklist.length} adım tamam — eksikler sitenin profesyonel görünmesini ve bulunmasını etkiler.`}
        >
          <Progress value={(doneCount / checklist.length) * 100} label="Kurulum ilerlemesi" className="mb-4" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  href={`/platform/siteler/${site.org.id}${c.tab ? `/${c.tab}` : ''}`}
                  className={cn('flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-[13.5px] transition hover:border-border-strong', c.done ? 'border-border text-muted-foreground' : 'border-amber-300 bg-amber-50/60 font-semibold text-foreground')}
                >
                  {c.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden /> : <Circle className="size-4 shrink-0 text-amber-600" aria-hidden />}
                  <span>{c.label}</span>
                  <span className="sr-only">{c.done ? '(tamam)' : '(eksik)'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Taslak özeti" description="Bu ayarlar taslaktadır; canlı sitede görünmeleri için yukarıdan yayınlayın.">
          <dl className="divide-y divide-border">
            {rows.map(([k, v, tab]) => (
              <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <dt className="text-[13.5px] text-muted-foreground">{k}</dt>
                <dd className="flex items-center gap-3 text-[14px] font-semibold">
                  {v}
                  <Link href={`/platform/siteler/${site.org.id}/${tab}`} className="text-[13px] font-semibold text-primary-ink hover:underline">
                    Düzenle
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Yayın bilgisi">
          <dl className="grid gap-4 text-[14px] sm:grid-cols-3">
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Canlı sürüm</dt>
              <dd className="mt-1 font-semibold">{site.version > 0 ? `Sürüm ${site.version}` : 'Varsayılan görünüm'}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Son yayın</dt>
              <dd className="mt-1 font-semibold">{site.publishedAt ? formatDate(site.publishedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted-foreground">Son taslak değişikliği</dt>
              <dd className="mt-1 font-semibold">{site.draftUpdatedAt ? formatDate(site.draftUpdatedAt) : '—'}</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel id="site-durumu" title="Site durumu" className="scroll-mt-24">
          <SiteStatusForm orgId={site.org.id} status={site.status} message={site.maintenanceMessage} />
        </Panel>
        <Panel title="Nasıl çalışır?">
          <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-muted-foreground">
            <li>Sekmelerde değişiklik yapıp &quot;Taslağa kaydet&quot;e basın.</li>
            <li>&quot;Önizle&quot; ile taslağı canlı siteyi bozmadan görün.</li>
            <li>&quot;Değişiklikleri yayınla&quot; ile canlıya alın (yeni sürüm).</li>
            <li>Sorun olursa Geçmiş sekmesinden önceki sürüme dönün.</li>
          </ol>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Marka dahil tüm görünüm ayarları bu akıştan geçer. Site durumu, domain ve özellikler ise anında geçerlidir.</p>
        </Panel>
      </div>
    </div>
  );
}
