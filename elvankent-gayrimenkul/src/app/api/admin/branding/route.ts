import { randomBytes } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { cacheTags } from '@/lib/cache-tags';
import { isSameOrigin } from '@/lib/same-origin';
import { createServiceClient } from '@/lib/supabase/server';
import {
  BRANDING_COLUMN,
  BRANDING_KINDS,
  BRANDING_LABEL,
  BRANDING_MAX_INPUT_BYTES,
  BRANDING_PERMISSION,
  BrandingError,
  isOwnBrandingPath,
  processBranding,
  type BrandingKind,
} from '@/modules/media/branding';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import { mapDbError } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { getOrgContext } from '@/platform/auth/session';
import type { TablesUpdate } from '@/types/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Marka görseli yükleme (logo, site simgesi, ana sayfa ve paylaşım görseli).
 * Yetki sunucuda doğrulanır; organizasyon istemciden alınmaz. Dosya yolu
 * kullanıcı girdisi içermez. Ayar satırı oturum istemcisiyle güncellenir
 * (RLS + organization_settings_guard ikinci kez doğrular).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Geçersiz istek kaynağı.' }, 403);
  const ctx = await getOrgContext();
  if (!ctx) return json({ error: 'Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.' }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Dosya okunamadı. Lütfen tekrar deneyin.' }, 400);
  }
  const kind = String(form.get('kind') ?? '') as BrandingKind;
  if (!BRANDING_KINDS.includes(kind)) return json({ error: 'Geçersiz görsel türü.' }, 400);
  const permission = BRANDING_PERMISSION[kind];
  if (!ctx.can(permission)) {
    await logSecurityEvent({ orgId: ctx.org.id, action: 'auth.forbidden', actorId: ctx.user.id, metadata: { permission, area: 'branding' } });
    return json({ error: 'Bu işlem için yetkiniz yok.' }, 403);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Dosya seçilmedi.' }, 400);
  if (file.size > BRANDING_MAX_INPUT_BYTES) return json({ error: 'Dosya çok büyük (en fazla 15 MB).' }, 413);

  let output;
  try {
    output = await processBranding(kind, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof BrandingError) return json({ error: error.message }, 400);
    console.error('[branding] processing failed', { kind });
    return json({ error: 'Görsel işlenemedi. Lütfen farklı bir dosya deneyin.' }, 400);
  }

  // Depolama: ayar yetkisi varsa oturum istemcisi (Storage RLS), yalnızca SEO
  // yetkisiyle paylaşım görseli yükleniyorsa sunucu istemcisi (yetki yukarıda doğrulandı)
  const storageClient = ctx.can('settings.manage') ? ctx.supabase : createServiceClient();
  if (!storageClient) return json({ error: 'Depolama yapılandırılmamış.' }, 503);
  const path = `organizations/${ctx.org.id}/branding/${kind}-${randomBytes(8).toString('hex')}.${output.ext}`;
  const { error: uploadError } = await storageClient.storage
    .from(MEDIA_BUCKETS.branding)
    .upload(path, output.buffer, { contentType: output.contentType, cacheControl: '31536000', upsert: false });
  if (uploadError) {
    console.warn('[branding] upload failed', { kind });
    return json({ error: 'Görsel kaydedilemedi. Lütfen tekrar deneyin.' }, 502);
  }

  const column = BRANDING_COLUMN[kind];
  const { data: before } = await ctx.supabase.from('organization_settings').select(column).eq('organization_id', ctx.org.id).maybeSingle();
  const { data: updated, error } = await ctx.supabase
    .from('organization_settings')
    .update({ [column]: path } as TablesUpdate<'organization_settings'>)
    .eq('organization_id', ctx.org.id)
    .select('organization_id');
  if (error || !updated?.length) {
    await storageClient.storage.from(MEDIA_BUCKETS.branding).remove([path]);
    return json({ error: error ? mapDbError(error) : 'Ayarlar bulunamadı.' }, error?.code === '42501' ? 403 : 500);
  }

  // Önceki dosya (yalnızca bu organizasyonun marka klasöründeyse) silinir
  const previous = (before as Record<string, string | null> | null)?.[column];
  if (isOwnBrandingPath(ctx.org.id, previous) && previous !== path) {
    await storageClient.storage.from(MEDIA_BUCKETS.branding).remove([previous]);
  }
  revalidateTag(cacheTags.org(ctx.org.id), { expire: 0 });
  return json({ path, width: output.width, height: output.height, message: `${BRANDING_LABEL[kind]} güncellendi.` }, 201);
}
