/**
 * FAZ 1 — Müşteri durumu ve site kurulum adımları (saf modül: veritabanına / ortama bakmaz).
 *
 * Yeni bir durum kolonu YOK: durum mevcut kayıtlardan türetilir (ofis durumu, sahip hesabı,
 * site yayın sürümü ve site durumu, alan adları, abonelik). Ofis paneli (kurulum listesi) ve KARAY
 * konsolu (müşteri listesi) AYNI hesabı kullanır. Bayraklar veritabanında _org_onboarding_flags'ten.
 */

export interface OnboardingFlags {
  company: boolean;
  logo: boolean;
  contact: boolean;
  design: boolean;
  seo: boolean;
  listing: boolean;
  published: boolean;
  pending_changes: boolean;
  domain: boolean;
  domain_available: boolean;
  live: boolean;
}

export type OnboardingStepKey = 'company' | 'logo' | 'contact' | 'design' | 'listing' | 'seo' | 'publish' | 'domain' | 'live';

export interface OnboardingStep {
  key: OnboardingStepKey;
  label: string;
  done: boolean;
  /** false: yüzdeye katılmaz (planda yok / KARAY'ın adımı) */
  required: boolean;
  /** Ofis panelinde ilgili ekran (KARAY'ın adımında yok) */
  href: string | null;
  hint: string;
}

const EMPTY: OnboardingFlags = {
  company: false,
  logo: false,
  contact: false,
  design: false,
  seo: false,
  listing: false,
  published: false,
  pending_changes: false,
  domain: false,
  domain_available: false,
  live: false,
};

/** Veritabanından gelen JSON'u güvenle bayraklara çevirir (eksik / bozuk alan = false) */
export function parseOnboardingFlags(raw: unknown): OnboardingFlags {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof OnboardingFlags)[]) out[key] = src[key] === true;
  return out;
}

export function onboardingSteps(flags: OnboardingFlags): OnboardingStep[] {
  return [
    { key: 'company', label: 'Firma bilgileri', done: flags.company, required: true, href: '/admin/sirket', hint: 'Firma adı ve telefon veya e-posta' },
    { key: 'logo', label: 'Logo', done: flags.logo, required: true, href: '/admin/sirket', hint: 'Sitede ve panelde görünen logo' },
    { key: 'contact', label: 'İletişim ve adres', done: flags.contact, required: true, href: '/admin/sirket', hint: 'Telefon ve adres (il veya açık adres)' },
    { key: 'design', label: 'Tasarım', done: flags.design, required: true, href: '/admin/site/tasarim', hint: 'Tasarım ailesi ve tema' },
    { key: 'listing', label: 'İlk ilan', done: flags.listing, required: true, href: '/admin/ilanlar/yeni', hint: 'En az bir yayındaki gerçek ilan (demo sayılmaz)' },
    { key: 'seo', label: 'Arama motoru (SEO)', done: flags.seo, required: true, href: '/admin/site/seo', hint: 'Site başlığı veya açıklaması' },
    {
      key: 'publish',
      label: 'Değişiklikleri yayınla',
      done: flags.published && !flags.pending_changes,
      required: true,
      href: '/admin/site',
      hint: flags.published && flags.pending_changes ? 'Yayınlanmamış taslak değişiklikler var' : 'Site yönetimi › Değişiklikleri yayınla',
    },
    {
      key: 'domain',
      label: 'Alan adı',
      done: flags.domain,
      required: flags.domain_available,
      href: flags.domain_available ? '/admin/site/alan-adi' : null,
      hint: flags.domain_available ? 'Kendi alan adınızı bağlayın' : 'Planınızda özel alan adı yok; site KARAY adresinde yayınlanır',
    },
    { key: 'live', label: 'Site yayına açıldı', done: flags.live, required: false, href: null, hint: 'KARAY ekibi kontrol ettikten sonra siteyi ziyaretçilere açar' },
  ];
}

/** Zorunlu adımların tamamlanma yüzdesi (0–100, tam sayı) */
export function onboardingProgress(steps: OnboardingStep[]): { done: number; total: number; percent: number } {
  const required = steps.filter((s) => s.required);
  const done = required.filter((s) => s.done).length;
  return { done, total: required.length, percent: required.length ? Math.round((done / required.length) * 100) : 100 };
}

// ---------------------------------------------------------------- Müşteri durumu (KARAY)

export type CustomerStatusKey = 'suspended' | 'invited' | 'setup' | 'ready' | 'live' | 'attention';

export interface CustomerStatusInput {
  orgStatus: string;
  ownerPending: boolean;
  hasOwner: boolean;
  invitationStatus: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  domainsWaiting: number;
  domainWaitingSince: string | null;
  flags: OnboardingFlags;
}

export interface CustomerStatus {
  key: CustomerStatusKey;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  /** Dikkat gerektiren durumlar (kurulum / yayın durumundan bağımsız) */
  issues: string[];
}

export const CUSTOMER_STATUS_META: Record<CustomerStatusKey, { label: string; tone: CustomerStatus['tone'] }> = {
  suspended: { label: 'Askıda', tone: 'danger' },
  invited: { label: 'Davet bekliyor', tone: 'neutral' },
  setup: { label: 'Kurulumda', tone: 'primary' },
  ready: { label: 'Yayına hazır', tone: 'warning' },
  live: { label: 'Yayında', tone: 'success' },
  attention: { label: 'Dikkat', tone: 'danger' },
};

/** Alan adı bu süreden uzun bekliyorsa (TXT / yönlendirme yapılmadı) dikkat ister */
export const DOMAIN_WAIT_DAYS = 3;
const DAY = 86_400_000;

export function customerIssues(input: CustomerStatusInput, now: Date = new Date()): string[] {
  const issues: string[] = [];
  if (input.orgStatus !== 'active') return issues;
  if (!input.hasOwner) issues.push('Aktif sahip hesabı yok');
  if (input.ownerPending && input.invitationStatus === 'expired') issues.push('Sahip davetinin süresi doldu');
  if (input.ownerPending && (!input.invitationStatus || input.invitationStatus === 'not_sent')) issues.push('Sahip daveti gönderilmedi');
  if (input.subscriptionStatus === 'past_due') issues.push('Ödeme gecikmede');
  if (input.subscriptionStatus === 'trialing' && input.trialEndsAt && new Date(input.trialEndsAt).getTime() <= now.getTime()) issues.push('Deneme süresi bitti');
  if (!input.subscriptionStatus) issues.push('Aktif abonelik yok');
  if (input.domainsWaiting > 0 && input.domainWaitingSince && now.getTime() - new Date(input.domainWaitingSince).getTime() > DOMAIN_WAIT_DAYS * DAY) {
    issues.push(`Alan adı ${DOMAIN_WAIT_DAYS} günden uzun süredir bağlanmayı bekliyor`);
  }
  if (input.flags.live && !input.flags.published) issues.push('Site ziyaretçilere açık ama hiç yayınlanmadı');
  return issues;
}

export function customerStatus(input: CustomerStatusInput, now: Date = new Date()): CustomerStatus {
  const issues = customerIssues(input, now);
  const make = (key: CustomerStatusKey): CustomerStatus => ({ key, ...CUSTOMER_STATUS_META[key], issues });
  if (input.orgStatus !== 'active') return make('suspended');
  if (issues.length > 0) return make('attention');
  if (input.ownerPending) return make('invited');
  if (input.flags.live && input.flags.published) return make('live');
  const progress = onboardingProgress(onboardingSteps(input.flags));
  return make(progress.done === progress.total ? 'ready' : 'setup');
}
