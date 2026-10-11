import { History, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { EmptyPanel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import type { ActionResult } from '@/platform/actions';

/**
 * Yayın sürümleri ve geri yükleme (KARAY Site Kontrol Merkezi ve ofis /admin/site ortak).
 * `rollback` sunucuda bağlanmış bir sunucu işlemidir (KARAY: rollbackSite.bind(null, orgId);
 * ofis: rollbackOfficeSite — organizasyon oturumdan). Geri yükleme seçilen sürümü yeni sürüm
 * olarak yayınlar; geçmiş silinmez.
 */
export function RevisionList({
  rows,
  currentVersion,
  publisher,
  rollback,
}: {
  rows: { version: number; note: string | null; created_at: string }[];
  currentVersion: number;
  publisher?: Map<number, string>;
  rollback: (version: number) => Promise<ActionResult<{ version: number }>>;
}) {
  if (rows.length === 0) return <EmptyPanel icon={History} title="Henüz yayın yok" description="İlk yayından sonra sürümler burada listelenir." />;
  return (
    <ol className="divide-y divide-border" data-testid="site-revisions">
      {rows.map((r) => (
        <li key={r.version} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <span className="numeric flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-[13px] font-bold">v{r.version}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">
              {r.note || 'Not eklenmemiş'}
              {r.version === currentVersion && (
                <Badge variant="success" className="ml-2 align-middle">
                  Yayında
                </Badge>
              )}
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              {formatDateTime(r.created_at)}
              {publisher?.get(r.version) ? ` · ${publisher.get(r.version)}` : ''}
            </p>
          </div>
          {r.version !== currentVersion && (
            <ActionButton
              size="xs"
              confirm={{
                title: `Sürüm ${r.version} geri yüklensin mi?`,
                description: 'Bu sürüm canlı siteye alınır ve yeni sürüm olarak kaydedilir. Taslaktaki yayınlanmamış değişiklikler bu sürümle değiştirilir.',
                confirmLabel: 'Geri yükle',
              }}
              action={rollback.bind(null, r.version)}
            >
              <RotateCcw /> Geri yükle
            </ActionButton>
          )}
        </li>
      ))}
    </ol>
  );
}
