import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { createServiceClient } from '@/lib/supabase/server';
import { BRANDING_KINDS, BRANDING_MAX_INPUT_BYTES, BRANDING_PERMISSION, BrandingError, type BrandingKind } from '@/modules/media/branding';
import { toActionFailure } from '@/platform/actions';
import { logSecurityEvent } from '@/platform/audit';
import { getOrgContext } from '@/platform/auth/session';
import { uploadBrandingDraft } from '@/site-editor/branding';

export const runtime = 'nodejs';
export const maxDuration = 30;

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Marka görseli yükleme (logo, mobil logo, site simgesi, ana sayfa ve paylaşım görseli) → TASLAK.
 * Yetki türe göre sunucuda doğrulanır (paylaşım görseli seo.manage, diğerleri settings.manage);
 * organizasyon istemciden alınmaz; dosya yolu kullanıcı girdisi içermez. Taslak yazımını
 * veritabanı (site_save_draft) ikinci kez doğrular: SEO yetkisi yalnızca SEO alanlarını yazabilir.
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

  // P0.2/P0.3: tüm marka görselleri (logo, mobil logo, site simgesi, ana sayfa ve paylaşım görseli)
  // TASLAĞA yazılır (ortak çekirdek; canlı site yayına kadar eskisini gösterir, eski dosya silinmez).
  // Ayar kaydına doğrudan yazılmaz; organizasyon oturumdan gelir.
  try {
    const expected = form.get('expected');
    const res = await uploadBrandingDraft({
      db: ctx.supabase,
      storage: ctx.can('settings.manage') ? ctx.supabase : createServiceClient() ?? ctx.supabase,
      orgId: ctx.org.id,
      kind,
      input: Buffer.from(await file.arrayBuffer()),
      expected: typeof expected === 'string' ? expected : null,
    });
    revalidatePath('/admin', 'layout');
    return json({ path: res.path, message: res.message }, 201);
  } catch (error) {
    if (error instanceof BrandingError) return json({ error: error.message }, 400);
    return json({ error: toActionFailure(error).error }, 400);
  }
}
