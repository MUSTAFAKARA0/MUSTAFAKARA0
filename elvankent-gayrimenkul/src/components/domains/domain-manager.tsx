'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Globe, Link2, Plus, RefreshCw, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { formatDateTime } from '@/lib/format';
import type { ActionResult } from '@/platform/actions';
import type { DnsInstruction, DomainView } from '@/modules/domains/service';

type Result = ActionResult<unknown>;

export interface DomainActions {
  add: (hostname: string) => Promise<Result>;
  verify: (id: string) => Promise<Result>;
  connect: (id: string) => Promise<Result>;
  rotate: (id: string) => Promise<Result>;
  primary: (id: string) => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  /** Yalnızca KARAY: barındırmada kontrol edilen bağlantıyı elle onayla */
  connectManual?: (id: string) => Promise<Result>;
}

const STATUS = {
  pending: { label: 'Doğrulama bekleniyor', tone: 'warning' },
  verified: { label: 'DNS doğrulandı · bağlantı bekleniyor', tone: 'info' },
  active: { label: 'Aktif', tone: 'success' },
} as const;

function Record({ record, secret = false }: { record: DnsInstruction; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl bg-surface-muted px-3.5 py-3 text-[12.5px]" data-testid={`dns-${record.type.toLowerCase()}`}>
      <dt className="text-muted-foreground">Tür</dt>
      <dd className="font-semibold">{record.type}</dd>
      <dt className="text-muted-foreground">Ad (Host)</dt>
      <dd className="font-mono break-all">{record.host}</dd>
      <dt className="text-muted-foreground">Değer</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 font-mono break-all" data-testid="dns-value">
          {show ? record.value : '••••••••••••'}
        </span>
        {secret && (
          <button type="button" className="inline-flex items-center gap-1 text-primary-ink hover:underline" onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? 'Gizle' : 'Göster'}
          </button>
        )}
        <button type="button" className="inline-flex items-center gap-1 text-primary-ink hover:underline" onClick={() => void navigator.clipboard.writeText(record.value).then(() => toast.success('Kopyalandı.'))}>
          <Copy className="size-3.5" /> Kopyala
        </button>
      </dd>
    </dl>
  );
}

/**
 * Özel alan adı yönetimi (P0.5) — ofis paneli ve KARAY konsolu ortak bileşeni. Durumlar:
 * Doğrulama bekleniyor → DNS doğrulandı (bağlantı bekleniyor) → Aktif. İşlemler sunucuda
 * yetki ve kiracı denetiminden geçer; bu bileşen yalnızca sunucunun verdiği görünümü çizer.
 */
export function DomainManager({ domains, actions, canAdd = true, addDisabledReason, fallbackUrl }: { domains: DomainView[]; actions: DomainActions; canAdd?: boolean; addDisabledReason?: string; fallbackUrl?: string | null }) {
  const router = useRouter();
  const [host, setHost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-5" data-testid="domain-manager">
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="no-domains">
          Özel alan adı bağlı değil.{fallbackUrl ? ` Site ${fallbackUrl.replace(/^https?:\/\//, '')} adresinde yayınlanır.` : ''}
        </p>
      ) : (
        <ul className="space-y-4">
          {domains.map((d) => {
            const s = STATUS[d.status];
            return (
              <li key={d.id} className="rounded-2xl border border-border p-4" data-testid="domain-row" data-hostname={d.hostname} data-status={d.status} data-primary={d.isPrimary ? 'true' : 'false'}>
                <div className="flex flex-wrap items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{d.hostname}</span>
                  {d.isPrimary && <Badge variant="primary-soft">Birincil</Badge>}
                  <Badge variant={s.tone}>
                    {d.status !== 'pending' && <CheckCircle2 className="mr-1 size-3.5" aria-hidden />}
                    {s.label}
                  </Badge>
                </div>

                {d.status === 'pending' && (
                  <div className="mt-3 space-y-3">
                    {d.verification ? (
                      <>
                        <p className="text-[13px] text-muted-foreground">
                          Alan adının size ait olduğunu doğrulamak için DNS sağlayıcınızda aşağıdaki TXT kaydını ekleyin, ardından <strong>Doğrula</strong>&apos;ya basın.
                          {d.verificationExpiresAt && ` Kod ${formatDateTime(d.verificationExpiresAt)} tarihine kadar geçerli.`}
                        </p>
                        <Record record={d.verification} secret />
                      </>
                    ) : (
                      <p className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning" data-testid="verification-expired">
                        Doğrulama kodunun süresi doldu. Yeni kod oluşturup DNS kaydını güncelleyin.
                      </p>
                    )}
                  </div>
                )}

                {d.status === 'verified' && (
                  <div className="mt-3 space-y-3">
                    <p className="text-[13px] text-muted-foreground">
                      Sahiplik doğrulandı{d.verifiedAt ? ` (${formatDateTime(d.verifiedAt)})` : ''}. Şimdi alan adını siteye yönlendirin ve <strong>Bağlantıyı kontrol et</strong>&apos;e basın.
                    </p>
                    {d.connection.length > 0 ? (
                      d.connection.map((r) => <Record key={`${r.type}-${r.value}`} record={r} />)
                    ) : (
                      <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-[13px] text-muted-foreground" data-testid="target-unknown">
                        Yönlendirme kaydı (hedef adres) KARAY tarafından bildirilir; bağlantıyı KARAY ekibi onaylar.
                      </p>
                    )}
                  </div>
                )}

                {d.status === 'active' && (
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Site bu adreste yayında{d.activatedAt ? ` (${formatDateTime(d.activatedAt)} itibarıyla)` : ''}.{' '}
                    {d.isPrimary ? 'Kanonik adres, site haritası ve paylaşım bağlantıları bu alan adını kullanır.' : 'Aynı siteyi açar; kanonik adres birincil alan adıdır.'}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {d.status === 'pending' && d.verification && (
                    <ActionButton size="sm" variant="primary" action={() => actions.verify(d.id)}>
                      <ShieldCheck /> Doğrula
                    </ActionButton>
                  )}
                  {d.status === 'pending' && (
                    <ActionButton size="sm" variant={d.verification ? 'outline' : 'primary'} action={() => actions.rotate(d.id)}>
                      <RefreshCw /> Yeni kod oluştur
                    </ActionButton>
                  )}
                  {d.status === 'verified' && (
                    <ActionButton size="sm" variant="primary" action={() => actions.connect(d.id)}>
                      <Link2 /> Bağlantıyı kontrol et
                    </ActionButton>
                  )}
                  {d.status === 'verified' && actions.connectManual && (
                    <ActionButton
                      size="sm"
                      variant="outline"
                      action={() => actions.connectManual!(d.id)}
                      confirm={{ title: `${d.hostname} aktif edilsin mi?`, description: 'Yalnızca barındırmada (Vercel) alan adının bağlı ve DNS yönlendirmesinin doğru olduğunu kontrol ettiyseniz onaylayın. Sahiplik zaten doğrulandı.', confirmLabel: 'Aktif et' }}
                    >
                      <CheckCircle2 /> Bağlantıyı elle onayla
                    </ActionButton>
                  )}
                  {d.status === 'active' && (
                    <Button asChild size="sm" variant="outline">
                      <a href={`https://${d.hostname}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink /> Siteyi aç
                      </a>
                    </Button>
                  )}
                  {d.status === 'active' && !d.isPrimary && (
                    <ActionButton size="sm" variant="outline" action={() => actions.primary(d.id)}>
                      <Star /> Birincil yap
                    </ActionButton>
                  )}
                  <ActionButton
                    size="sm"
                    variant="danger-ghost"
                    action={() => actions.remove(d.id)}
                    confirm={{
                      title: `${d.hostname} kaldırılsın mı?`,
                      description:
                        d.status === 'active'
                          ? 'Site bu adreste hemen açılmaz olur. Site varsayılan adresinde yayında kalır; alan adını yeniden bağlamak için doğrulama tekrar gerekir.'
                          : 'Alan adı kaydı silinir; doğrulama kodu geçersiz olur.',
                      confirmLabel: d.status === 'pending' ? 'İptal et' : 'Kaldır',
                      destructive: true,
                    }}
                  >
                    <Trash2 /> {d.status === 'pending' ? 'İptal et' : 'Kaldır'}
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            const res = await actions.add(host);
            setPending(false);
            if (!res.ok) {
              setError(res.fieldErrors?.hostname?.[0] ?? res.error);
              return;
            }
            toast.success(res.message ?? 'Alan adı eklendi.');
            setHost('');
            startTransition(() => router.refresh());
          }}
        >
          <Field label="Alan adı ekle" htmlFor="domain-host" error={error} className="flex-1" hint="Yalnızca alan adı: ornekemlak.com veya www.ornekemlak.com">
            <Input id="domain-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.ornekemlak.com" autoComplete="off" spellCheck={false} maxLength={253} />
          </Field>
          <Button type="submit" loading={pending} disabled={!host.trim()}>
            {!pending && <Plus />} Ekle
          </Button>
        </form>
      ) : (
        addDisabledReason && <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-[13px] text-muted-foreground">{addDisabledReason}</p>
      )}
    </div>
  );
}
