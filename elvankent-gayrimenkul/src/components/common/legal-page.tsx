import { Scale } from 'lucide-react';
import { PageHeader } from './page-header';
import { formatDate } from '@/lib/format';

/** Hukuki metin şablonu. Metinler taslaktır; yayın öncesi hukuk danışmanı onayı gerekir. */
export function LegalPage({
  title,
  path,
  updatedAt,
  children,
}: {
  title: string;
  path: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} path={path} />
      <div className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div role="note" className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
            <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              <strong>Önemli:</strong> Bu metin genel bilgilendirme amaçlı bir taslaktır ve kesin hukuki garanti sunmaz. Yayınlanmadan
              önce <strong>bir hukuk danışmanı tarafından doğrulanmalı</strong>, köşeli parantez içindeki alanlar işletme bilgileriyle
              doldurulmalıdır.
            </p>
          </div>
          <p className="mt-6 text-sm text-sand-500">Son güncelleme: {formatDate(updatedAt)}</p>
          <div className="prose-legal mt-2">{children}</div>
        </div>
      </div>
    </>
  );
}
