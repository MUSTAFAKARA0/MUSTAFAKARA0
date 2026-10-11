import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { ExternalLink, FileText, ImageIcon, Newspaper, PencilLine, Plus, RotateCcw, Scale, Search, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { AdminPageHeader, EmptyPanel } from '@/components/panel/ui';
import { Pagination } from '@/components/common/pagination';
import { MediaImage } from '@/components/common/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { purgePost, setPostDeleted } from '@/app/actions/admin-content';
import { formatDate, formatRelativeDate } from '@/lib/format';
import { cn, firstParam, isFutureDate, parsePositiveInt } from '@/lib/utils';
import { listAdminPages, listAdminPosts, postCounts, type PostFilter } from '@/modules/content/admin-queries';
import { requirePagePermission } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

export const metadata: Metadata = { title: 'Blog ve içerikler' };

const FILTERS: { value: PostFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'published', label: 'Yayında' },
  { value: 'scheduled', label: 'Zamanlanmış' },
  { value: 'draft', label: 'Taslak' },
  { value: 'cop', label: 'Çöp kutusu' },
];

const tabClass = (active: boolean) =>
  cn(
    'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition',
    active ? 'bg-surface-inverse text-white' : 'text-muted-foreground hover:bg-surface hover:text-foreground',
  );

export default async function ContentPage({ searchParams }: PageProps<'/admin/icerikler'>) {
  const ctx = await requirePagePermission('content.manage');
  const sp = await searchParams;
  const tab = firstParam(sp.sekme) === 'sayfalar' ? 'pages' : 'posts';
  const tenant = await getTenant(ctx.org.slug);
  const siteLink = (path: string) => (tenant ? tenantUrl(tenant, path) : path);

  return (
    <>
      <AdminPageHeader
        title="Blog ve içerikler"
        description="Blog yazıları ve Hakkımızda, Hizmetler, KVKK gibi sabit sayfalar. Metinler güvenli Markdown ile yazılır."
        actions={
          tab === 'posts' && (
            <Button asChild>
              <Link href="/admin/icerikler/yeni">
                <Plus /> Yeni yazı
              </Link>
            </Button>
          )
        }
      />
      <nav aria-label="İçerik türü" className="scrollbar-none relative -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link href="/admin/icerikler" aria-current={tab === 'posts' ? 'page' : undefined} className={tabClass(tab === 'posts')}>
          <Newspaper className="size-4" aria-hidden /> Blog yazıları
        </Link>
        <Link href="/admin/icerikler?sekme=sayfalar" aria-current={tab === 'pages' ? 'page' : undefined} className={tabClass(tab === 'pages')}>
          <FileText className="size-4" aria-hidden /> Sayfalar
        </Link>
      </nav>
      {tab === 'posts' ? <PostsTab sp={sp} siteLink={siteLink} ctx={ctx} /> : <PagesTab ctx={ctx} siteLink={siteLink} />}
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof requirePagePermission>>;

async function PostsTab({ sp, siteLink, ctx }: { sp: Record<string, string | string[] | undefined>; siteLink: (path: string) => string; ctx: Ctx }) {
  const filter = (FILTERS.some((f) => f.value === firstParam(sp.durum)) ? firstParam(sp.durum) : 'all') as PostFilter;
  const q = firstParam(sp.q);
  const page = Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1);
  const [{ rows, pageCount, total }, counts] = await Promise.all([listAdminPosts(ctx, filter, q, page), postCounts(ctx)]);
  const trash = filter === 'cop';

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('durum', filter);
    if (q) params.set('q', q);
    if (p > 1) params.set('sayfa', String(p));
    const qs = params.toString();
    return qs ? `/admin/icerikler?${qs}` : '/admin/icerikler';
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Yazı durumu" className="scrollbar-none relative -mx-1 flex gap-1 overflow-x-auto px-1">
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <Link
                  key={f.value}
                  href={f.value === 'all' ? '/admin/icerikler' : `/admin/icerikler?durum=${f.value}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', active ? 'bg-surface-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {f.value === 'cop' && <Trash2 className="size-3.5" aria-hidden />}
                  {f.label}
                  <span className="numeric text-[11.5px] text-muted-foreground">{counts[f.value]}</span>
                </Link>
              );
            })}
          </nav>
          <form action="/admin/icerikler" role="search" className="relative w-full lg:w-72">
            {filter !== 'all' && <input type="hidden" name="durum" value={filter} />}
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="post-search" className="sr-only">
              Yazı ara
            </label>
            <Input id="post-search" name="q" defaultValue={q} placeholder="Başlıkta ara" className="h-10 pl-10" />
          </form>
        </div>
        {trash && rows.length > 0 && (
          <p className="border-b border-border bg-warning-soft px-5 py-2.5 text-[13px] text-warning">Çöp kutusundaki yazılar sitede görünmez. Geri yüklenen yazı taslak olur.</p>
        )}
        {rows.length === 0 ? (
          <EmptyPanel
            icon={trash ? Trash2 : Newspaper}
            title={trash ? 'Çöp kutusu boş' : total === 0 && filter === 'all' && !q ? 'Henüz blog yazısı yok' : 'Bu filtreye uygun yazı yok'}
            description={trash ? undefined : 'Bölgenizle ilgili rehber yazılar, arama motorlarında görünürlüğünüzü artırmanın en etkili yollarındandır.'}
            action={
              !trash && (
                <Button asChild>
                  <Link href="/admin/icerikler/yeni">
                    <Plus /> Yeni yazı
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => {
              const scheduled = p.status === 'published' && isFutureDate(p.publishedAt);
              return (
                <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted sm:block">
                      {p.cover ? (
                        <MediaImage media={p.cover} alt="" fill sizes="96px" className="object-cover" />
                      ) : (
                        <ImageIcon className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        {trash ? (
                          <span className="text-[15px] font-semibold">{p.title}</span>
                        ) : (
                          <Link href={`/admin/icerikler/${p.id}`} className="text-[15px] font-semibold hover:underline">
                            {p.title}
                          </Link>
                        )}
                        {trash ? (
                          <Badge variant="danger">Çöp kutusunda</Badge>
                        ) : p.status === 'draft' ? (
                          <Badge>Taslak</Badge>
                        ) : scheduled ? (
                          <Badge variant="info">Zamanlandı</Badge>
                        ) : (
                          <Badge variant="success">Yayında</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                        /blog/{p.slug} · {p.status === 'published' && p.publishedAt ? `${scheduled ? 'yayına girecek' : 'yayın'}: ${formatDate(p.publishedAt)}` : `güncellendi ${formatRelativeDate(p.updatedAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {trash ? (
                      <>
                        <ActionButton
                          size="xs"
                          action={async () => {
                            'use server';
                            return setPostDeleted(p.id, false);
                          }}
                        >
                          <RotateCcw /> Geri yükle
                        </ActionButton>
                        <ActionButton
                          size="xs"
                          variant="danger-ghost"
                          confirm={{ title: 'Yazı kalıcı olarak silinsin mi?', description: 'Bu işlem geri alınamaz. Yayında olmuş yazının adresi blog sayfasına yönlendirilir.', confirmLabel: 'Kalıcı sil', destructive: true }}
                          action={async () => {
                            'use server';
                            return purgePost(p.id);
                          }}
                        >
                          <Trash2 /> Kalıcı sil
                        </ActionButton>
                      </>
                    ) : (
                      <>
                        <Button asChild size="xs" variant="outline">
                          <Link href={`/admin/icerikler/${p.id}`}>
                            <PencilLine /> Düzenle
                          </Link>
                        </Button>
                        {p.status === 'published' && !scheduled && (
                          <Button asChild size="xs" variant="ghost">
                            <a href={siteLink(`/blog/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink /> Görüntüle
                            </a>
                          </Button>
                        )}
                        <ActionButton
                          size="xs"
                          variant="danger-ghost"
                          confirm={{ title: 'Yazı çöp kutusuna taşınsın mı?', description: 'Yazı sitede görünmez; çöp kutusundan geri yükleyebilirsiniz.', confirmLabel: 'Taşı' }}
                          action={async () => {
                            'use server';
                            return setPostDeleted(p.id, true);
                          }}
                        >
                          <Trash2 /> Sil
                        </ActionButton>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}

async function PagesTab({ ctx, siteLink }: { ctx: Ctx; siteLink: (path: string) => string }) {
  const pages = await listAdminPages(ctx);
  const pendingLegal = pages.filter((p) => p.legal && !p.legalReviewed).length;
  return (
    <>
      {pendingLegal > 0 && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-[13.5px] text-warning">
          <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">{pendingLegal} hukuki metin inceleme bekliyor.</span>{' '}
            <span className="text-foreground/80">Bu metinler taslaktır; bir hukuk danışmanı onaylayana kadar sitede uyarıyla gösterilir.</span>
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        <ul className="divide-y divide-border">
          {pages.map((p) => (
            <li key={p.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/icerikler/sayfa/${p.key}`} className="text-[15px] font-semibold hover:underline">
                    {p.title}
                  </Link>
                  {p.saved ? <Badge variant="success">Özelleştirildi</Badge> : <Badge>Varsayılan şablon</Badge>}
                  {p.legal && (p.legalReviewed ? <Badge variant="info">Hukuken incelendi</Badge> : <Badge variant="warning">İnceleme bekliyor</Badge>)}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {p.path}
                  {p.updatedAt && ` · güncellendi ${formatRelativeDate(p.updatedAt)}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button asChild size="xs" variant="outline">
                  <Link href={`/admin/icerikler/sayfa/${p.key}`}>
                    <PencilLine /> Düzenle
                  </Link>
                </Button>
                <Button asChild size="xs" variant="ghost">
                  <a href={siteLink(p.path)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Görüntüle
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
