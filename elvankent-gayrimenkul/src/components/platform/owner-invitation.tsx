'use client';

import { useState } from 'react';
import { MailPlus, Send, XCircle } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { Badge } from '@/components/ui/badge';
import { revokeOwnerInvitationAction, sendOwnerInvitationAction } from '@/app/actions/platform';
import { formatDateTime } from '@/lib/format';

export type OwnerInvitationView = {
  status: 'pending' | 'expired' | 'accepted' | 'revoked';
  expiresAt: string | null;
  lastSentAt: string | null;
  acceptedAt: string | null;
  accountPending: boolean;
} | null;

const STATUS: Record<'pending' | 'expired' | 'accepted' | 'revoked', { label: string; tone: 'warning' | 'danger' | 'success' | 'neutral' }> = {
  pending: { label: 'Davet bekliyor', tone: 'warning' },
  expired: { label: 'Süresi doldu', tone: 'danger' },
  accepted: { label: 'Aktif', tone: 'success' },
  revoked: { label: 'İptal edildi', tone: 'neutral' },
};

/**
 * Sahip hesabı ve davet durumu (P0.4). Geçici şifre veya davet bağlantısı GÖSTERİLMEZ; davet
 * yalnızca sahibin e-postasına gider. İşlemler sunucuda süper admin olarak doğrulanır.
 */
export function OwnerInvitationCard({ orgId, email, invitation: initial }: { orgId: string; email: string | null; invitation: OwnerInvitationView }) {
  // İşlem sonucu hemen yansır (oluşturma ekranında sayfa verisi yenilenmez)
  const [override, setOverride] = useState<OwnerInvitationView | undefined>(undefined);
  const invitation = override === undefined ? initial : override;
  const status = invitation?.status ?? null;
  const send = async () => {
    const res = await sendOwnerInvitationAction(orgId);
    if (res.ok) setOverride({ status: 'pending', expiresAt: res.data.expiresAt, lastSentAt: new Date().toISOString(), acceptedAt: null, accountPending: true });
    return res;
  };
  const revoke = async () => {
    const res = await revokeOwnerInvitationAction(orgId);
    if (res.ok) setOverride({ status: 'revoked', expiresAt: null, lastSentAt: invitation?.lastSentAt ?? null, acceptedAt: null, accountPending: true });
    return res;
  };

  return (
    <div className="space-y-3" data-testid="owner-invitation" data-status={status ?? 'none'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted-foreground">Sahip</p>
          <p className="truncate text-[14px] font-semibold">{email ?? '—'}</p>
        </div>
        {status && <Badge variant={STATUS[status].tone}>{STATUS[status].label}</Badge>}
      </div>

      {status === 'pending' && (
        <p className="text-[12.5px] text-muted-foreground">
          {invitation!.lastSentAt ? `Davet ${formatDateTime(invitation!.lastSentAt)} tarihinde gönderildi.` : 'Davet gönderilmeye hazır.'}
          {invitation!.expiresAt && invitation!.lastSentAt ? ` Bağlantı ${formatDateTime(invitation!.expiresAt)} tarihine kadar geçerli.` : ''}
        </p>
      )}
      {(status === 'pending' || status === 'expired') && !invitation!.accountPending && (
        <p className="text-[12.5px] text-muted-foreground">Sahip hesabı başka yoldan etkinleştirilmiş (ör. şifre sıfırlama); bu davet kullanılamaz ve gerekmez.</p>
      )}
      {status === 'accepted' && invitation?.acceptedAt && <p className="text-[12.5px] text-muted-foreground">Hesap {formatDateTime(invitation.acceptedAt)} tarihinde etkinleştirildi.</p>}
      {status === 'expired' && <p className="text-[12.5px] text-muted-foreground">Bağlantının süresi doldu; yeni davet önceki bağlantıları geçersiz kılar.</p>}
      {status === 'revoked' && <p className="text-[12.5px] text-muted-foreground">Davet iptal edildi; eski bağlantı çalışmaz. Hesap ve organizasyon silinmedi.</p>}
      {!invitation && <p className="text-[12.5px] text-muted-foreground">Davet kaydı yok; sahip mevcut hesabıyla giriş yapar. Hesabı hiç etkinleştirilmediyse davet gönderebilirsiniz.</p>}

      {status !== 'accepted' && (
        <div className="flex flex-wrap gap-2">
          {status === 'pending' && (
            <ActionButton size="sm" variant={invitation!.lastSentAt ? 'outline' : 'primary'} action={send}>
              <Send /> {invitation!.lastSentAt ? 'Daveti tekrar gönder' : 'Davet gönder'}
            </ActionButton>
          )}
          {!invitation && (
            <ActionButton size="sm" variant="outline" action={send}>
              <Send /> Davet gönder
            </ActionButton>
          )}
          {(status === 'expired' || status === 'revoked') && (
            <ActionButton size="sm" variant="primary" action={send}>
              <MailPlus /> {status === 'expired' ? 'Yeni davet gönder' : 'Yeni davet'}
            </ActionButton>
          )}
          {(status === 'pending' || status === 'expired') && (
            <ActionButton
              size="sm"
              variant="danger-ghost"
              action={revoke}
              confirm={{ title: 'Davet iptal edilsin mi?', description: 'Gönderilmiş bağlantı hemen geçersiz olur. Hesap ve organizasyon silinmez; daha sonra yeni davet gönderebilirsiniz.', confirmLabel: 'Daveti iptal et', destructive: true }}
            >
              <XCircle /> Daveti iptal et
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
