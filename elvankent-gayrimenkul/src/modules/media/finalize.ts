import type { DB } from '@/lib/supabase/server';

/**
 * Medya sonlandırma RPC sarmalayıcıları (WP-A2, TASARIM §2, §8, §9).
 * Bu dosya saftır (sunucuya özgü bağımlılık yok) → birim testlerinde doğrudan içe aktarılır.
 */

export interface RpcErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface FinalizeArgs {
  mediaId: string;
  /** Satırın şu anki public_base değeri (iyimser eşzamanlılık denetimi) */
  expectedBase: string | null;
  publicBase: string;
  widths: number[];
  width: number;
  height: number;
  /** processImage bazen null döndürür; RPC null kabul etmelidir */
  blur: string | null;
}

export interface FinalizeResult {
  previous_base: string | null;
  previous_widths: number[];
  byte_size: number | null;
  variants_byte_size: number | null;
}

/** RPC yok algısı: YALNIZ PGRST202 + mesajda tam fonksiyon adı. 42883 asla "yok" sayılmaz. */
export function isMissingRpc(err: RpcErrorLike | null | undefined, fnName: string): boolean {
  return err?.code === 'PGRST202' && new RegExp('\\b' + fnName + '\\b').test(err.message ?? '');
}

export type FinalizeErrorKind = 'missing' | 'quota' | 'conflict' | 'structured' | 'unknown';

export function classifyFinalizeError(err: RpcErrorLike | null | undefined, fnName = 'media_finalize'): FinalizeErrorKind {
  if (isMissingRpc(err, fnName)) return 'missing';
  const message = err?.message ?? '';
  if (message === 'plan_limit_storage') return 'quota';
  // media_busy (55P03, kilit 5 sn içinde alınamadı): satır değişmedi, yeniden denenebilir → çakışmayla aynı güvenli yol
  if (message === 'media_conflict' || message === 'media_busy') return 'conflict';
  // Yapılandırılmış SQLSTATE / PGRST kodu → işlem açıkça reddedildi. Kodsuz (ağ, zaman aşımı) → belirsiz.
  if (typeof err?.code === 'string' && err.code.length > 0) return 'structured';
  return 'unknown';
}

export interface FinalizeDecisionInput {
  kind: FinalizeErrorKind;
  rowStatus: 'pending' | 'ready' | 'failed';
  /** Hatadan sonra yeniden okunan satırın public_base'i; `undefined` = satır okunamadı */
  rowPublicBase: string | null | undefined;
  newBase: string;
}

export interface FinalizeDecision {
  /** Belirsiz sonuç satırın yeni tabanı taşıdığını gösteriyor → başarı say */
  treatAsSuccess: boolean;
  /** Eski veritabanı: bugünkü yedek güncelleme yolunu çalıştır */
  useLegacy: boolean;
  removeNewVariants: boolean;
  markFailed: boolean;
  /** Orijinal dosya bu yoldan ASLA silinmez (KI-36); alan sözleşmeyi açıkça test etmek için vardır */
  removeOriginal: false;
  throwCode: 'quota' | 'conflict' | 'finalize' | null;
  /** markFailed için hata kodu etiketi */
  failedReason: 'quota' | 'finalize' | null;
}

/**
 * Sonlandırma hatasından sonra ne yapılacağı. Kurallar:
 *  - `ready` satır asla failed yapılmaz, orijinal asla silinmez.
 *  - Yeni varyantlar yalnız satırın yeni tabanı göstermediği KESİN olduğunda silinir.
 *  - conflict: yalnız kendi varyantlarımız silinir, satıra dokunulmaz.
 */
export function decideAfterFinalizeError(input: FinalizeDecisionInput): FinalizeDecision {
  const { kind, rowStatus, rowPublicBase, newBase } = input;
  const base: FinalizeDecision = {
    treatAsSuccess: false,
    useLegacy: false,
    removeNewVariants: false,
    markFailed: false,
    removeOriginal: false,
    throwCode: null,
    failedReason: null,
  };
  const notReady = rowStatus !== 'ready';
  switch (kind) {
    case 'missing':
      return { ...base, useLegacy: true };
    case 'quota':
      return { ...base, removeNewVariants: true, markFailed: notReady, failedReason: notReady ? 'quota' : null, throwCode: 'quota' };
    case 'conflict':
      return { ...base, removeNewVariants: true, throwCode: 'conflict' };
    case 'structured':
      return { ...base, removeNewVariants: true, markFailed: notReady, failedReason: notReady ? 'finalize' : null, throwCode: 'finalize' };
    case 'unknown':
      if (rowPublicBase === newBase) return { ...base, treatAsSuccess: true };
      // Satır okunamadıysa (undefined) sonuç belirsiz kalır: dosyalar silinmez (kayıp riski > sızıntı riski)
      return {
        ...base,
        removeNewVariants: rowPublicBase !== undefined,
        markFailed: notReady && rowPublicBase !== undefined,
        failedReason: notReady && rowPublicBase !== undefined ? 'finalize' : null,
        throwCode: 'finalize',
      };
  }
}

export async function finalizeMedia(supabase: DB, args: FinalizeArgs) {
  const { data, error } = await supabase.rpc('media_finalize', {
    p_media: args.mediaId,
    p_expected_base: args.expectedBase as string,
    p_public_base: args.publicBase,
    p_variant_widths: args.widths,
    p_width: args.width,
    p_height: args.height,
    p_blur: args.blur as string,
  });
  return { data: error ? null : parseFinalizeResult(data), error };
}

export function parseFinalizeResult(raw: unknown): FinalizeResult {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const widths = Array.isArray(o.previous_widths) ? o.previous_widths.filter((w): w is number => typeof w === 'number') : [];
  return {
    previous_base: typeof o.previous_base === 'string' ? o.previous_base : null,
    previous_widths: widths,
    byte_size: typeof o.byte_size === 'number' ? o.byte_size : null,
    variants_byte_size: typeof o.variants_byte_size === 'number' ? o.variants_byte_size : null,
  };
}

/** `ready` olmayan satırı failed yapar. `ready` satırda false döner (hata değildir). */
export async function markMediaFailed(supabase: DB, id: string, error: string): Promise<{ marked: boolean; error: RpcErrorLike | null }> {
  const { data, error: rpcError } = await supabase.rpc('media_mark_failed', { p_media: id, p_error: error.slice(0, 300) });
  return { marked: rpcError ? false : data === true, error: rpcError };
}
