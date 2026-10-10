import { Breadcrumbs, type Crumb } from '@/components/common/breadcrumbs';
import type { Tenant } from '@/platform/tenant/tenant';

export function PageHeader({
  tenant,
  title,
  description,
  crumbs,
  eyebrow,
  children,
}: {
  tenant: Tenant;
  title: string;
  description?: React.ReactNode;
  crumbs: Crumb[];
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="container-page pt-7 pb-10 sm:pt-9 sm:pb-14">
        <Breadcrumbs tenant={tenant} items={[{ name: 'Ana sayfa', path: '/' }, ...crumbs]} />
        {eyebrow && <p className="eyebrow mt-8">{eyebrow}</p>}
        <h1 className={`${eyebrow ? 'mt-3' : 'mt-8'} max-w-4xl font-display text-display-xl text-foreground`}>{title}</h1>
        {description && <div className="mt-4 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">{description}</div>}
        {children}
      </div>
    </div>
  );
}
