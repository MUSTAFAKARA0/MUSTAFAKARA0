import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { formatDate } from '@/lib/format';
import { getContentPage } from '@/modules/content/queries';
import { Markdown, markdownToPlainText } from '@/modules/content/markdown';
import type { PageKey } from '@/modules/content/default-pages';
import { requireTenant } from '@/platform/tenant/tenant';

export async function contentPageMetadata(tenantKey: string, key: PageKey): Promise<Metadata> {
  const tenant = await requireTenant(tenantKey);
  const page = await getContentPage(tenant, key);
  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? (markdownToPlainText(page.body, 160) || page.description),
    alternates: { canonical: page.path },
  };
}

/** Yönetim panelinden düzenlenebilen sayfalar (Hakkımızda, KVKK, gizlilik...) */
export async function ContentPageView({ tenantKey, pageKey, children }: { tenantKey: string; pageKey: PageKey; children?: React.ReactNode }) {
  const tenant = await requireTenant(tenantKey);
  const page = await getContentPage(tenant, pageKey);
  return (
    <>
      <PageHeader tenant={tenant} title={page.title} crumbs={[{ name: page.title, path: page.path }]} />
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {page.needsLegalReview && (
            <div role="note" className="mb-8 flex gap-3 rounded-2xl bg-warning-soft p-4 text-sm leading-relaxed text-warning">
              <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p>
                <strong>Önemli:</strong> Bu metin genel bilgilendirme amaçlı bir taslaktır ve kesin hukuki tavsiye niteliği taşımaz.
                Yayında kullanılmadan önce <strong>bir hukuk danışmanı tarafından doğrulanmalı</strong>, köşeli parantez içindeki
                alanlar işletme bilgileriyle doldurulmalıdır.
              </p>
            </div>
          )}
          <Markdown source={page.body} className="prose-content" />
          {page.updatedAt && <p className="mt-10 text-sm text-muted-foreground">Son güncelleme: {formatDate(page.updatedAt)}</p>}
          {children}
        </div>
      </div>
    </>
  );
}
