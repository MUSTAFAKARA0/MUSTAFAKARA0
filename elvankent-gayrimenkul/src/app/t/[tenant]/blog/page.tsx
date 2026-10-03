import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpenText } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { MediaImage } from '@/components/common/media-image';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { firstParam, parsePositiveInt } from '@/lib/utils';
import { getPostsPage, type PostSummary } from '@/modules/content/queries';
import { requireSiteTenant } from '@/site-config/load';
import { applyPageSeo, guardSitePage, sitePageSettings } from '@/site-config/pages';

export const revalidate = 300;

function pageFrom(searchParams: Record<string, string | string[] | undefined>): number {
  return Math.max(1, parsePositiveInt(firstParam(searchParams.sayfa), 10_000) ?? 1);
}

export async function generateMetadata({ params, searchParams }: PageProps<'/t/[tenant]/blog'>): Promise<Metadata> {
  const tenant = await requireSiteTenant((await params).tenant);
  const page = pageFrom(await searchParams);
  return applyPageSeo(page > 1 ? undefined : await sitePageSettings(tenant, 'blog'), {
    title: page > 1 ? `Gayrimenkul rehberi – Sayfa ${page}` : 'Gayrimenkul rehberi',
    description: `${tenant.settings.display_name} rehberi: alım, satım, kiralama ve yatırım süreçleri hakkında bilgilendirici yazılar.`,
    alternates: { canonical: page > 1 ? `/blog?sayfa=${page}` : '/blog' },
  });
}

function PostCard({ post, featured = false }: { post: PostSummary; featured?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className={featured ? 'group grid gap-6 md:grid-cols-[1.25fr_1fr] md:items-center md:gap-10' : 'group block'}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted">
        {post.cover ? (
          <MediaImage
            media={post.cover}
            alt=""
            fill
            sizes={featured ? '(min-width: 1312px) 700px, (min-width: 768px) 55vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
            preload={featured}
            className="object-cover transition duration-700 ease-premium group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/60">
            <BookOpenText className="size-10" aria-hidden />
          </div>
        )}
      </div>
      <div className={featured ? 'md:py-4' : undefined}>
        <p className={featured ? 'text-sm text-muted-foreground' : 'mt-4 text-[13px] text-muted-foreground'}>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </p>
        {featured ? (
          <h2 className="mt-2 font-display text-display-lg text-foreground group-hover:underline">{post.title}</h2>
        ) : (
          <h2 className="mt-1.5 text-[17.5px] leading-snug font-bold text-foreground group-hover:underline">{post.title}</h2>
        )}
        {post.excerpt && (
          <p className={featured ? 'mt-4 text-[16.5px] leading-relaxed text-muted-foreground' : 'mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-muted-foreground'}>
            {post.excerpt}
          </p>
        )}
        {featured && (
          <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
            Yazıyı okuyun <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function BlogIndexPage({ params, searchParams }: PageProps<'/t/[tenant]/blog'>) {
  const tenant = await requireSiteTenant((await params).tenant);
  await guardSitePage(tenant, 'blog');
  const page = pageFrom(await searchParams);
  const { items, pageCount } = await getPostsPage(tenant.id, page);
  if (page > 1 && items.length === 0) notFound();
  const [first, ...rest] = items;
  const featured = page === 1 ? first : undefined;
  const grid = page === 1 ? rest : items;

  return (
    <>
      <PageHeader
        tenant={tenant}
        eyebrow="Rehber"
        title="Gayrimenkul rehberi"
        description="Alım, satım, kiralama ve yatırım süreçlerinde bilmeniz gerekenler; tapu, kredi ve bölge bilgileri."
        crumbs={[{ name: 'Rehber', path: '/blog' }]}
      />
      <div className="container-page py-12 sm:py-16">
        {items.length === 0 ? (
          <EmptyState
            icon={BookOpenText}
            title="Henüz yazı yayınlanmadı"
            description="Rehber yazıları yakında burada olacak. Bu sırada güncel ilanlara göz atabilirsiniz."
            action={
              <Button asChild>
                <Link href="/ilanlar">İlanlara git</Link>
              </Button>
            }
          />
        ) : (
          <>
            {featured && (
              <div className="border-b border-border pb-12 sm:pb-16">
                <PostCard post={featured} featured />
              </div>
            )}
            {grid.length > 0 && (
              <ul className={`grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 ${featured ? 'mt-12 sm:mt-16' : ''}`}>
                {grid.map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} />
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={page} pageCount={pageCount} hrefFor={(n) => (n > 1 ? `/blog?sayfa=${n}` : '/blog')} />
          </>
        )}
      </div>
    </>
  );
}
