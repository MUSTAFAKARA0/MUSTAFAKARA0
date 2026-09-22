import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminPageHeader({
  title,
  description,
  action,
  showNewButton,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  showNewButton?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] leading-tight text-ink sm:text-3xl">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-sand-600">{description}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {action}
        {showNewButton && (
          <Button asChild size="lg">
            <Link href="/admin/ilan-ekle">
              <Plus /> Yeni İlan Ekle
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AdminCard({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6 ${className ?? ''}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
