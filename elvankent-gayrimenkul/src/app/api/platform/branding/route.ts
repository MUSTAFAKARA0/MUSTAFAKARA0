import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';
import {
  BRANDING_COLUMN,
  BRANDING_KINDS,
  BRANDING_LABEL,
  BRANDING_MAX_INPUT_BYTES,
  BrandingError,
  processBranding,
  type BrandingKind,
} from '@/modules/media/branding';
import { MEDIA_BUCKETS } from '@/modules/media/variants';
import { logSecurityEvent } from '@/platform/audit';
import { requireSuperAdmin } from '@/platform/auth/session';
import { parseSiteConfig } from '@/site-config/schema';
import type { Json } from '@/types/supabase';

type SessionDb = Awaited<ReturnType<typeof requireSuperAdmin>>['supabase'];

export const runtime = 'nodejs';
export const maxDuration = 30;

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * KARAY Web Sitesi Yönetimi › Marka: süper admin bir kiracının logo / mobil logo / site
 * simgesi / paylaşım / ana sayfa görselini yükler. Yetki: platform oturumu + süper admin
 * (requireSuperAdmin). Dosya sunucuda doğrulanıp yeniden kodlanır; yol kullanıcı girdisi
 * içermez. Görsel TASLAĞA yazılır (site_configs.draft.brand): canlı site yayınlanınca
 * değişir, önizlemede hemen görünür. Eski dosya silinmez (sürüm geçmişi ona başvurabilir).
 */

/** Taslaktaki marka alanını günceller (süper admin oturumuyla; site_save_draft yetkiyi tekrar doğrular) */
async function setDraftBrandField(db: SessionDb, orgId: string, column: string, value: string | null) {
  const { data } = await db.from('site_configs').select('draft').eq('organization_id', orgId).maybeSingle();
  const brand = { ...parseSiteConfig(data?.draft).brand, [column]: value };
  return db.rpc('site_save_draft', { p_org: orgId, p_section: 'brand', p_value: brand as Json });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Geçersiz istek kaynağı.' }, 403);
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return json({ error: 'Bu işlem için platform yöneticisi oturumu gerekir.' }, 403);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Dosya okunamadı. Lütfen tekrar deneyin.' }, 400);
  }
  const orgId = String(form.get('orgId') ?? '');
  const kind = String(form.get('kind') ?? '') as BrandingKind;
  if (!isUuid(orgId)) return json({ error: 'Geçersiz site.' }, 400);
  if (!BRANDING_KINDS.includes(kind)) return json({ error: 'Geçersiz görsel türü.' }, 400);
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Dosya seçilmedi.' }, 400);
  if (file.size > BRANDING_MAX_INPUT_BYTES) return json({ error: 'Dosya çok büyük (en fazla 15 MB).' }, 413);

  const service = createServiceClient();
  if (!service) return json({ error: 'Depolama yapılandırılmamış.' }, 503);
  const column = BRANDING_COLUMN[kind];
  const { data: before } = await service.from('organization_settings').select(column).eq('organization_id', orgId).maybeSingle();
  if (!before) return json({ error: 'Site bulunamadı.' }, 404);

  let output;
  try {
    output = await processBranding(kind, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof BrandingError) return json({ error: error.message }, 400);
    return json({ error: 'Görsel işlenemedi. Lütfen farklı bir dosya deneyin.' }, 400);
  }

  // Boyut dosya adında: logo sayfada doğru en-boy oranıyla, kayma (CLS) olmadan yer ayırır
  const path = `organizations/${orgId}/branding/${kind}-${randomBytes(8).toString('hex')}-${output.width}x${output.height}.${output.ext}`;
  const { error: uploadError } = await service.storage
    .from(MEDIA_BUCKETS.branding)
    .upload(path, output.buffer, { contentType: output.contentType, cacheControl: '31536000', upsert: false });
  if (uploadError) return json({ error: 'Görsel kaydedilemedi. Lütfen tekrar deneyin.' }, 502);

  const { error } = await setDraftBrandField(session.supabase, orgId, column, path);
  if (error) {
    await service.storage.from(MEDIA_BUCKETS.branding).remove([path]);
    return json({ error: 'Taslak güncellenemedi.' }, 500);
  }
  await logSecurityEvent({ orgId, action: 'site.branding_uploaded', actorId: session.user.id, targetType: 'branding', targetLabel: `${BRANDING_LABEL[kind]} (taslak)` });
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  return json({ path, message: `${BRANDING_LABEL[kind]} taslağa kaydedildi. Canlı sitede görünmesi için yayınlayın.` }, 201);
}

/** Görseli kaldırır (ör. mobil logo) */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Geçersiz istek kaynağı.' }, 403);
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return json({ error: 'Bu işlem için platform yöneticisi oturumu gerekir.' }, 403);
  }
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId') ?? '';
  const kind = (url.searchParams.get('kind') ?? '') as BrandingKind;
  if (!isUuid(orgId) || !BRANDING_KINDS.includes(kind)) return json({ error: 'Geçersiz istek.' }, 400);
  const service = createServiceClient();
  if (!service) return json({ error: 'Depolama yapılandırılmamış.' }, 503);
  const column = BRANDING_COLUMN[kind];
  const { data: before } = await service.from('organization_settings').select(column).eq('organization_id', orgId).maybeSingle();
  if (!before) return json({ error: 'Site bulunamadı.' }, 404);
  const { error } = await setDraftBrandField(session.supabase, orgId, column, null);
  if (error) return json({ error: 'Taslak güncellenemedi.' }, 500);
  await logSecurityEvent({ orgId, action: 'site.branding_uploaded', actorId: session.user.id, targetType: 'branding', targetLabel: `${BRANDING_LABEL[kind]} kaldırıldı (taslak)` });
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  return json({ message: `${BRANDING_LABEL[kind]} taslakta kaldırıldı. Canlı sitede yayınlayınca kalkar.` }, 200);
}
