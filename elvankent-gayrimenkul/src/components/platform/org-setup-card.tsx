'use client';

import Link from '@/components/common/intent-link';
import { RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { Badge } from '@/components/ui/badge';
import { reopenOrgSetupAction } from '@/app/actions/platform';
import { formatDateTime } from '@/lib/format';
import { SETUP_STATE_LABELS, type OrgSetup } from '@/modules/onboarding/setup-state';

/**
 * PILOT · KARAYS konsolu › Organizasyon › İlk kurulum: ofisin kurulum durumu, kurulumda seçilen tasarım ve tek seferlik
 * seçimi yeniden açma (yalnız süper admin; veritabanı ayrıca doğrular ve denetim kaydı yazar). İzinli aileler ve başlangıç
 * tasarımı mevcut Site › Tema ekranından yönetilir (aynı izin mekanizması; kurulumda o tasarım önceden seçili gelir).
 */
export function OrgSetupCard({
  orgId,
  available,
  setup,
  currentFamily,
  selectedFamily,
}: {
  orgId: string;
  available: boolean;
  setup: OrgSetup | null;
  currentFamily: string | null;
  selectedFamily: string | null;
}) {
  const state = setup?.state ?? null;
  const canReopen = available && (!setup || setup.state === 'setup_completed');
  return (
    <div className="space-y-3 text-[13.5px]" data-testid="org-setup" data-state={state ?? (available ? 'none' : 'unavailable')}>
      {!available ? (
        <p className="text-muted-foreground">İlk kurulum akışı bu veritabanında henüz etkin değil (bekleyen migration I).</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={state === 'setup_completed' ? 'success' : state ? 'warning' : 'neutral'}>{state ? SETUP_STATE_LABELS[state] : 'Kurulum kaydı yok'}</Badge>
            {setup?.origin === 'legacy' && <span className="text-muted-foreground">(mevcut ofis — tasarım kilitli değil; yeniden açılıp tamamlanırsa kilitlenir)</span>}
          </div>
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sitedeki tasarım</dt>
              <dd className="font-semibold">{currentFamily ?? 'Varsayılan'}</dd>
            </div>
            {selectedFamily && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{state === 'setup_completed' ? 'Kurulumda seçilen' : 'Aday seçim'}</dt>
                <dd className="font-semibold">{selectedFamily}</dd>
              </div>
            )}
            {setup?.completedAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tamamlandı</dt>
                <dd>{formatDateTime(setup.completedAt)}</dd>
              </div>
            )}
            {setup?.reopenedAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Yeniden açıldı</dt>
                <dd>{formatDateTime(setup.reopenedAt)}</dd>
              </div>
            )}
          </dl>
          <p className="text-[12.5px] text-muted-foreground">
            Ofisin seçebileceği tasarımlar ve başlangıç tasarımı:{' '}
            <Link href={`/platform/siteler/${orgId}/tema`} className="font-semibold text-primary-ink hover:underline">
              Site › Tema
            </Link>
          </p>
          {canReopen && (
            <ActionButton
              size="sm"
              variant="outline"
              action={() => reopenOrgSetupAction(orgId)}
              confirm={{
                title: 'Tasarım seçimi yeniden açılsın mı?',
                description:
                  'Ofis sahibi bir sonraki girişte kurulumun tasarım adımına yönlenir ve izinli tasarımlardan yeniden seçer. Seçim tamamlanınca tasarım ailesi ve tema kilitlenir (daha önce kilitli olmayan mevcut ofisler dahil). İşlem denetim kaydına yazılır.',
                confirmLabel: 'Yeniden aç',
              }}
            >
              <RotateCcw /> Tasarım seçimini yeniden aç
            </ActionButton>
          )}
        </>
      )}
    </div>
  );
}
