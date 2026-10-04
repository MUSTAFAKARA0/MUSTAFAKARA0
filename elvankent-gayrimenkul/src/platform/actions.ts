import { ZodError } from 'zod';

/**
 * Sunucu işlemlerinin (server action) standart dönüş tipi. Kullanıcıya her
 * zaman ne olduğunu, işlemin gerçekleşip gerçekleşmediğini ve tekrar
 * denenebilir olup olmadığını anlatan Türkçe bir mesaj döner.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export class ActionError extends Error {
  readonly code?: string;
  readonly fieldErrors?: Record<string, string[]>;
  constructor(message: string, code?: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthenticatedError extends ActionError {
  constructor() {
    super('Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.', 'unauthenticated');
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = 'Bu işlem için yetkiniz yok.') {
    super(message, 'forbidden');
  }
}

export class NotFoundError extends ActionError {
  constructor(message = 'Kayıt bulunamadı veya erişim yetkiniz yok.') {
    super(message, 'not_found');
  }
}

interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const CHECKLIST_LABELS: Record<string, string> = {
  title: 'başlık (en az 10 karakter)',
  description: 'açıklama (en az 50 karakter)',
  price: 'fiyat',
  location: 'il ve ilçe',
  photo: 'en az bir fotoğraf',
  body: 'içerik (en az 200 karakter)',
};

const DB_MESSAGES: Record<string, string> = {
  plan_limit_properties: 'Planınızın ilan limitine ulaşıldı. Yeni ilan için planınızı yükseltin veya eski ilanları silin.',
  plan_limit_users: 'Planınızın kullanıcı limitine ulaşıldı.',
  publish_forbidden: 'Bu ilanın yayın durumunu değiştirme yetkiniz yok. "Onaya gönder" seçeneğini kullanabilirsiniz.',
  delete_forbidden: 'Silme / geri yükleme yetkiniz yok.',
  settings_forbidden: 'Şirket ayarlarını değiştirme yetkiniz yok.',
  owner_required: 'Sahip (owner) rolüyle ilgili işlemleri yalnızca bir sahip yapabilir.',
  last_owner: 'Organizasyonun en az bir aktif sahibi olmalıdır.',
  cannot_modify_self: 'Kendi rolünüzü veya üyeliğinizi değiştiremezsiniz.',
  cross_tenant_reference: 'Seçilen kayıt bu organizasyona ait değil.',
  organization_immutable: 'Kaydın organizasyonu değiştirilemez.',
  rate_limited: 'Kısa sürede çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.',
  property_deleted: 'Bu ilan çöp kutusunda. Düzenlemek için önce geri yükleyin.',
  invalid_initial_status: 'Yeni ilan taslak olarak oluşturulur.',
  district_city_mismatch: 'Seçilen ilçe bu ile ait değil.',
  neighborhood_district_mismatch: 'Seçilen mahalle bu ilçeye ait değil.',
  not_found: 'Kayıt bulunamadı.',
  forbidden: 'Bu işlem için yetkiniz yok.',
  family_not_allowed: 'Bu tasarım ailesi siteniz için açık değil.',
  stale_draft: 'Bu taslak siz açtıktan sonra değiştirildi. Önce sayfayı yenileyip güncel taslağı inceleyin.',
  brand_requires_publish: 'Marka ve site bilgileri doğrudan değiştirilemez; taslağa kaydedip yayınlayın.',
};

export function mapDbError(error: DbErrorLike): string {
  const key = error.message ?? '';
  if (key === 'publish_checklist') {
    const missing = (error.details ?? '').split(',').filter(Boolean).map((k) => CHECKLIST_LABELS[k] ?? k);
    return missing.length
      ? `Yayınlamadan önce şu eksikleri tamamlayın: ${missing.join(', ')}.`
      : 'Yayınlamadan önce eksik alanları tamamlayın.';
  }
  if (DB_MESSAGES[key]) return DB_MESSAGES[key];
  if (error.hint && /[ğüşıöçĞÜŞİÖÇ]/.test(error.hint)) return error.hint;
  switch (error.code) {
    case '23505':
      return 'Bu değer zaten kullanılıyor. Lütfen farklı bir değer girin.';
    case '23503':
      return 'Seçilen ilişkili kayıt bulunamadı. Sayfayı yenileyip tekrar deneyin.';
    case '23514':
    case '22P02':
    case '22001':
      return 'Girilen değerlerden biri geçersiz veya çok uzun.';
    case '42501':
      return 'Bu işlem için yetkiniz yok.';
    case 'PGRST116':
      return 'Kayıt bulunamadı veya erişim yetkiniz yok.';
    default:
      return 'İşlem veritabanı tarafından reddedildi. Değişiklik kaydedilmedi; lütfen tekrar deneyin.';
  }
}

/** Hatayı kullanıcıya gösterilebilir sonuca çevirir. Ayrıntı yalnızca sunucu loguna yazılır. */
export function toActionFailure(error: unknown): { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> } {
  if (error instanceof ActionError) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, error: 'Lütfen işaretli alanları kontrol edin.', code: 'validation', fieldErrors };
  }
  if (error && typeof error === 'object' && 'message' in error && ('code' in error || 'details' in error)) {
    const e = error as DbErrorLike;
    console.warn('[action] db error', { code: e.code, message: e.message });
    return { ok: false, error: mapDbError(e), code: e.message };
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return { ok: false, error: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.', code: 'network' };
  }
  // Next.js yönlendirme/404 istisnaları yeniden fırlatılmalı
  if (error && typeof error === 'object' && 'digest' in error && typeof (error as { digest: unknown }).digest === 'string') {
    const digest = (error as { digest: string }).digest;
    if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')) throw error;
  }
  console.error('[action] unexpected error', error);
  return { ok: false, error: 'Beklenmeyen bir hata oluştu. İşlem tamamlanmadı; lütfen tekrar deneyin.', code: 'unexpected' };
}

/** Veritabanı hatasını ActionError olarak fırlatır (akışı kesmek için). */
export function assertNoDbError(error: DbErrorLike | null | undefined): void {
  if (error) throw Object.assign(new ActionError(mapDbError(error), error.message), { cause: error });
}

export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (error) {
    return toActionFailure(error);
  }
}
