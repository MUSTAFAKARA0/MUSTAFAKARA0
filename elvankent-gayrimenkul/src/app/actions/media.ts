'use server';

import { randomUUID } from 'node:crypto';
import { updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { MediaValidationError, processImage } from '@/modules/media/processing';
import {
  ADMIN_MEDIA_FIELDS,
  contentOriginalPath,
  newPublicBase,
  normalizeFileName,
  originalPath,
  removeMediaFiles,
  rotationOf,
  variantPaths,
  type AdminMedia,
  type Rotation,
} from '@/modules/media/server';
import { MEDIA_BUCKETS, MEDIA_LIMITS } from '@/modules/media/variants';
import { ActionError, assertNoDbError, NotFoundError, runAction, type ActionResult } from '@/platform/actions';
import { requirePermission, type OrgContext } from '@/platform/auth/session';

/** Bu boyutun üzerindeki dosyalar TUS (devam ettirilebilir) protokolüyle yüklenir */
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;

export interface UploadTicket {
  mediaId: string;
  bucket: string;
  path: string;
  token: string;
  resumable: boolean;
}

const createSchema = z.object({
  propertyId: z.uuid({ error: 'Geçersiz ilan.' }),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif'], {
    error: 'Bu dosya desteklenmeyen bir formatta. JPG, PNG, WEBP veya AVIF yükleyin.',
  }),
  size: z
    .number()
    .int()
    .positive({ error: 'Dosya boş görünüyor.' })
    .max(MEDIA_LIMITS.maxOriginalBytes, { error: 'Bu görselin boyutu çok yüksek (en fazla 50 MB).' }),
  replaceId: z.uuid().optional(),
});

async function loadProperty(ctx: OrgContext, propertyId: string) {
  const { data, error } = await ctx.supabase
    .from('properties')
    .select('id, organization_id, deleted_at, title')
    .eq('id', propertyId)
    .maybeSingle();
  assertNoDbError(error);
  // Organizasyon, istemciden gelen değere göre değil kullanıcının aktif üyeliğine göre doğrulanır
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError('İlan bulunamadı veya erişim yetkiniz yok.');
  if (data.deleted_at) throw new ActionError('Çöp kutusundaki ilanın fotoğrafları değiştirilemez. Önce ilanı geri yükleyin.');
  return data;
}

async function loadMedia(ctx: OrgContext, mediaId: string) {
  if (!z.uuid().safeParse(mediaId).success) throw new NotFoundError('Fotoğraf bulunamadı.');
  const { data, error } = await ctx.supabase
    .from('media_assets')
    .select(`${ADMIN_MEDIA_FIELDS}, organization_id, original_path`)
    .eq('id', mediaId)
    .maybeSingle();
  assertNoDbError(error);
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError('Fotoğraf bulunamadı veya erişim yetkiniz yok.');
  return data as AdminMedia & { organization_id: string; original_path: string | null };
}

/** İlan fotoğrafları ve içerik görselleri (blog kapağı) aynı işlemlerle yönetilir */
function invalidate(orgId: string) {
  updateTag(cacheTags.properties(orgId));
  updateTag(cacheTags.content(orgId));
}

/**
 * 1. adım: yükleme bileti. Kayıt "pending" olarak oluşturulur ve orijinal dosya
 * için kısa süreli (2 saat) imzalı yükleme adresi verilir. Dosya tarayıcıdan
 * doğrudan Supabase Storage'a gider (sunucu bant genişliği/limitleri aşılmaz).
 */
export async function createMediaUpload(raw: z.input<typeof createSchema>): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const input = createSchema.parse(raw);
    const ctx = await requirePermission('media.manage');
    const property = await loadProperty(ctx, input.propertyId);

    if (input.replaceId) {
      const target = await loadMedia(ctx, input.replaceId);
      if (target.property_id !== property.id) throw new NotFoundError('Değiştirilecek fotoğraf bu ilana ait değil.');
    } else {
      const { count, error } = await ctx.supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', property.id)
        .in('status', ['pending', 'ready']);
      assertNoDbError(error);
      if ((count ?? 0) >= MEDIA_LIMITS.maxImagesPerProperty) {
        throw new ActionError(`Bir ilana en fazla ${MEDIA_LIMITS.maxImagesPerProperty} fotoğraf eklenebilir.`, 'limit');
      }
    }

    const { data: allowed, error: quotaError } = await ctx.supabase.rpc('media_upload_allowed', { p_org: ctx.org.id, p_bytes: input.size });
    assertNoDbError(quotaError);
    if (!allowed) {
      throw new ActionError('Depolama alanı kotanız doldu. Kullanılmayan fotoğrafları silin veya planınızı yükseltin.', 'quota');
    }

    const { data: last } = await ctx.supabase
      .from('media_assets')
      .select('sort_order')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const mediaId = randomUUID();
    const path = originalPath(ctx.org.id, property.id, mediaId);
    const { error: insertError } = await ctx.supabase.from('media_assets').insert({
      id: mediaId,
      organization_id: ctx.org.id,
      property_id: property.id,
      kind: 'property_photo',
      status: 'pending',
      original_path: path,
      mime_type: input.mimeType,
      byte_size: input.size,
      original_filename: normalizeFileName(input.fileName),
      created_by: ctx.user.id,
      sort_order: (last?.sort_order ?? -1) + 1,
    });
    assertNoDbError(insertError);

    // Oturum istemcisi: Storage RLS (organizations/{org}/...) ayrıca doğrulanır
    const { data: signed, error: signError } = await ctx.supabase.storage.from(MEDIA_BUCKETS.originals).createSignedUploadUrl(path);
    if (signError || !signed) {
      await ctx.supabase.from('media_assets').delete().eq('id', mediaId);
      throw new ActionError('Yükleme başlatılamadı. Lütfen tekrar deneyin.', 'upload_init');
    }
    return { mediaId, bucket: MEDIA_BUCKETS.originals, path, token: signed.token, resumable: input.size > RESUMABLE_THRESHOLD };
  });
}

const contentSchema = createSchema.pick({ fileName: true, mimeType: true, size: true });

/** İçerik görseli (blog kapağı vb.) için yükleme bileti — ilana bağlı değildir */
export async function createContentMediaUpload(raw: z.input<typeof contentSchema>): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const input = contentSchema.parse(raw);
    const ctx = await requirePermission('media.manage');
    const { data: allowed, error: quotaError } = await ctx.supabase.rpc('media_upload_allowed', { p_org: ctx.org.id, p_bytes: input.size });
    assertNoDbError(quotaError);
    if (!allowed) throw new ActionError('Depolama alanı kotanız doldu. Kullanılmayan görselleri silin veya planınızı yükseltin.', 'quota');
    const mediaId = randomUUID();
    const path = contentOriginalPath(ctx.org.id, mediaId);
    const { error } = await ctx.supabase.from('media_assets').insert({
      id: mediaId,
      organization_id: ctx.org.id,
      property_id: null,
      kind: 'post_cover',
      status: 'pending',
      original_path: path,
      mime_type: input.mimeType,
      byte_size: input.size,
      original_filename: normalizeFileName(input.fileName),
      created_by: ctx.user.id,
    });
    assertNoDbError(error);
    const { data: signed, error: signError } = await ctx.supabase.storage.from(MEDIA_BUCKETS.originals).createSignedUploadUrl(path);
    if (signError || !signed) {
      await ctx.supabase.from('media_assets').delete().eq('id', mediaId);
      throw new ActionError('Yükleme başlatılamadı. Lütfen tekrar deneyin.', 'upload_init');
    }
    return { mediaId, bucket: MEDIA_BUCKETS.originals, path, token: signed.token, resumable: input.size > RESUMABLE_THRESHOLD };
  });
}

/** Süresi dolan / kesilen yükleme için aynı kayda yeni imzalı adres (tekrar dene) */
export async function renewMediaUpload(mediaId: string): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    if (media.status !== 'pending' || !media.original_path) throw new ActionError('Bu fotoğraf için yükleme beklenmiyor.');
    const { data: signed, error } = await ctx.supabase.storage
      .from(MEDIA_BUCKETS.originals)
      .createSignedUploadUrl(media.original_path, { upsert: true });
    if (error || !signed) throw new ActionError('Yükleme yeniden başlatılamadı. Lütfen tekrar deneyin.', 'upload_init');
    return {
      mediaId,
      bucket: MEDIA_BUCKETS.originals,
      path: media.original_path,
      token: signed.token,
      resumable: (media.byte_size ?? 0) > RESUMABLE_THRESHOLD,
    };
  });
}

async function markFailed(ctx: OrgContext, mediaId: string, message: string) {
  await ctx.supabase.from('media_assets').update({ status: 'failed', error: message.slice(0, 300) }).eq('id', mediaId);
}

/**
 * 2. adım: yükleme tamamlanınca orijinal dosya indirilir, GERÇEK türü doğrulanır
 * ve WebP varyantları üretilip herkese açık kovaya yazılır. Başarısız olursa kayıt
 * "failed" olur (tekrar denenebilir); geçersiz dosyada orijinal hemen silinir.
 */
async function processMedia(ctx: OrgContext, media: AdminMedia & { original_path: string | null }, rotate: Rotation = 0) {
  if (!media.original_path) throw new ActionError('Fotoğrafın orijinal dosyası bulunamadı.');

  const { data: blob, error: downloadError } = await ctx.supabase.storage.from(MEDIA_BUCKETS.originals).download(media.original_path);
  if (downloadError || !blob) {
    await markFailed(ctx, media.id, 'Orijinal dosya depolamada bulunamadı; yükleme tamamlanmamış olabilir.');
    throw new ActionError('Dosya yüklemesi tamamlanmamış görünüyor. "Tekrar dene" ile yeniden yükleyin.', 'not_uploaded');
  }
  const input = Buffer.from(await blob.arrayBuffer());
  if (input.length > MEDIA_LIMITS.maxOriginalBytes) {
    await ctx.supabase.storage.from(MEDIA_BUCKETS.originals).remove([media.original_path]);
    await markFailed(ctx, media.id, 'Dosya 50 MB sınırını aşıyor.');
    throw new ActionError('Bu görselin boyutu çok yüksek (en fazla 50 MB).', 'too_large');
  }

  let processed;
  try {
    processed = await processImage(input, rotate);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      await ctx.supabase.storage.from(MEDIA_BUCKETS.originals).remove([media.original_path]);
      await markFailed(ctx, media.id, error.message);
      throw new ActionError(error.message, error.code);
    }
    console.error('[media] processing failed', { mediaId: media.id });
    await markFailed(ctx, media.id, 'Görsel işlenemedi.');
    throw new ActionError('Görsel işlenirken bir sorun oluştu. Lütfen tekrar deneyin.', 'processing');
  }

  const publicBase = newPublicBase(media.original_path, rotate);
  const uploads = await Promise.all(
    processed.variants.map(({ width, buffer }) =>
      ctx.supabase.storage.from(MEDIA_BUCKETS.public).upload(`${publicBase}/w${width}.webp`, buffer, {
        contentType: 'image/webp',
        // Yol her işlemede değiştiği için dosyalar değişmez → uzun süreli önbellek
        cacheControl: '31536000',
        upsert: false,
      }),
    ),
  );
  const widths = processed.variants.map((v) => v.width);
  if (uploads.some((u) => u.error)) {
    await ctx.supabase.storage.from(MEDIA_BUCKETS.public).remove(variantPaths(publicBase, widths));
    await markFailed(ctx, media.id, 'Varyantlar depolamaya yazılamadı.');
    throw new ActionError('Fotoğraf kaydedilemedi. Lütfen tekrar deneyin.', 'storage');
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('media_assets')
    .update({
      status: 'ready',
      public_base: publicBase,
      variant_widths: widths,
      width: processed.width,
      height: processed.height,
      blur_data_url: processed.blurDataUrl,
      variants_byte_size: processed.variantsBytes,
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', media.id)
    .select(ADMIN_MEDIA_FIELDS)
    .single();
  if (updateError || !updated) {
    await ctx.supabase.storage.from(MEDIA_BUCKETS.public).remove(variantPaths(publicBase, widths));
    assertNoDbError(updateError);
    throw new ActionError('Fotoğraf kaydedilemedi. Lütfen tekrar deneyin.');
  }

  // Önceki sürümün varyantları (döndürme / yeniden işleme)
  if (media.public_base && media.public_base !== publicBase && !media.public_base.startsWith('/')) {
    await ctx.supabase.storage.from(MEDIA_BUCKETS.public).remove(variantPaths(media.public_base, media.variant_widths ?? []));
  }
  // Kapak ataması AFTER tetikleyicisiyle yapıldığından güncel satır yeniden okunur
  const { data: fresh } = await ctx.supabase.from('media_assets').select(ADMIN_MEDIA_FIELDS).eq('id', media.id).maybeSingle();
  return (fresh ?? updated) as unknown as AdminMedia;
}

export async function finalizeMediaUpload(input: { mediaId: string; replaceId?: string }): Promise<ActionResult<AdminMedia>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, input.mediaId);
    if (media.status === 'ready') return media;
    let result = await processMedia(ctx, media);

    // "Fotoğrafı değiştir": yeni dosya eskisinin sırasını, kapak durumunu ve açıklamasını devralır
    if (input.replaceId && input.replaceId !== media.id) {
      const old = await loadMedia(ctx, input.replaceId);
      if (old.property_id === media.property_id) {
        const { error: deleteError } = await ctx.supabase.from('media_assets').delete().eq('id', old.id);
        assertNoDbError(deleteError);
        await removeMediaFiles(ctx.supabase, old);
        const { data: moved, error: moveError } = await ctx.supabase
          .from('media_assets')
          .update({ sort_order: old.sort_order, alt_text: old.alt_text })
          .eq('id', media.id)
          .select(ADMIN_MEDIA_FIELDS)
          .single();
        assertNoDbError(moveError);
        if (old.is_cover) await ctx.supabase.rpc('set_property_cover', { p_media_id: media.id });
        result = { ...(moved as unknown as AdminMedia), is_cover: old.is_cover || result.is_cover };
      }
    }
    invalidate(ctx.org.id);
    return result;
  });
}

/** Başarısız işlemeyi (dosya yüklüyse) yeniden dener */
export async function retryMediaProcessing(mediaId: string): Promise<ActionResult<AdminMedia>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    if (media.status === 'ready') return media;
    await ctx.supabase.from('media_assets').update({ status: 'pending', error: null }).eq('id', media.id);
    const result = await processMedia(ctx, media, rotationOf(media.public_base));
    invalidate(ctx.org.id);
    return result;
  });
}

/** Yüklemeyi iptal eder: bekleyen kayıt ve (varsa) yarım dosya silinir */
export async function cancelMediaUpload(mediaId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    if (media.status === 'ready') throw new ActionError('Tamamlanmış yükleme iptal edilemez; fotoğrafı silebilirsiniz.');
    await removeMediaFiles(ctx.supabase, media);
    const { error } = await ctx.supabase.from('media_assets').delete().eq('id', media.id);
    assertNoDbError(error);
    return null;
  });
}

/**
 * Fotoğrafı siler. Önce kayıt silinir (ilan sayfasından anında kalkar), sonra
 * dosyalar. Dosya silme başarısız olursa yollar denetim kaydında kalır ve
 * zamanlanmış temizlik tarafından yeniden denenir.
 */
export async function deleteMedia(mediaId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    const { error } = await ctx.supabase.from('media_assets').delete().eq('id', media.id);
    assertNoDbError(error);
    const removed = await removeMediaFiles(ctx.supabase, media);
    if (!removed.ok) console.warn('[media] file removal deferred to cleanup', { mediaId: media.id });
    invalidate(ctx.org.id);
    return null;
  }, 'Fotoğraf silindi.');
}

export async function rotateMedia(mediaId: string, direction: 'left' | 'right'): Promise<ActionResult<AdminMedia>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    if (media.status !== 'ready') throw new ActionError('Yalnızca hazır fotoğraflar döndürülebilir.');
    if (!media.original_path) throw new ActionError('Bu fotoğrafın orijinali olmadığı için döndürülemiyor.');
    // Orijinal dosyaya dokunulmaz; varyantlar orijinalden yeni açıyla yeniden üretilir (kalite kaybı yok)
    const next = ((rotationOf(media.public_base) + (direction === 'right' ? 90 : 270)) % 360) as Rotation;
    const result = await processMedia(ctx, media, next);
    invalidate(ctx.org.id);
    return result;
  });
}

const altSchema = z.string().trim().max(200, { error: 'Açıklama en fazla 200 karakter olabilir.' });

export async function updateMediaAlt(mediaId: string, altText: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    const media = await loadMedia(ctx, mediaId);
    const value = altSchema.parse(altText).replace(/[<>]/g, '');
    const { error } = await ctx.supabase.from('media_assets').update({ alt_text: value || null }).eq('id', media.id);
    assertNoDbError(error);
    invalidate(ctx.org.id);
    return null;
  }, 'Açıklama kaydedildi.');
}

export async function setMediaCover(mediaId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    await loadMedia(ctx, mediaId);
    const { error } = await ctx.supabase.rpc('set_property_cover', { p_media_id: mediaId });
    assertNoDbError(error);
    invalidate(ctx.org.id);
    return null;
  }, 'Kapak fotoğrafı güncellendi.');
}

export async function reorderMedia(propertyId: string, ids: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await requirePermission('media.manage');
    await loadProperty(ctx, propertyId);
    const parsed = z.array(z.uuid()).max(MEDIA_LIMITS.maxImagesPerProperty).parse(ids);
    const { error } = await ctx.supabase.rpc('reorder_property_media', { p_property_id: propertyId, p_ids: parsed });
    assertNoDbError(error);
    invalidate(ctx.org.id);
    return null;
  });
}

/** İlanın fotoğrafları (yönetim paneli; tüm durumlar) */
export async function listPropertyMedia(propertyId: string): Promise<ActionResult<AdminMedia[]>> {
  return runAction(async () => {
    const ctx = await requirePermission('properties.read');
    if (!z.uuid().safeParse(propertyId).success) throw new NotFoundError();
    const { data, error } = await ctx.supabase
      .from('media_assets')
      .select(ADMIN_MEDIA_FIELDS)
      .eq('property_id', propertyId)
      .eq('organization_id', ctx.org.id)
      .order('sort_order')
      .order('created_at');
    assertNoDbError(error);
    return (data ?? []) as unknown as AdminMedia[];
  });
}
