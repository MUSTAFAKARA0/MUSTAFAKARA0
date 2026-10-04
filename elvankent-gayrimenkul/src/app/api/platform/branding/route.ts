import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/utils';
import {
  BRANDING_KINDS,
  BRANDING_LABEL,
  BRANDING_MAX_INPUT_BYTES,
  BrandingError,
  type BrandingKind,
} from '@/modules/media/branding';
import { logSecurityEvent } from '@/platform/audit';
import { requireSuperAdmin } from '@/platform/auth/session';
import { toActionFailure } from '@/platform/actions';
import { removeBrandingDraft, uploadBrandingDraft } from '@/site-editor/branding';

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
  const { data: before } = await service.from('organization_settings').select('organization_id').eq('organization_id', orgId).maybeSingle();
  if (!before) return json({ error: 'Site bulunamadı.' }, 404);
  // Ortak çekirdek (ofisle aynı): doğrula → yeni yola yükle → taslağa bağla; eski dosya silinmez
  let res;
  try {
    res = await uploadBrandingDraft({ db: session.supabase, storage: service, orgId, kind, input: Buffer.from(await file.arrayBuffer()), allowOg: true });
  } catch (error) {
    if (error instanceof BrandingError) return json({ error: error.message }, 400);
    return json({ error: toActionFailure(error).error }, 400);
  }
  await logSecurityEvent({ orgId, action: 'site.branding_uploaded', actorId: session.user.id, targetType: 'branding', targetLabel: `${BRANDING_LABEL[kind]} (taslak)` });
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  return json({ path: res.path, message: res.message }, 201);
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
  let message: string;
  try {
    message = await removeBrandingDraft(session.supabase, orgId, kind, { allowOg: true });
  } catch (error) {
    return json({ error: toActionFailure(error).error }, 400);
  }
  await logSecurityEvent({ orgId, action: 'site.branding_uploaded', actorId: session.user.id, targetType: 'branding', targetLabel: `${BRANDING_LABEL[kind]} kaldırıldı (taslak)` });
  revalidatePath(`/platform/siteler/${orgId}`, 'layout');
  return json({ message }, 200);
}
