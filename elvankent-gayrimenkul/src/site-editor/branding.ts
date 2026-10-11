import 'server-only';
import { randomBytes } from 'node:crypto';
import { ActionError } from '@/platform/actions';
import type { SessionUser } from '@/platform/auth/session';
import { BRANDING_COLUMN, BRANDING_LABEL, processBranding, type BrandingKind } from '@/modules/media/branding';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import { saveBrandFields, type DraftToken } from '@/site-editor/service';

/**
 * MARKA GÖRSELİ TASLAĞI (logo, mobil logo, site simgesi, ana sayfa ve paylaşım görseli) — KARAY ve
 * ofis ortak.
 *
 * Yaşam döngüsü:
 *   1) dosya sunucuda doğrulanır ve yeniden kodlanır (processBranding; SVG güvenlik denetimi)
 *   2) mevcut "branding" kovasına YENİ, tahmin edilemez bir yola yüklenir
 *      (organizations/{org}/branding/{tür}-{16 hex}-{en}x{boy}.{uzantı})
 *   3) yol TASLAĞA yazılır (saveBrandFields → site_configs.draft.brand); canlı site eski görseli
 *      göstermeye devam eder, önizleme yenisini gösterir
 *   4) yayında organization_settings'e geçer (site_apply_brand); geri almada eski yol geri gelir
 *   5) ESKİ DOSYA SİLİNMEZ: canlı site ve sürüm geçmişi ona başvurabilir (kaybolmaz). Kullanılmayan
 *      dosyaların temizliği ayrı bir bakım işidir (teknik borç).
 *
 * Kova herkese açıktır (canlı sitede görseller oturumsuz okunur); taslak dosyanın adresi rastgele
 * ve bağlantı verilmeden bulunamaz. Taslağa yazma reddedilirse (yetki, eski taslak) yüklenen dosya
 * hemen silinir.
 */
type Db = SessionUser['supabase'];
type Storage = Pick<Db, 'storage'>;

/** Taslakla yönetilen marka görselleri (P0.3: paylaşım görseli de taslakta; tüm türler) */
export const DRAFT_BRANDING_KINDS: readonly BrandingKind[] = ['logo', 'logo_mobile', 'favicon', 'hero', 'og'];

export async function uploadBrandingDraft(opts: {
  db: Db;
  storage: Storage;
  orgId: string;
  kind: BrandingKind;
  input: Buffer;
  expected?: DraftToken;
}): Promise<{ path: string; message: string }> {
  const { db, storage, orgId, kind, input } = opts;
  if (!DRAFT_BRANDING_KINDS.includes(kind)) throw new ActionError('Geçersiz görsel türü.');
  const output = await processBranding(kind, input);
  const path = `organizations/${orgId}/branding/${kind}-${randomBytes(8).toString('hex')}-${output.width}x${output.height}.${output.ext}`;
  const { error: uploadError } = await storage.storage
    .from(MEDIA_BUCKETS.branding)
    .upload(path, output.buffer, { contentType: output.contentType, cacheControl: '31536000', upsert: false });
  if (uploadError) throw new ActionError('Görsel kaydedilemedi. Lütfen tekrar deneyin.');
  try {
    await saveBrandFields(db, orgId, { [BRANDING_COLUMN[kind]]: path }, opts.expected);
  } catch (e) {
    await storage.storage.from(MEDIA_BUCKETS.branding).remove([path]);
    throw e;
  }
  return { path, message: `${BRANDING_LABEL[kind]} taslağa kaydedildi. Sitede görünmesi için yayınlayın.` };
}

/** Görseli taslakta kaldırır (dosya silinmez; canlı site yayına kadar eskisini gösterir) */
export async function removeBrandingDraft(db: Db, orgId: string, kind: BrandingKind): Promise<string> {
  if (!DRAFT_BRANDING_KINDS.includes(kind)) throw new ActionError('Geçersiz görsel türü.');
  await saveBrandFields(db, orgId, { [BRANDING_COLUMN[kind]]: null });
  return `${BRANDING_LABEL[kind]} taslakta kaldırıldı. Sitede yayınlayınca kalkar.`;
}
