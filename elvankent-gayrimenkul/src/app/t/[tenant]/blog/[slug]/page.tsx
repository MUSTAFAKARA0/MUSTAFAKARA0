import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { JsonLd } from '@/components/common/json-ld';
import { MediaImage } from '@/components/gallery/media-image';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { markdownToPlainText, Markdown } from '@/modules/content/markdown';
import { getPostBySlug, getPublishedPosts, readingMinutes } from '@/modules/content/queries';
import { mediaUrl } from '@/modules/media/variants';
import { findRedirect } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { articleJsonLd } from '@/modules/seo/jsonld';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { requireTenant } from '@/platform/tenant/tenant';
import { guardSitePage } from '@/platform/site/pages';

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<'/t/[tenant]/blog/[slug]'>): Promise<Metadata> {
  const { tenant: key, slug } = await params;
  const tenant = await requireTenant(key);
  const post = await getPostBySlug(tenant.id, slug);
  if (!post) return { title: 'Yazı bulunamadı', robots: { index: false } };
  const description = post.seoDescription ?? post.excerpt ?? markdownToPlainText(post.body, 160);
  const og = post.cover ? { url: mediaUrl(post.cover, 1440), width: 1440, alt: post.title } : siteOgImage(tenant);
  return {
    title: post.seoTitle ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      ...baseOpenGraph(tenant),
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [og],
    },
    twitter: { card: 'summary_large_image', title: post.title, description, images: [og] },
  };
}

export default async function BlogPostPage({ params }: PageProps<'/t/[tenant]/blog/[slug]'>) {
  const { tenant: key, slug } = await params;
  const tenant = await requireTenant(key);
  await guardSitePage(tenant, 'blog');
  const post = await getPostBySlug(tenant.id, slug);
  if (!post) {
    // Adresi değişen / silinen içerik: tanımlı yönlendirme varsa uygula
    const target = await findRedirect(tenant.id, `/blog/${slug}`);
    if (target) followRedirect(target);
    notFound();
  }
  const others = (await getPublishedPosts(tenant.id, 4)).filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <article>
      <JsonLd
        data={articleJsonLd(tenant, {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          imageUrl: post.cover ? mediaUrl(post.cover, 1440) : null,
        })}
      />
      <header className="container-narrow pt-7 sm:pt-9">
        <Breadcrumbs
          tenant={tenant}
          items={[
            { name: 'Ana sayfa', path: '/' },
            { name: 'Rehber', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]}
        />
        <h1 className="mt-8 font-display text-display-xl text-foreground">{post.title}</h1>
        {post.excerpt && <p className="mt-5 text-[18px] leading-relaxed text-muted-foreground">{post.excerpt}</p>}
        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{tenant.settings.display_name}</span>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {readingMinutes(post.body)} dk okuma
          </span>
        </p>
      </header>

      {post.cover && (
        <div className="container-page mt-10">
          <div className="relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-[1.5rem] bg-surface-muted">
            <MediaImage media={post.cover} alt={post.cover.alt_text ?? ''} fill preload sizes="(min-width: 1100px) 1024px, 100vw" className="object-cover" />
          </div>
        </div>
      )}

      <div className="container-narrow py-12 sm:py-16">
        <Markdown source={post.body} className="prose-content" />
        {post.updatedAt && post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10) && (
          <p className="mt-10 text-sm text-muted-foreground">Son güncelleme: {formatDate(post.updatedAt)}</p>
        )}

        <aside aria-label="İletişim" className="mt-14 rounded-2xl bg-surface-inverse p-7 text-inverse-foreground sm:p-9">
          <p className="font-display text-2xl text-white">Aradığınız gayrimenkulü birlikte bulalım</p>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">
            Bütçenizi ve beklentilerinizi paylaşın; uygun seçenekleri sizin için değerlendirelim.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="inverse">
              <Link href="/ilanlar">İlanları inceleyin</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              <Link href="/iletisim">Bize ulaşın</Link>
            </Button>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section aria-labelledby="diger-yazilar" className="border-t border-border bg-surface">
          <div className="container-page py-14 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="diger-yazilar" className="font-display text-display-lg">
                Diğer yazılar
              </h2>
              <Link href="/blog" className="group inline-flex items-center gap-2 text-[15px] font-semibold hover:underline">
                Tüm yazılar <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
            <ul className="mt-10 grid gap-8 md:grid-cols-3">
              {others.map((p) => (
                <li key={p.id}>
                  <Link href={`/blog/${p.slug}`} className="group block">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-muted">
                      {p.cover && (
                        <MediaImage media={p.cover} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                      )}
                    </div>
                    <p className="mt-4 text-[13px] text-muted-foreground">{formatDate(p.publishedAt)}</p>
                    <h3 className="mt-1.5 text-[17px] leading-snug font-bold text-foreground group-hover:underline">{p.title}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}
