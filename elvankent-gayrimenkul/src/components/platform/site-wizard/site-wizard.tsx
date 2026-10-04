'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/common/intent-link';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Laptop, LayoutTemplate, Loader2, Monitor, Smartphone, Sparkles, Tablet, X } from 'lucide-react';
import { createSite, publishNewSite } from '@/app/actions/site-create';
import { OwnerInvitationCard } from '@/components/platform/owner-invitation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { slugify } from '@/lib/slug';
import { cn } from '@/lib/utils';
import { encodePreviewPayload, siteInfoSchema, SOCIAL_KEYS, type SiteInfoInput } from '@/site-factory/site-info';

/** Sunucuda hazırlanan katalog görünümü (yalnızca gösterilecek alanlar) */
export interface WizardCatalog {
  siteTypes: { id: string; name: string; description: string; recommended: string[]; required: string[]; excluded: string[] }[];
  families: {
    id: string;
    name: string;
    description: string;
    audience: string;
    palette: string;
    swatch: string[];
    fonts: { heading: string; body: string; headingName: string; bodyName: string };
    defaults: Record<'theme' | 'hero' | 'header' | 'card' | 'cardLayout' | 'footer' | 'motion', string>;
    /** Ailenin yüzey kararları (style.slots → okunur ad); yoksa paketin standart parçası */
    surfaces: Record<string, string>;
    parts: string[];
    /** KARAY global olarak kapattı: listede görünür, seçilemez */
    disabled: boolean;
  }[];
  palettes: { id: string; name: string; swatch: string[] }[];
  fonts: { id: string; name: string; kind: 'serif' | 'sans' }[];
  variantLabels: Record<'theme' | 'hero' | 'header' | 'card' | 'cardLayout' | 'footer' | 'motion' | 'homepage', Record<string, string>>;
  fixedSlots: [string, string, string][];
  plans: { id: string; name: string }[];
  rootDomain: string | null;
}

type VariantKey = 'theme' | 'hero' | 'header' | 'card' | 'cardLayout' | 'footer' | 'motion' | 'homepage' | 'headingFont' | 'bodyFont';
type Variants = Partial<Record<VariantKey, string>>;

const STEPS = [
  { title: 'Site bilgileri', hint: 'Ad, iletişim, alan adı' },
  { title: 'Site tipi', hint: 'İçerik ve özellikler' },
  { title: 'Tasarım ailesi', hint: 'Görsel dil' },
  { title: 'Tasarım seçenekleri', hint: 'Parçalar ve tipografi' },
  { title: 'Önizleme', hint: 'Gerçek bileşenlerle' },
  { title: 'Onay ve oluşturma', hint: 'Özet ve yayın' },
] as const;

const SOCIAL_LABELS: Record<(typeof SOCIAL_KEYS)[number], string> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X (Twitter)', youtube: 'YouTube', linkedin: 'LinkedIn', tiktok: 'TikTok' };
const VARIANT_GROUPS: [Exclude<VariantKey, 'headingFont' | 'bodyFont'>, string][] = [
  ['theme', 'Tema (yazı tipi, köşe, yoğunluk)'],
  ['hero', 'Hero (üst bölüm)'],
  ['header', 'Header'],
  ['cardLayout', 'İlan kartı düzeni'],
  ['card', 'İlan kartı yüzeyi'],
  ['footer', 'Footer'],
  ['motion', 'Hareket dili'],
  ['homepage', 'Ana sayfa kompozisyonu'],
];
const DEVICES = [
  { id: 'desktop', label: 'Masaüstü', width: 1280, icon: Monitor },
  { id: 'laptop', label: 'Dizüstü', width: 1024, icon: Laptop },
  { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { id: 'mobile', label: 'Telefon', width: 390, icon: Smartphone },
] as const;

const emptyInfo = () => ({
  siteName: '',
  companyName: '',
  tagline: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: { line: '', district: '', city: '' },
  social: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])) as Record<(typeof SOCIAL_KEYS)[number], string>,
  seo: { title: '', description: '' },
});

/** İlan no öneki önerisi: adın ilk harfleri (ASCII, 3 harf) */
function suggestPrefix(name: string): string {
  const words = slugify(name, 60).split('-').filter(Boolean);
  const letters = (words.length >= 3 ? words.map((w) => w[0]) : [...(words[0] ?? ''), ...(words[1] ?? '')]).join('').replace(/[^a-z]/g, '');
  return letters.slice(0, 3).toUpperCase();
}

export function SiteWizard({ catalog }: { catalog: WizardCatalog }) {
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState(emptyInfo);
  const [account, setAccount] = useState({ slug: '', prefix: '', plan: catalog.plans[0]?.id ?? '', owner_name: '', owner_email: '' });
  const [touched, setTouched] = useState({ slug: false, prefix: false });
  const [domainMode, setDomainMode] = useState<'subdomain' | 'custom'>('subdomain');
  const [customDomain, setCustomDomain] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [siteType, setSiteType] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variants>({});
  const [palette, setPalette] = useState<string | null>(null);
  const [activate, setActivate] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<null | 'hesap' | 'logo' | 'yayin'>(null);
  const [done, setDone] = useState<{ id: string; slug: string; email: string; ownerAccount: 'invitation_pending' | 'existing_account'; warnings: string[]; published: boolean } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const family = catalog.families.find((f) => f.id === familyId) ?? null;
  const type = catalog.siteTypes.find((t) => t.id === siteType) ?? null;
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => void (logoUrl && URL.revokeObjectURL(logoUrl)), [logoUrl]);

  const manifest = useMemo(() => {
    if (!siteType || !familyId) return null;
    const v = Object.fromEntries(Object.entries(variants).filter(([, x]) => x)) as Variants;
    return { siteType, designFamily: familyId, ...(palette ? { palette } : {}), variants: v };
  }, [siteType, familyId, variants, palette]);

  const setInfoField = (path: string, value: string) =>
    setInfo((prev) => {
      const next = structuredClone(prev) as Record<string, unknown>;
      const keys = path.split('.');
      let o = next as Record<string, unknown>;
      for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
      o[keys[keys.length - 1]] = value;
      return next as typeof prev;
    });

  function onSiteName(v: string) {
    setInfoField('siteName', v);
    setAccount((a) => ({ ...a, slug: touched.slug ? a.slug : slugify(v, 40), prefix: touched.prefix ? a.prefix : suggestPrefix(v) }));
  }

  /** Adım 1 doğrulaması (sunucu ayrıca doğrular) */
  function validateInfo(): boolean {
    const next: Record<string, string> = {};
    const parsed = siteInfoSchema.safeParse(info);
    if (!parsed.success) for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(account.slug) || account.slug.length < 3) next.slug = 'Kısa ad en az 3 karakter olmalıdır (harf, rakam, tire).';
    if (!/^[A-Z]{2,5}$/.test(account.prefix)) next.prefix = 'İlan no öneki 2–5 büyük harf olmalıdır (ör. ABC).';
    if (account.owner_name.trim().length < 2) next.owner_name = 'Sahip adı en az 2 karakter olmalıdır.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.owner_email.trim())) next.owner_email = 'Sahip için geçerli bir e-posta girin.';
    if (domainMode === 'custom' && !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i.test(customDomain.trim()))
      next.customDomain = 'Yalnızca alan adını yazın (ör. www.ornekemlak.com) — https:// veya yol olmadan.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function canContinue(): boolean {
    if (step === 1) return !!siteType;
    if (step === 2) return !!familyId;
    return true;
  }

  function go(to: number) {
    if (to > step && step === 0 && !validateInfo()) {
      toast.error('Lütfen işaretli alanları kontrol edin.');
      return;
    }
    setStep(to);
    topRef.current?.scrollIntoView({ block: 'start' });
  }

  function chooseFamily(id: string) {
    if (id !== familyId) {
      setVariants({});
      setPalette(null);
    }
    setFamilyId(id);
  }

  async function create() {
    if (!manifest) return;
    setCreating('hesap');
    const res = await createSite({
      account: { name: info.companyName.trim() || info.siteName, ...account },
      info: info as SiteInfoInput,
      manifest,
      customDomain: domainMode === 'custom' ? customDomain : undefined,
    });
    if (!res.ok) {
      setCreating(null);
      const fe: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fieldErrors ?? {})) fe[k === '_' ? 'customDomain' : k === 'name' ? 'siteName' : k] = v[0];
      if (Object.keys(fe).length) {
        setErrors(fe);
        setStep(0);
      }
      toast.error(res.error);
      return;
    }
    const warnings = [...res.data.warnings];
    if (logo) {
      setCreating('logo');
      const fd = new FormData();
      fd.set('orgId', res.data.id);
      fd.set('kind', 'logo');
      fd.set('file', logo);
      const up = await fetch('/api/platform/branding', { method: 'POST', body: fd }).catch(() => null);
      if (!up?.ok) warnings.push('Logo yüklenemedi; Marka sekmesinden tekrar yükleyebilirsiniz.');
    }
    setCreating('yayin');
    const pub = await publishNewSite(res.data.id, activate);
    if (!pub.ok) warnings.push(`Site oluşturuldu ancak yayınlanamadı: ${pub.error}`);
    setCreating(null);
    setDone({ id: res.data.id, slug: res.data.slug, email: res.data.ownerEmail, ownerAccount: res.data.ownerAccount, warnings, published: pub.ok });
    topRef.current?.scrollIntoView({ block: 'start' });
  }

  if (done) return <Result done={done} activate={activate} rootDomain={catalog.rootDomain} customDomain={domainMode === 'custom' ? customDomain.trim().toLowerCase() : null} />;

  return (
    <div ref={topRef} className="grid scroll-mt-24 grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <Stepper step={step} onGo={(i) => i < step && go(i)} />
      <div className="min-w-0 rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-20px_rgb(0_0_0/0.18)]">
        <div className="border-b border-border px-5 py-4 sm:px-7">
          <p className="text-[12px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Adım {step + 1} / {STEPS.length}
          </p>
          <h2 className="mt-1 text-[1.25rem] font-semibold text-foreground">{STEPS[step].title}</h2>
        </div>
        <div className="px-5 py-6 sm:px-7">
          {step === 0 && (
            <InfoStep
              info={info}
              setField={setInfoField}
              onSiteName={onSiteName}
              account={account}
              setAccount={(k, v) => {
                setAccount((a) => ({ ...a, [k]: k === 'prefix' ? v.toUpperCase() : v }));
                if (k === 'slug' || k === 'prefix') setTouched((t) => ({ ...t, [k]: true }));
              }}
              plans={catalog.plans}
              rootDomain={catalog.rootDomain}
              domainMode={domainMode}
              setDomainMode={setDomainMode}
              customDomain={customDomain}
              setCustomDomain={setCustomDomain}
              logo={logo}
              logoUrl={logoUrl}
              setLogo={setLogo}
              errors={errors}
            />
          )}
          {step === 1 && <TypeStep types={catalog.siteTypes} value={siteType} onChange={setSiteType} />}
          {step === 2 && <FamilyStep families={catalog.families} recommended={type?.recommended ?? []} value={familyId} onChange={chooseFamily} />}
          {step === 3 && family && (
            <VariantStep catalog={catalog} family={family} variants={variants} setVariants={setVariants} palette={palette} setPalette={setPalette} />
          )}
          {step === 4 && manifest && <PreviewStep manifest={manifest} info={info} />}
          {step === 5 && manifest && family && type && (
            <ConfirmStep
              info={info}
              account={account}
              domain={domainMode === 'custom' ? customDomain : catalog.rootDomain ? `${account.slug}.${catalog.rootDomain}` : `${account.slug} (alt alan adı)`}
              type={type}
              family={family}
              manifest={manifest}
              catalog={catalog}
              logo={logo}
              activate={activate}
              setActivate={setActivate}
              creating={creating}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-4 sm:px-7">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || creating !== null}>
            <ArrowLeft /> Geri
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(step + 1)} disabled={!canContinue()}>
              {step === 3 ? 'Önizle' : 'Devam'} <ArrowRight />
            </Button>
          ) : (
            <Button onClick={create} loading={creating !== null} disabled={!manifest}>
              <Sparkles /> Siteyi oluştur
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Sihirbaz adımları" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo';
          return (
            <li key={s.title} className="shrink-0">
              <button
                type="button"
                onClick={() => onGo(i)}
                disabled={state !== 'done'}
                aria-current={state === 'current' ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  state === 'current' && 'bg-surface shadow-sm ring-1 ring-border',
                  state === 'done' && 'hover:bg-surface-muted',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold',
                    state === 'done' && 'bg-primary text-white',
                    state === 'current' && 'bg-foreground text-background',
                    state === 'todo' && 'bg-surface-muted text-muted-foreground ring-1 ring-border',
                  )}
                >
                  {state === 'done' ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cn('block text-[13.5px] font-semibold', state === 'todo' ? 'text-muted-foreground' : 'text-foreground')}>{s.title}</span>
                  <span className="hidden text-[12px] text-muted-foreground lg:block">{s.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 sm:col-span-2">
      <h3 className="text-[14.5px] font-semibold text-foreground">{children}</h3>
      {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

type Info = ReturnType<typeof emptyInfo>;
type Account = { slug: string; prefix: string; plan: string; owner_name: string; owner_email: string };

function InfoStep(props: {
  info: Info;
  setField: (path: string, v: string) => void;
  onSiteName: (v: string) => void;
  account: Account;
  setAccount: (k: keyof Account, v: string) => void;
  plans: { id: string; name: string }[];
  rootDomain: string | null;
  domainMode: 'subdomain' | 'custom';
  setDomainMode: (m: 'subdomain' | 'custom') => void;
  customDomain: string;
  setCustomDomain: (v: string) => void;
  logo: File | null;
  logoUrl: string | null;
  setLogo: (f: File | null) => void;
  errors: Record<string, string>;
}) {
  const { info, setField, account, setAccount, errors } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <SectionTitle hint="Sitede görünen ad ve firma bilgisi.">Kimlik</SectionTitle>
        <Field label="Site adı" htmlFor="w-site-name" required error={errors.siteName}>
          <Input id="w-site-name" value={info.siteName} onChange={(e) => props.onSiteName(e.target.value)} maxLength={80} placeholder="ör. Örnek Gayrimenkul" autoComplete="off" />
        </Field>
        <Field label="Firma / ofis adı (ticari unvan)" htmlFor="w-company" optional error={errors.companyName}>
          <Input id="w-company" value={info.companyName} onChange={(e) => setField('companyName', e.target.value)} maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Kısa tanıtım cümlesi" htmlFor="w-tagline" optional error={errors.tagline} className="sm:col-span-2">
          <Input id="w-tagline" value={info.tagline} onChange={(e) => setField('tagline', e.target.value)} maxLength={160} autoComplete="off" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13.5px] font-semibold text-foreground">
            Logo <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-16 w-40 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted">
              {props.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- yerel dosya önizlemesi (blob:)
                <img src={props.logoUrl} alt="Seçilen logo" className="max-h-12 max-w-36 object-contain" />
              ) : (
                <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" id="w-logo" onChange={(e) => props.setLogo(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              {props.logo ? 'Değiştir' : 'Logo seç'}
            </Button>
            {props.logo && (
              <Button type="button" variant="ghost" size="sm" onClick={() => props.setLogo(null)}>
                <X /> Kaldır
              </Button>
            )}
            <p className="w-full text-[12.5px] text-muted-foreground">Site oluşturulurken yüklenir ve doğrulanır. Önizlemede logo yerine site adı görünür.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionTitle hint="Sitenin adresi. Alt alan adı hemen çalışır; özel alan adı için DNS kaydı gerekir.">Alan adı</SectionTitle>
        <div className="flex flex-wrap gap-2 sm:col-span-2" role="radiogroup" aria-label="Alan adı türü">
          {(['subdomain', 'custom'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={props.domainMode === m}
              onClick={() => props.setDomainMode(m)}
              className={cn('rounded-full px-4 py-2 text-[13.5px] font-semibold ring-1 transition', props.domainMode === m ? 'bg-foreground text-background ring-foreground' : 'bg-surface text-foreground ring-border hover:bg-surface-muted')}
            >
              {m === 'subdomain' ? 'Alt alan adı' : 'Özel alan adı'}
            </button>
          ))}
        </div>
        <Field label="Kısa ad (alt alan adı)" htmlFor="w-slug" required error={errors.slug} hint={props.rootDomain ? `${account.slug || 'ornek'}.${props.rootDomain}` : 'Harf, rakam ve tire; sitenin kalıcı kısa adı.'}>
          <Input id="w-slug" value={account.slug} onChange={(e) => setAccount('slug', e.target.value.toLowerCase())} maxLength={40} autoComplete="off" spellCheck={false} />
        </Field>
        {props.domainMode === 'custom' ? (
          <Field label="Özel alan adı" htmlFor="w-domain" required error={errors.customDomain} hint="Doğrulama bekleyen alan adı olarak eklenir; TXT doğrulaması ve yönlendirmeden sonra birincil adres olur.">
            <Input id="w-domain" value={props.customDomain} onChange={(e) => props.setCustomDomain(e.target.value)} placeholder="www.ornekemlak.com" autoComplete="off" spellCheck={false} maxLength={253} />
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionTitle hint="Sitede ve iletişim bölümlerinde görünür.">İletişim ve adres</SectionTitle>
        <Field label="Telefon" htmlFor="w-phone" optional error={errors.phone}>
          <Input id="w-phone" type="tel" value={info.phone} onChange={(e) => setField('phone', e.target.value)} maxLength={30} autoComplete="off" />
        </Field>
        <Field label="WhatsApp" htmlFor="w-whatsapp" optional error={errors.whatsapp} hint="Boşsa telefon kullanılır.">
          <Input id="w-whatsapp" type="tel" value={info.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} maxLength={30} autoComplete="off" />
        </Field>
        <Field label="E-posta" htmlFor="w-email" optional error={errors.email}>
          <Input id="w-email" type="email" value={info.email} onChange={(e) => setField('email', e.target.value)} maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Adres" htmlFor="w-address" optional error={errors['address.line']}>
          <Input id="w-address" value={info.address.line} onChange={(e) => setField('address.line', e.target.value)} maxLength={240} autoComplete="off" />
        </Field>
        <Field label="İlçe" htmlFor="w-district" optional error={errors['address.district']}>
          <Input id="w-district" value={info.address.district} onChange={(e) => setField('address.district', e.target.value)} maxLength={80} autoComplete="off" />
        </Field>
        <Field label="İl" htmlFor="w-city" optional error={errors['address.city']}>
          <Input id="w-city" value={info.address.city} onChange={(e) => setField('address.city', e.target.value)} maxLength={80} autoComplete="off" />
        </Field>
      </div>

      <details className="group rounded-xl border border-border px-4 py-3">
        <summary className="cursor-pointer list-none text-[14px] font-semibold marker:hidden">
          Sosyal medya ve temel SEO <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
        </summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {SOCIAL_KEYS.map((k) => (
            <Field key={k} label={SOCIAL_LABELS[k]} htmlFor={`w-social-${k}`} error={errors[`social.${k}`]}>
              <Input id={`w-social-${k}`} value={info.social[k]} onChange={(e) => setField(`social.${k}`, e.target.value)} placeholder="https://" maxLength={300} autoComplete="off" spellCheck={false} />
            </Field>
          ))}
          <Field label="SEO başlığı" htmlFor="w-seo-title" error={errors['seo.title']} hint="Boşsa site adından üretilir." className="sm:col-span-2">
            <Input id="w-seo-title" value={info.seo.title} onChange={(e) => setField('seo.title', e.target.value)} maxLength={70} autoComplete="off" />
          </Field>
          <Field label="SEO açıklaması" htmlFor="w-seo-desc" error={errors['seo.description']} className="sm:col-span-2">
            <Textarea id="w-seo-desc" value={info.seo.description} onChange={(e) => setField('seo.description', e.target.value)} maxLength={200} rows={2} />
          </Field>
        </div>
      </details>

      <div className="grid gap-5 sm:grid-cols-2">
        <SectionTitle hint="Ofis paneline giriş yapacak sahip hesabı ve abonelik.">Hesap</SectionTitle>
        <Field label="Sahip adı soyadı" htmlFor="w-owner-name" required error={errors.owner_name}>
          <Input id="w-owner-name" value={account.owner_name} onChange={(e) => setAccount('owner_name', e.target.value)} maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Sahip e-postası" htmlFor="w-owner-email" required error={errors.owner_email} hint="Hesap yoksa oluşturulur; sahibe aktivasyon daveti gönderilir.">
          <Input id="w-owner-email" type="email" value={account.owner_email} onChange={(e) => setAccount('owner_email', e.target.value)} maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Plan" htmlFor="w-plan" error={errors.plan} hint="14 günlük deneme süresiyle başlar.">
          <Select id="w-plan" value={account.plan} onChange={(e) => setAccount('plan', e.target.value)}>
            {props.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İlan no öneki" htmlFor="w-prefix" required error={errors.prefix} hint="2–5 harf; ilan numaraları ABC-2026-0001 biçiminde.">
          <Input id="w-prefix" value={account.prefix} onChange={(e) => setAccount('prefix', e.target.value)} maxLength={5} className="uppercase" autoComplete="off" />
        </Field>
      </div>
    </div>
  );
}

function ChoiceCard({ selected, onSelect, children, className, label, disabled }: { selected: boolean; onSelect: () => void; children: React.ReactNode; className?: string; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        'relative flex h-full w-full flex-col rounded-2xl border bg-surface p-5 text-left transition-[box-shadow,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'border-foreground shadow-[0_0_0_1px_var(--color-foreground)]' : 'border-border hover:border-foreground/30 hover:shadow-sm',
        className,
      )}
    >
      {selected && (
        <span className="absolute top-4 right-4 grid size-6 place-items-center rounded-full bg-foreground text-background">
          <Check className="size-3.5" aria-hidden />
        </span>
      )}
      {children}
    </button>
  );
}

function TypeStep({ types, value, onChange }: { types: WizardCatalog['siteTypes']; value: string | null; onChange: (id: string) => void }) {
  return (
    <div>
      <p className="mb-5 max-w-2xl text-[14px] text-muted-foreground">
        Site tipi sitenin <strong className="font-semibold text-foreground">içerik ve özellik mimarisini</strong> belirler (hangi bölümler, sayfalar ve özellikler). Görsel dil bir sonraki adımda, bundan bağımsız seçilir.
      </p>
      <div role="radiogroup" aria-label="Site tipi" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((t) => (
          <ChoiceCard key={t.id} selected={value === t.id} onSelect={() => onChange(t.id)} label={t.name}>
            <span className="pr-8 text-[15.5px] font-semibold text-foreground">{t.name}</span>
            <span className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{t.description}</span>
          </ChoiceCard>
        ))}
      </div>
    </div>
  );
}

function FamilyStep({ families, recommended, value, onChange }: { families: WizardCatalog['families']; recommended: string[]; value: string | null; onChange: (id: string) => void }) {
  const fonts = [...new Set(families.map((f) => f.fonts.heading))];
  return (
    <div>
      {/* Yalnızca ailelerin başlık yazı tipleri, örnek "Aa" için (KARAY yüzeyi; kiracıya gitmez) */}
      {fonts.map((f) => (
        <link key={f} rel="stylesheet" href={`/fonts/site/${f}/preview.css`} precedence="default" />
      ))}
      <p className="mb-5 max-w-2xl text-[14px] text-muted-foreground">
        Tasarım ailesi sitenin <strong className="font-semibold text-foreground">görsel dilidir</strong>: renk, tipografi, hero, header, kartlar, footer ve hareket. Oluşturulan site yalnızca seçilen paketi taşır.
      </p>
      <div role="radiogroup" aria-label="Tasarım ailesi" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {families.map((f) => (
          <ChoiceCard key={f.id} selected={value === f.id} onSelect={() => !f.disabled && onChange(f.id)} label={f.name} className={cn('p-0', f.disabled && 'cursor-not-allowed opacity-55')} disabled={f.disabled}>
            <span className="flex h-28 items-end justify-between overflow-hidden rounded-t-2xl px-5 pb-4" style={{ background: f.swatch[2], color: f.swatch[3] }}>
              <span className="text-[2.6rem] leading-none" style={{ fontFamily: `"${f.fonts.headingName}", serif` }} aria-hidden>
                Aa
              </span>
              <span className="flex gap-1.5" aria-hidden>
                {f.swatch.slice(0, 2).map((c) => (
                  <span key={c} className="size-6 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                ))}
              </span>
            </span>
            <span className="flex flex-1 flex-col p-5">
              <span className="flex flex-wrap items-center gap-2 pr-8">
                <span className="text-[15.5px] font-semibold text-foreground">{f.name}</span>
                {f.disabled ? <Badge>Katalogda kapalı</Badge> : recommended.includes(f.id) && <Badge variant="success">Önerilen</Badge>}
              </span>
              <span className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.description}</span>
              <span className="mt-3 text-[12.5px] text-muted-foreground">
                {f.fonts.headingName} / {f.fonts.bodyName} · {f.audience}
              </span>
            </span>
          </ChoiceCard>
        ))}
      </div>
    </div>
  );
}

function Chips({ label, options, value, familyValue, onChange }: { label: string; options: Record<string, string>; value: string | undefined; familyValue: string; onChange: (v: string | undefined) => void }) {
  const current = value ?? familyValue;
  return (
    <fieldset>
      <legend className="mb-2 text-[13.5px] font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={current === v}
            onClick={() => onChange(v === familyValue ? undefined : v)}
            className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition', current === v ? 'bg-foreground text-background ring-foreground' : 'bg-surface text-foreground ring-border hover:bg-surface-muted')}
          >
            {l}
            {v === familyValue && <span className={cn('ml-1.5 text-[11px]', current === v ? 'text-background/70' : 'text-muted-foreground')}>aile</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function VariantStep({ catalog, family, variants, setVariants, palette, setPalette }: { catalog: WizardCatalog; family: WizardCatalog['families'][number]; variants: Variants; setVariants: (fn: (v: Variants) => Variants) => void; palette: string | null; setPalette: (p: string | null) => void }) {
  const set = (k: VariantKey, v: string | undefined) => setVariants((x) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-[14px] text-muted-foreground">
        <strong className="font-semibold text-foreground">{family.name}</strong> ailesinin seçimleri işaretli (<span className="text-[12px]">aile</span>). İsterseniz parçaları değiştirin; değiştirilmeyen her şey ailenin seçimi olarak kalır.
      </p>
      <div className="grid gap-7 xl:grid-cols-2">
        {VARIANT_GROUPS.map(([k, label]) => (
          <Chips key={k} label={label} options={catalog.variantLabels[k]} value={variants[k]} familyValue={k === 'homepage' ? 'family' : family.defaults[k]} onChange={(v) => set(k, v)} />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Başlık yazı tipi" htmlFor="w-font-heading">
          <Select id="w-font-heading" value={variants.headingFont ?? ''} onChange={(e) => set('headingFont', e.target.value || undefined)}>
            <option value="">Aileden ({family.fonts.headingName})</option>
            {catalog.fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.kind === 'serif' ? 'serif' : 'sans'})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gövde yazı tipi" htmlFor="w-font-body">
          <Select id="w-font-body" value={variants.bodyFont ?? ''} onChange={(e) => set('bodyFont', e.target.value || undefined)}>
            <option value="">Aileden ({family.fonts.bodyName})</option>
            {catalog.fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.kind === 'serif' ? 'serif' : 'sans'})
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13.5px] font-semibold text-foreground">Renk sistemi</legend>
        <div className="flex flex-wrap gap-2">
          {catalog.palettes.map((p) => {
            const active = (palette ?? family.palette) === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPalette(p.id === family.palette ? null : p.id)}
                className={cn('flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-[13px] font-medium ring-1 transition', active ? 'bg-foreground text-background ring-foreground' : 'bg-surface text-foreground ring-border hover:bg-surface-muted')}
              >
                <span className="flex -space-x-1" aria-hidden>
                  {p.swatch.slice(0, 2).map((c) => (
                    <span key={c} className="size-4 rounded-full ring-2 ring-surface" style={{ background: c }} />
                  ))}
                </span>
                {p.name}
                {p.id === family.palette && <span className={cn('text-[11px]', active ? 'text-background/70' : 'text-muted-foreground')}>aile</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="rounded-xl bg-surface-muted p-4">
        <p className="text-[13px] font-semibold text-foreground">Paketin diğer parçaları</p>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {catalog.fixedSlots.map(([k, label, value]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium text-foreground">{family.surfaces[k] ?? value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Önizlenen yüzeyler (site-onizleme ?s=): kiracı sitesinin aynı bileşenleri */
const PREVIEW_PAGES = [
  { id: 'ana-sayfa', label: 'Ana sayfa' },
  { id: 'ilanlar', label: 'Arama' },
  { id: 'ilan', label: 'İlan detayı' },
] as const;

function PreviewStep({ manifest, info }: { manifest: object; info: Info }) {
  // Dar ekranda (telefon) önizleme telefon genişliğinde açılır; masaüstü küçültülmüş hâlde okunmaz
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 'mobile' : 'desktop'));
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [surface, setSurface] = useState<(typeof PREVIEW_PAGES)[number]['id']>('ana-sayfa');
  const d = DEVICES.find((x) => x.id === device)!;
  const src = useMemo(() => `/site-onizleme?p=${encodePreviewPayload({ manifest: manifest as never, info: info as SiteInfoInput })}&s=${surface}`, [manifest, info, surface]);
  const scale = boxWidth ? Math.min(1, boxWidth / d.width) : 1;
  const height = 760;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13.5px] text-muted-foreground">Sitenin gerçek bileşenleriyle, seçilen paketle ve örnek içerikle çizilir. Oluşturulan site bu manifestin aynısını kullanır.</p>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Önizlenen sayfa" className="flex flex-wrap rounded-full bg-surface-muted p-1 ring-1 ring-border">
            {PREVIEW_PAGES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={surface === x.id}
                onClick={() => {
                  setLoading(true);
                  setSurface(x.id);
                }}
                className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-medium transition', surface === x.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Cihaz" className="flex rounded-full bg-surface-muted p-1 ring-1 ring-border">
            {DEVICES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={device === x.id}
                aria-label={`${x.label} (${x.width} px)`}
                title={`${x.label} · ${x.width} px`}
                onClick={() => {
                  setDevice(x.id);
                }}
                className={cn('grid size-8 place-items-center rounded-full transition', device === x.id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <x.icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={src} target="_blank" rel="noopener">
              <ExternalLink /> Yeni sekmede
            </a>
          </Button>
        </div>
      </div>
      <div ref={boxRef} className="relative overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border" style={{ height: height * scale }}>
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Önizleme hazırlanıyor…
            </span>
          </div>
        )}
        <iframe
          key={src}
          title="Site önizlemesi"
          src={src}
          onLoad={() => setLoading(false)}
          className="absolute top-0 left-1/2 origin-top border-0 bg-white"
          style={{ width: d.width, height, transform: `translateX(-50%) scale(${scale})` }}
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-[13.5px] font-medium text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

function ConfirmStep(props: {
  info: Info;
  account: Account;
  domain: string;
  type: WizardCatalog['siteTypes'][number];
  family: WizardCatalog['families'][number];
  manifest: { siteType: string; designFamily: string; palette?: string; variants: Variants };
  catalog: WizardCatalog;
  logo: File | null;
  activate: boolean;
  setActivate: (v: boolean) => void;
  creating: null | 'hesap' | 'logo' | 'yayin';
}) {
  const { info, account, family, manifest, catalog } = props;
  const v = manifest.variants;
  const label = (k: Exclude<VariantKey, 'headingFont' | 'bodyFont'>) => {
    const value = v[k] ?? (k === 'homepage' ? 'family' : family.defaults[k]);
    return `${catalog.variantLabels[k][value] ?? value}${v[k] ? '' : ' (aile)'}`;
  };
  const font = (id: string | undefined, fallback: string) => (id ? (catalog.fonts.find((f) => f.id === id)?.name ?? id) : `${fallback} (aile)`);
  const steps = [
    ['hesap', 'Hesap ve site kaydı'],
    ...(props.logo ? [['logo', 'Logo yükleme']] : []),
    ['yayin', 'İlk sürümün yayınlanması'],
  ] as const;
  const order = steps.map(([k]) => k as string);
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <div>
        <h3 className="mb-2 text-[14.5px] font-semibold">Site</h3>
        <dl>
          <SummaryRow label="Site adı">{info.siteName}</SummaryRow>
          {info.companyName && <SummaryRow label="Firma">{info.companyName}</SummaryRow>}
          <SummaryRow label="Adres">{props.domain}</SummaryRow>
          <SummaryRow label="Sahip">
            {account.owner_name} · {account.owner_email}
          </SummaryRow>
          <SummaryRow label="Plan / önek">
            {catalog.plans.find((p) => p.id === account.plan)?.name ?? account.plan} · {account.prefix}
          </SummaryRow>
          <SummaryRow label="Site tipi">{props.type.name}</SummaryRow>
          <SummaryRow label="Logo">{props.logo ? props.logo.name : 'Yok (site adı gösterilir)'}</SummaryRow>
        </dl>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold">
          <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden /> Tasarım paketi (manifest)
        </h3>
        <dl>
          <SummaryRow label="Tasarım ailesi">{family.name}</SummaryRow>
          <SummaryRow label="Hero">{label('hero')}</SummaryRow>
          <SummaryRow label="Header">{label('header')}</SummaryRow>
          <SummaryRow label="İlan kartı">
            {label('cardLayout')} · {label('card')}
          </SummaryRow>
          <SummaryRow label="Footer">{label('footer')}</SummaryRow>
          <SummaryRow label="Hareket">{label('motion')}</SummaryRow>
          <SummaryRow label="Ana sayfa">{label('homepage')}</SummaryRow>
          <SummaryRow label="Tipografi">
            {font(v.headingFont, family.fonts.headingName)} / {font(v.bodyFont, family.fonts.bodyName)}
          </SummaryRow>
          <SummaryRow label="Renk sistemi">{manifest.palette ? (catalog.palettes.find((p) => p.id === manifest.palette)?.name ?? manifest.palette) : `${catalog.palettes.find((p) => p.id === family.palette)?.name ?? family.palette} (aile)`}</SummaryRow>
        </dl>
      </div>
      <div className="space-y-4 xl:col-span-2">
        <Checkbox
          checked={props.activate}
          onChange={(e) => props.setActivate(e.target.checked)}
          label="Oluşturduktan sonra siteyi hemen yayına al"
          description="Kapalıysa site taslak durumunda kalır (ziyaretçiye kapalı); Web Siteleri › Durum'dan açabilirsiniz."
        />
        {props.creating && (
          <ol className="space-y-2 rounded-xl bg-surface-muted p-4" aria-live="polite">
            {steps.map(([k, l]) => {
              const i = order.indexOf(k);
              const cur = order.indexOf(props.creating!);
              return (
                <li key={k} className="flex items-center gap-2.5 text-[13.5px]">
                  {i < cur ? <Check className="size-4 text-success" aria-hidden /> : i === cur ? <Loader2 className="size-4 animate-spin text-foreground" aria-hidden /> : <span className="size-4 rounded-full ring-1 ring-border" aria-hidden />}
                  <span className={i > cur ? 'text-muted-foreground' : 'text-foreground'}>{l}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Result({ done, activate, rootDomain, customDomain }: { done: { id: string; slug: string; email: string; ownerAccount: 'invitation_pending' | 'existing_account'; warnings: string[]; published: boolean }; activate: boolean; rootDomain: string | null; customDomain: string | null }) {
  // Özel alan adı doğrulanana kadar site varsayılan (alt alan adı) adresinde açılır
  const url = rootDomain ? `https://${done.slug}.${rootDomain}` : null;
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.18)] sm:p-8" role="status">
      <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
        <Check className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-[1.35rem] font-semibold">Site oluşturuldu</h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {done.published ? (activate ? 'İlk sürüm yayınlandı ve site ziyaretçiye açık.' : 'İlk sürüm yayınlandı; site taslak durumunda (ziyaretçiye kapalı).') : 'Site kaydedildi; yayın tamamlanamadı.'}
      </p>
      {customDomain && (
        <p className="mt-3 text-[13.5px] text-muted-foreground" data-testid="custom-domain-pending">
          {customDomain} doğrulama bekliyor: Site Kontrol Merkezi › Alan adı sekmesindeki TXT kaydıyla doğrulayıp bağlayın. O zamana kadar site varsayılan adresinde açılır.
        </p>
      )}
      {done.warnings.length > 0 && (
        <ul className="mt-4 space-y-1.5 rounded-xl bg-warning-soft p-4 text-[13.5px] text-warning">
          {done.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {done.ownerAccount === 'invitation_pending' ? (
        <div className="mt-5 rounded-xl border border-border p-4">
          <OwnerInvitationCard orgId={done.id} email={done.email} invitation={{ status: 'pending', expiresAt: null, lastSentAt: null, acceptedAt: null, accountPending: true }} />
          <p className="mt-3 text-[12.5px] text-muted-foreground">Sahip şifresini davet e-postasındaki tek kullanımlık bağlantıyla kendisi belirler; şifre kimseye gösterilmez.</p>
        </div>
      ) : (
        <p className="mt-5 text-[13.5px] text-muted-foreground">{done.email} adresli mevcut hesap sahip olarak eklendi; mevcut şifresiyle giriş yapar.</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/platform/siteler/${done.id}`}>Site Kontrol Merkezi</Link>
        </Button>
        {url && (
          <Button asChild variant="outline">
            <a href={url} target="_blank" rel="noopener">
              <ExternalLink /> Siteyi aç
            </a>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/platform/siteler">Web Siteleri</Link>
        </Button>
      </div>
    </div>
  );
}
