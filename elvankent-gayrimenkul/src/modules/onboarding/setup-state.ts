/**
 * PILOT · İlk kurulum (bekleyen migration I: supabase/pending/20261108000005_org_setup.sql) — saf durum modülü.
 * Veritabanına / ortama bakmaz; sunucu (setup.ts), panel düzeni, kurulum sayfası ve KARAYS konsolu AYNI kuralları kullanır.
 *
 * Durum veritabanındadır (organization_setup); tarayıcı belleği kullanılmaz. Kurallar:
 *   • Satır yok (migration uygulanmamış ya da konsol dışı açılmış ofis) → eski davranış: akış yok, kilit yok
 *   • setup_completed + origin 'legacy' (migration'dan önce var olan ofis) → akış yok, kilit yok
 *   • setup_completed + origin 'onboarding' → akış yok, tasarım ailesi / tema ofis için KİLİTLİ
 *   • diğer durumlar → settings.manage yetkili kullanıcı /admin/kurulum'a yönlenir
 */

export const SETUP_STATES = ['setup_pending', 'theme_selection_pending', 'theme_selected', 'setup_completed', 'reopened_by_platform'] as const;
export type SetupState = (typeof SETUP_STATES)[number];
export type SetupOrigin = 'legacy' | 'onboarding';

export interface OrgSetup {
  state: SetupState;
  origin: SetupOrigin;
  /** Kalınan adım (0–4): devam edildiğinde buradan açılır */
  step: number;
  /** Aday ya da kurulumda seçilmiş aile */
  selectedFamily: string | null;
  completedAt: string | null;
  reopenedAt: string | null;
}

/** Kurulum adımları (sıra = adım numarası) */
export const SETUP_STEPS = [
  { key: 'welcome', label: 'Hoş geldiniz' },
  { key: 'office', label: 'Ofis bilgileri' },
  { key: 'design', label: 'Tasarım' },
  { key: 'preview', label: 'Önizleme' },
  { key: 'confirm', label: 'Tamamla' },
] as const;
export const LAST_SETUP_STEP = SETUP_STEPS.length - 1;

const FAMILY_ID = /^[a-z0-9-]{1,40}$/;

/** Veritabanı satırını güvenle çözer; bozuk / bilinmeyen değer → null (eski davranış, kimse akışa zorlanmaz) */
export function parseOrgSetup(raw: unknown): OrgSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const state = SETUP_STATES.find((s) => s === r.state);
  if (!state) return null;
  const origin: SetupOrigin = r.origin === 'legacy' ? 'legacy' : 'onboarding';
  const step = typeof r.step === 'number' && Number.isInteger(r.step) ? Math.min(Math.max(r.step, 0), LAST_SETUP_STEP) : 0;
  const family = typeof r.selected_family === 'string' && FAMILY_ID.test(r.selected_family) ? r.selected_family : null;
  return {
    state,
    origin,
    step,
    selectedFamily: family,
    completedAt: typeof r.completed_at === 'string' ? r.completed_at : null,
    reopenedAt: typeof r.reopened_at === 'string' ? r.reopened_at : null,
  };
}

/** Kurulum akışı açık mı (tamamlanmamış) */
export function setupRequired(setup: OrgSetup | null): boolean {
  return !!setup && setup.state !== 'setup_completed';
}

/** Kullanıcı ilk girişte kurulum akışına yönlenmeli mi: yalnız ayar yetkisi olan (sahip / yönetici) */
export function shouldRedirectToSetup(setup: OrgSetup | null, canManageSettings: boolean): boolean {
  return canManageSettings && setupRequired(setup);
}

/** Tasarım ailesi / tema ofis kullanıcıları için kilitli mi */
export function designLocked(setup: OrgSetup | null): boolean {
  return !!setup && setup.state === 'setup_completed' && setup.origin === 'onboarding';
}

/**
 * Kilit kapsamı (veritabanındaki site_configs_design_lock ile AYNI): yalnız tema (theme) ve tasarım ailesi
 * (style.origin.family). Renkler, yazı tipi, bileşen stilleri (style'ın diğer anahtarları), marka, metinler, menü vb. serbest.
 */
export const LOCKED_DESIGN_KEYS = ['theme', 'style.origin.family'] as const;

/** Bölüm yazımı kilitli değeri değiştirebilecek mi (yalnız bu bölümlerde mevcut değer okunur) */
export function sectionTouchesLockedKeys(section: string): boolean {
  return section === 'theme' || section === 'style';
}

export interface LockedDesignValues {
  draftTheme: string | null;
  publishedTheme: string | null;
  draftFamily: string | null;
  publishedFamily: string | null;
}

function familyOf(style: unknown): string | null {
  const origin = style && typeof style === 'object' ? (style as { origin?: unknown }).origin : null;
  const family = origin && typeof origin === 'object' ? (origin as { family?: unknown }).family : null;
  return typeof family === 'string' ? family : null;
}

/**
 * Bu yazım kilitli bir değeri YENİ bir değere çevirir mi. Veritabanıyla aynı kural: mevcut taslak ya da yayındaki
 * değerden biri yazılabilir (yayınla / taslağı geri al), başka bir tema / aile yazılamaz.
 */
export function isLockedDesignChange(section: string, value: unknown, current: LockedDesignValues): boolean {
  if (section === 'theme') {
    const theme = typeof value === 'string' ? value : null;
    return theme !== current.draftTheme && theme !== current.publishedTheme;
  }
  if (section === 'style') {
    const family = familyOf(value);
    return family !== current.draftFamily && family !== current.publishedFamily;
  }
  return false;
}

/** Akışın açılacağı adım: kaydedilmiş adım; tasarım adımı ve sonrası aday aile yoksa tasarım adımına döner */
export function resumeStep(setup: OrgSetup): number {
  if (setup.step > 2 && !setup.selectedFamily) return 2;
  return setup.step;
}

/** İlk açılışta seçili gelecek aile: aday (izinliyse) → sitenin mevcut ailesi (izinliyse) → ilk izinli */
export function initialFamily(allowed: readonly string[], candidate: string | null, current: string | null): string | null {
  if (candidate && allowed.includes(candidate)) return candidate;
  if (current && allowed.includes(current)) return current;
  return allowed[0] ?? null;
}

/** Konsolda gösterilen durum etiketi */
export const SETUP_STATE_LABELS: Record<SetupState, string> = {
  setup_pending: 'Kurulum bekliyor',
  theme_selection_pending: 'Tasarım seçimi bekliyor',
  theme_selected: 'Tasarım seçildi, onay bekliyor',
  setup_completed: 'Kurulum tamamlandı',
  reopened_by_platform: 'KARAYS tarafından yeniden açıldı',
};
