'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, ExternalLink, Eye, Loader2, RefreshCw } from 'lucide-react';
import { ListingStatusBadge } from '@/components/admin/ui';
import { MediaManager } from '@/components/admin/media/media-manager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { saveProperty, setPropertyStatus } from '@/app/actions/admin-properties';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AdminMedia } from '@/modules/media/server';
import { propertyPatchSchema, publishChecklist, type PropertyPatch } from '@/modules/properties/admin';
import type { EditorData, EditorProperty } from '@/modules/properties/admin-queries';
import { LISTING_TYPE_LABELS, type ListingStatus } from '@/modules/properties/constants';
import { EditorContext, type EditableKey, type EditorCtx, type EditorPerms, type EditorTaxonomy } from './editor-context';
import { StepBasics, StepDescription, StepDetails, StepLocation } from './steps-main';
import { StepPublish, StepSeo } from './steps-publish';
import { EDITOR_STEPS, type EditorStepId } from './editor-steps';

type SaveState = { kind: 'idle' } | { kind: 'dirty' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; message: string } | { kind: 'invalid' };

const AUTOSAVE_MS = 1500;

interface Props {
  data: EditorData;
  taxonomy: EditorTaxonomy;
  perms: EditorPerms;
  map: { attribution: string; maxZoom: number };
  initialStep: EditorStepId;
  siteHost: string;
}

export function PropertyEditor({ data, taxonomy, perms, map, initialStep, siteHost }: Props) {
  const [values, setValues] = useState<EditorProperty>(data.property);
  const [location, setLocationState] = useState(data.location);
  const [featureIds, setFeatureIdsState] = useState<number[]>(data.featureIds);
  const [media, setMedia] = useState<AdminMedia[]>(data.media);
  const [step, setStep] = useState<EditorStepId>(initialStep);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [conflict, setConflict] = useState(false);
  const [statusPending, setStatusPending] = useState<ListingStatus | null>(null);

  const readOnly = !perms.update || Boolean(values.deleted_at);
  const valuesRef = useRef(values);
  const locationRef = useRef(location);
  const featuresRef = useRef(featureIds);
  const updatedAtRef = useRef(data.property.updated_at);
  const dirty = useRef(new Set<EditableKey>());
  const locationDirty = useRef(false);
  const featuresDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  // Kayıt sırasında yeniden kirlenen alanlar için bir sonraki kaydı planlamak üzere güncel flush
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  useEffect(() => {
    valuesRef.current = values;
    locationRef.current = location;
    featuresRef.current = featureIds;
  }, [values, location, featureIds]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return false;
    const keys = [...dirty.current];
    const sendLocation = locationDirty.current;
    const sendFeatures = featuresDirty.current;
    if (keys.length === 0 && !sendLocation && !sendFeatures) return true;

    const patch: Record<string, unknown> = {};
    for (const key of keys) patch[key] = valuesRef.current[key];
    const parsed = propertyPatchSchema.safeParse(patch);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setSave({ kind: 'invalid' });
      return false;
    }
    setErrors({});

    const sent = { values: { ...valuesRef.current }, location: locationRef.current, features: featuresRef.current };
    inFlight.current = true;
    setSave({ kind: 'saving' });
    const res = await saveProperty(values.id, {
      patch: parsed.data as PropertyPatch,
      location: sendLocation ? sent.location : undefined,
      featureIds: sendFeatures ? sent.features : undefined,
      expectedUpdatedAt: updatedAtRef.current,
    });
    inFlight.current = false;

    if (!res.ok) {
      if (res.code === 'conflict') {
        setConflict(true);
        setSave({ kind: 'error', message: 'Çakışma' });
        return false;
      }
      if (res.fieldErrors) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.fieldErrors)) next[k] = v[0];
        setErrors(next);
      }
      setSave({ kind: 'error', message: res.error });
      return false;
    }

    updatedAtRef.current = res.data.updatedAt;
    // Kayıt sırasında yeniden değişen alanlar kirli kalır
    for (const key of keys) if (Object.is(valuesRef.current[key], sent.values[key])) dirty.current.delete(key);
    if (sendLocation && locationRef.current === sent.location) locationDirty.current = false;
    if (sendFeatures && featuresRef.current === sent.features) featuresDirty.current = false;
    setValues((v) => ({ ...v, updated_at: res.data.updatedAt, slug: res.data.slug }));

    const stillDirty = dirty.current.size > 0 || locationDirty.current || featuresDirty.current;
    setSave(stillDirty ? { kind: 'dirty' } : { kind: 'saved', at: new Date() });
    if (stillDirty) timer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
    return !stillDirty;
  }, [values.id]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const schedule = useCallback(() => {
    setSave({ kind: 'dirty' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  const set = useCallback<EditorCtx['set']>(
    (key, value) => {
      if (readOnly) return;
      setValues((v) => ({ ...v, [key]: value }));
      dirty.current.add(key);
      setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
      schedule();
    },
    [readOnly, schedule],
  );

  const setLocation = useCallback<EditorCtx['setLocation']>(
    (next) => {
      if (readOnly) return;
      setLocationState((l) => ({ ...l, ...next }));
      locationDirty.current = true;
      schedule();
    },
    [readOnly, schedule],
  );

  const setFeatureIds = useCallback(
    (ids: number[]) => {
      if (readOnly) return;
      setFeatureIdsState(ids);
      featuresDirty.current = true;
      schedule();
    },
    [readOnly, schedule],
  );

  // Kaydedilmemiş değişiklik varken sayfadan ayrılma uyarısı
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || locationDirty.current || featuresDirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function goTo(next: EditorStepId) {
    setStep(next);
    const url = new URL(window.location.href);
    url.searchParams.set('adim', next);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void flush();
  }

  async function changeStatus(status: ListingStatus) {
    const saved = await flush();
    if (!saved && (dirty.current.size || locationDirty.current || featuresDirty.current)) {
      toast.error('Önce kaydedilmemiş değişiklikleri düzeltin.');
      return;
    }
    setStatusPending(status);
    const res = await setPropertyStatus(values.id, status, updatedAtRef.current);
    setStatusPending(null);
    if (!res.ok) {
      if (res.code === 'conflict') setConflict(true);
      toast.error(res.error);
      return;
    }
    updatedAtRef.current = res.data.updatedAt;
    setValues((v) => ({
      ...v,
      status,
      slug: res.data.slug,
      updated_at: res.data.updatedAt,
      published_at: v.published_at ?? (status === 'published' ? new Date().toISOString() : null),
    }));
    toast.success(status === 'published' ? 'İlan yayınlandı.' : status === 'pending' ? 'İlan onaya gönderildi.' : 'İlan durumu güncellendi.');
  }

  const readyCount = media.filter((m) => m.status === 'ready').length;
  const publishChecks = publishChecklist({ ...values, readyPhotos: readyCount });
  const complete: Record<EditorStepId, boolean> = {
    temel: publishChecks.title && publishChecks.price,
    konum: publishChecks.location,
    ozellikler: values.gross_m2 !== null,
    fotograflar: readyCount > 0,
    aciklama: publishChecks.description,
    seo: Boolean(values.seo_description || (values.description ?? '').length >= 110),
    yayin: values.status === 'published',
  };
  const stepIndex = EDITOR_STEPS.findIndex((s) => s.id === step);
  const isPublic = ['published', 'sold', 'rented'].includes(values.status);

  const ctx = useMemo<EditorCtx>(
    () => ({ values, set, errors, location, setLocation, featureIds, setFeatureIds, media, setMedia, taxonomy, perms, map, readOnly }),
    [values, set, errors, location, setLocation, featureIds, setFeatureIds, media, taxonomy, perms, map, readOnly],
  );

  return (
    <EditorContext.Provider value={ctx}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/admin/ilanlar" className="mb-2 inline-flex text-[13px] font-medium text-muted-foreground hover:text-foreground">
            ← İlanlar
          </Link>
          <h1 className="line-clamp-2 font-display text-[1.7rem] leading-tight sm:text-[2rem]">{values.title || 'Yeni ilan'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className="numeric font-semibold text-foreground">{values.reference_no}</span>
            <span>
              · {LISTING_TYPE_LABELS[values.listing_type]} · {taxonomy.propertyTypes.find((t) => t.id === values.property_type_id)?.name}
            </span>
            <ListingStatusBadge status={values.status} deleted={Boolean(values.deleted_at)} />
            {values.is_demo && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] font-semibold">Demo</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator state={save} onRetry={() => void flush()} readOnly={readOnly} />
          <Button asChild variant="outline" size="sm">
            <a href={isPublic ? `/ilan/${values.slug}` : `/onizleme/ilan/${values.id}`} target="_blank" rel="noopener noreferrer">
              {isPublic ? <ExternalLink /> : <Eye />} {isPublic ? 'Sitede gör' : 'Önizle'}
            </a>
          </Button>
        </div>
      </div>

      {values.deleted_at && (
        <p role="alert" className="mb-6 rounded-2xl bg-danger-soft px-5 py-3.5 text-sm font-medium text-danger">
          Bu ilan çöp kutusunda ve düzenlenemez. İlanlar › Çöp kutusu bölümünden geri yükleyebilirsiniz.
        </p>
      )}
      {!perms.update && !values.deleted_at && (
        <p className="mb-6 rounded-2xl bg-surface-muted px-5 py-3.5 text-sm text-muted-foreground">Bu ilanı görüntüleme yetkiniz var; düzenleme yetkiniz yok.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="İlan adımları" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ol className="scrollbar-none relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {EDITOR_STEPS.map((s, i) => {
              const active = s.id === step;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(s.id)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition',
                      active ? 'bg-surface text-foreground shadow-xs ring-1 ring-border' : 'text-foreground/70 hover:bg-surface/70',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                        complete[s.id] ? 'bg-success text-white' : active ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-muted-foreground',
                      )}
                    >
                      {complete[s.id] ? <Check className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                    <span className="sr-only">{complete[s.id] ? '(tamamlandı)' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
            <h2 className="mb-6 text-[1.15rem] font-bold">
              <span className="text-muted-foreground">{stepIndex + 1}/7 · </span>
              {EDITOR_STEPS[stepIndex].label}
            </h2>
            {step === 'temel' && <StepBasics />}
            {step === 'konum' && <StepLocation />}
            {step === 'ozellikler' && <StepDetails />}
            {step === 'fotograflar' && (
              <MediaManager propertyId={values.id} propertyTitle={values.title} initialMedia={media} canManage={perms.media && !values.deleted_at} onMediaChange={setMedia} />
            )}
            {step === 'aciklama' && <StepDescription />}
            {step === 'seo' && <StepSeo siteHost={siteHost} />}
            {step === 'yayin' && (
              <StepPublish onStatus={changeStatus} statusPending={statusPending} stats={data.stats} priceHistory={data.priceHistory} history={data.history} />
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="outline" disabled={stepIndex === 0} onClick={() => goTo(EDITOR_STEPS[stepIndex - 1].id)}>
              <ArrowLeft /> Önceki
            </Button>
            {stepIndex < EDITOR_STEPS.length - 1 ? (
              <Button onClick={() => goTo(EDITOR_STEPS[stepIndex + 1].id)}>
                Sonraki: {EDITOR_STEPS[stepIndex + 1].label} <ArrowRight />
              </Button>
            ) : (
              <Button asChild variant="soft">
                <Link href="/admin/ilanlar">İlanlara dön</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={conflict} onOpenChange={() => undefined}>
        <DialogContent
          title="İlan başka bir oturumda değiştirildi"
          description="Siz düzenlerken bu ilan başka bir kullanıcı veya sekme tarafından kaydedildi. Veri kaybını önlemek için son hali yüklenecek; kaydedilmemiş son değişikliklerinizi yeniden girmeniz gerekebilir."
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="mt-6 flex justify-end">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Son hali yükle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EditorContext.Provider>
  );
}

function SaveIndicator({ state, onRetry, readOnly }: { state: SaveState; onRetry: () => void; readOnly: boolean }) {
  if (readOnly) return null;
  const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold';
  switch (state.kind) {
    case 'saving':
      return (
        <span className={cn(base, 'bg-surface-muted text-muted-foreground')} role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Kaydediliyor…
        </span>
      );
    case 'dirty':
      return (
        <span className={cn(base, 'bg-surface-muted text-muted-foreground')} role="status">
          <span className="size-2 rounded-full bg-warning" aria-hidden /> Değişiklikler kaydedilecek
        </span>
      );
    case 'saved':
      return (
        <span className={cn(base, 'bg-success-soft text-success')} role="status">
          <CheckCircle2 className="size-3.5" aria-hidden /> Kaydedildi · {formatTime(state.at)}
        </span>
      );
    case 'invalid':
      return (
        <span className={cn(base, 'bg-warning-soft text-warning')} role="alert">
          <AlertTriangle className="size-3.5" aria-hidden /> Hatalı alanlar düzeltilince kaydedilecek
        </span>
      );
    case 'error':
      return (
        <button type="button" onClick={onRetry} className={cn(base, 'bg-danger-soft text-danger hover:bg-danger-soft/80')} role="alert" title={state.message}>
          <CloudOff className="size-3.5" aria-hidden /> Kaydedilemedi — tekrar dene
        </button>
      );
    default:
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <CheckCircle2 className="size-3.5" aria-hidden /> Otomatik kaydediliyor
        </span>
      );
  }
}
