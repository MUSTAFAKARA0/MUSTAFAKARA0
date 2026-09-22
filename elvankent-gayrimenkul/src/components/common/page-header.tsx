import { Breadcrumbs } from './breadcrumbs';

export function PageHeader({
  title,
  description,
  path,
  eyebrow,
}: {
  title: string;
  description?: string;
  path: string;
  eyebrow?: string;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="container-page py-8 sm:py-12">
        <Breadcrumbs
          items={[
            { name: 'Ana Sayfa', path: '/' },
            { name: title, path },
          ]}
        />
        {eyebrow && <p className="mt-6 text-xs font-bold tracking-[0.2em] text-accent-700 uppercase">{eyebrow}</p>}
        <h1 className="mt-3 font-display text-[2rem] leading-tight text-ink sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-sand-600 sm:text-base">{description}</p>}
      </div>
    </div>
  );
}
