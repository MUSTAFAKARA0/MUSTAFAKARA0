'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FamilyOption } from '@/components/site-editor/design-family-picker';
import { LivePreview, type Brand } from '@/theme-engine/preview/live-preview';
import { finishSetup, saveSetupStep } from '@/app/actions/setup';
import { LAST_SETUP_STEP, SETUP_STEPS } from '@/modules/onboarding/setup-state';

export interface SetupOffice {
  name: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/**
 * PILOT · İlk kurulum akışı (sahip / yönetici). Her adım geçişi SUNUCUYA kaydedilir (org_setup_progress): sayfa
 * kapanınca kalınan adım ve seçilen tasarımla açılır. Kayıt başarısızsa adım ilerlemez (veri kaybı yok). Tasarım
 * kartları ve önizleme mevcut motoru kullanır: küçük görünüm LivePreview, önizleme /site-onizleme/ofis (Site yönetimi ›
 * Tasarım önizlemesiyle aynı çerçeve, sitenin gerçek verisi). Yalnız KARAYS'in bu ofise izin verdiği aileler gelir
 * (sunucuda süzülür). Gereksiz hareket / animasyon yok.
 */
export function SetupFlow({
  office,
  families,
  brand,
  darkAllowed,
  initialStep,
  initialFamily,
}: {
  office: SetupOffice;
  families: FamilyOption[];
  brand: Brand;
  darkAllowed: boolean;
  initialStep: number;
  initialFamily: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [family, setFamily] = useState<string | null>(initialFamily);
  const [device, setDevice] = useState<'masaustu' | 'mobil'>('masaustu');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = families.find((f) => f.id === family) ?? null;
  const name = office.displayName || office.name;

  async function go(next: number) {
    if (next < 0 || next > LAST_SETUP_STEP || pending) return;
    if (next > 2 && families.length > 0 && !chosen) {
      setError('Devam etmek için bir tasarım seçin.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await saveSetupStep(next, next >= 2 ? (chosen?.id ?? null) : null);
    setPending(false);
    if (!res.ok) {
      if (res.code === 'setup_completed' || res.code === 'setup_not_required') return router.replace('/admin');
      setError(res.error);
      return;
    }
    setStep(next);
  }

  async function finish() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await finishSetup(chosen?.id ?? null);
    if (res.ok || res.code === 'setup_completed' || res.code === 'setup_not_required') {
      router.replace('/admin');
      router.refresh();
      return;
    }
    setPending(false);
    setError(res.error);
  }

  return (
    <div data-testid="setup-flow" data-step={SETUP_STEPS[step].key} className="min-w-0">
      <ol className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px]" aria-label="Kurulum adımları">
        {SETUP_STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === step ? 'step' : undefined} className={cn('flex items-center gap-1.5', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            <span className={cn('grid size-6 place-items-center rounded-full text-[12px] ring-1', i < step ? 'bg-primary text-primary-fg ring-primary' : i === step ? 'ring-foreground' : 'ring-border')}>
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ol>

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
        {step === 0 && (
          <div className="space-y-3">
            <h1 className="font-display text-[1.75rem] leading-tight">Hoş geldiniz, {name}</h1>
            <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Paneliniz hazır. Birkaç adımda ofis bilgilerinizi kontrol edip sitenizin tasarımını seçeceksiniz. Tasarım seçimi bir kez yapılır; sonrasında logonuzu, renklerinizi,
              iletişim bilgilerinizi, sayfa metinlerinizi ve ilanlarınızı her zaman düzenleyebilirsiniz.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-display text-[1.5rem] leading-tight">Ofis bilgilerini kontrol edin</h1>
            <dl className="grid gap-3 text-[14px] sm:grid-cols-2" data-testid="setup-office">
              {[
                ['Ofis adı', name],
                ['Telefon', office.phone],
                ['E-posta', office.email],
                ['Adres', office.address],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-border px-3.5 py-2.5">
                  <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
                  <dd className="truncate font-semibold">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[13px] text-muted-foreground">Eksik ya da hatalı bilgi varsa kurulumdan sonra Marka ve Görünüm sayfasından düzenleyebilirsiniz.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="font-display text-[1.5rem] leading-tight">Tasarımınızı seçin</h1>
            {families.length === 0 ? (
              <p className="rounded-xl bg-surface-muted px-4 py-3 text-[13.5px] text-muted-foreground" data-testid="setup-no-families">
                Ofisiniz için açılmış bir tasarım yok; siteniz KARAYS&apos;in hazırladığı mevcut tasarımla devam eder.
              </p>
            ) : (
              <ul role="radiogroup" aria-label="Tasarım aileleri" className="grid gap-4 sm:grid-cols-2">
                {families.map((f) => {
                  const selected = f.id === family;
                  return (
                    <li key={f.id} className="min-w-0">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={f.name}
                        onClick={() => setFamily(f.id)}
                        className={cn('flex w-full flex-col rounded-2xl border bg-surface p-3 text-left', selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border-strong')}
                      >
                        <span className="block overflow-hidden rounded-xl" aria-hidden>
                          <LivePreview config={f.config} brand={brand} darkAllowed={darkAllowed} name={name} variant="thumb" label={`${f.name} tasarım ailesi önizlemesi`} />
                        </span>
                        <span className="mt-3 flex items-center justify-between gap-2 px-1">
                          <span className="text-[15px] font-semibold">{f.name}</span>
                          {selected && <Check className="size-4 text-primary-ink" aria-hidden />}
                        </span>
                        <span className="mt-1 px-1 text-[13px] leading-relaxed text-muted-foreground">{f.description}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-[1.5rem] leading-tight">Önizleyin</h1>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  {chosen ? `${chosen.name} tasarımı, sitenizin gerçek bilgileriyle. Önizleme hiçbir şeyi değiştirmez.` : 'Siteniz mevcut tasarımıyla devam eder.'}
                </p>
              </div>
              <div role="group" aria-label="Cihaz" className="flex rounded-full bg-surface-muted p-1 ring-1 ring-border">
                {(
                  [
                    ['masaustu', 'Masaüstü', Monitor],
                    ['mobil', 'Telefon', Smartphone],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    title={label}
                    aria-pressed={device === id}
                    onClick={() => setDevice(id)}
                    className={cn('grid size-8 place-items-center rounded-full', device === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
            {chosen && (
              <div className="overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border">
                <iframe
                  key={`${chosen.id}-${device}`}
                  title={`${chosen.name} · önizleme`}
                  data-testid="setup-preview"
                  data-device={device}
                  src={`/site-onizleme/ofis?${new URLSearchParams({ aile: chosen.id, s: 'ana-sayfa' })}`}
                  className="mx-auto block max-w-full border-0 bg-white"
                  style={{ height: 640, width: device === 'mobil' ? 390 : '100%' }}
                />
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h1 className="font-display text-[1.5rem] leading-tight">Kurulumu tamamlayın</h1>
            <p className="text-[14px] text-muted-foreground" data-testid="setup-summary">
              {chosen ? (
                <>
                  Seçilen tasarım: <strong className="text-foreground">{chosen.name}</strong>. Onayladığınızda tasarım sitenize uygulanır.
                </>
              ) : (
                'Siteniz mevcut tasarımıyla devam eder.'
              )}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Tasarım seçimi bir kez yapılır; sonradan değiştirmek için KARAYS ile iletişime geçmeniz gerekir. Sitenizin ziyaretçilere açılması KARAYS ekibinin kontrolünden sonra olur.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => void go(step - 1)} disabled={pending}>
              <ArrowLeft /> Geri
            </Button>
          ) : (
            <span />
          )}
          {step < LAST_SETUP_STEP ? (
            <Button type="button" onClick={() => void go(step + 1)} loading={pending} disabled={step === 2 && families.length > 0 && !chosen}>
              Devam <ArrowRight />
            </Button>
          ) : (
            <Button type="button" onClick={() => void finish()} loading={pending}>
              <Check /> Kurulumu tamamla
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
