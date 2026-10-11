import Link from '@/components/common/intent-link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Panel } from '@/components/panel/ui';
import { onboardingProgress, onboardingSteps, type OnboardingFlags } from '@/modules/platform/customer-status';

/**
 * Ofis paneli kurulum listesi (FAZ 1). Yeni bir ofis, teknik bilgi gerektirmeden sırayla ilerler;
 * her adım ilgili mevcut ekrana gider. Bayraklar veritabanından (org_onboarding) gelir, KARAY
 * konsolundaki müşteri durumuyla aynı hesaptır. Site yayına açılıp tüm adımlar bitince gizlenir.
 */
export function OnboardingChecklist({ flags }: { flags: OnboardingFlags }) {
  const steps = onboardingSteps(flags);
  const progress = onboardingProgress(steps);
  if (flags.live && progress.done === progress.total) return null;
  const next = steps.find((s) => s.required && !s.done && s.href);
  return (
    <Panel
      className="mb-6"
      title="Sitenizi kurun"
      description={
        progress.done === progress.total
          ? 'Tüm adımlar tamam. KARAY ekibi sitenizi kontrol edip ziyaretçilere açacak.'
          : `${progress.done}/${progress.total} adım tamam. Her adım ilgili ekranı açar; değişiklikleri önizleyip yayınladığınızda sitede görünür.`
      }
    >
      <div data-onboarding-checklist data-progress={progress.percent}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Kurulum ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((s) => {
            const body = (
              <>
                {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="min-w-0">
                  <span className={s.done ? 'font-semibold' : 'font-semibold text-foreground'}>{s.label}</span>
                  {!s.required && <span className="text-muted-foreground"> (isteğe bağlı)</span>}
                  <span className="block text-[12.5px] text-muted-foreground">{s.done ? 'Tamam' : s.hint}</span>
                </span>
              </>
            );
            return (
              <li key={s.key} data-step={s.key} data-done={s.done}>
                {s.href && !s.done ? (
                  <Link href={s.href} className="flex h-full items-start gap-2 rounded-xl border border-border px-3 py-2.5 text-[13.5px] hover:border-border-strong">
                    {body}
                  </Link>
                ) : (
                  <div className="flex h-full items-start gap-2 rounded-xl border border-transparent px-3 py-2.5 text-[13.5px]">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
        {next && (
          <Link href={next.href!} className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-ink hover:underline">
            Sıradaki adım: {next.label} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </Panel>
  );
}
