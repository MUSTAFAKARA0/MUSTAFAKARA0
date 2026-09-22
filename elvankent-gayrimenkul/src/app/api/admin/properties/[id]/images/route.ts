import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { getAdminContext } from '@/lib/auth';
import { revalidatePublic } from '@/lib/admin/revalidate';
import { ImageValidationError, processPropertyImage } from '@/lib/admin/image-processing';
import { CACHE_TAGS } from '@/lib/data/cache';
import { IMAGE_LIMITS, STORAGE_BUCKETS } from '@/lib/constants';

export const runtime = 'nodejs';

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = 'Fotoğraf yüklenirken bir hata oluştu. Lütfen tekrar deneyin.';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** İlan fotoğrafı yükleme (yalnızca admin). multipart/form-data: file */
export async function POST(request: Request, ctx: RouteContext<'/api/admin/properties/[id]/images'>) {
  const { id } = await ctx.params;
  if (!uuidRe.test(id)) return error('Geçersiz ilan.', 400);

  // CSRF: yalnızca aynı kaynaktan gelen istekler
  if (!isSameOrigin(request)) return error('Geçersiz istek kaynağı.', 403);

  const admin = await getAdminContext();
  if (!admin) return error('Oturumunuzun süresi dolmuş olabilir. Lütfen tekrar giriş yapın.', 401);
  const { supabase } = admin;

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > IMAGE_LIMITS.maxUploadBytes + 64 * 1024) return error('Fotoğraf en fazla 8 MB olabilir.', 413);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    file = value instanceof File ? value : null;
  } catch {
    return error(GENERIC_ERROR, 400);
  }
  if (!file || file.size === 0) return error('Dosya seçilmedi.', 400);

  const { data: property } = await supabase.from('properties').select('id, title').eq('id', id).maybeSingle();
  if (!property) return error('İlan bulunamadı.', 404);

  const { count } = await supabase.from('property_images').select('id', { count: 'exact', head: true }).eq('property_id', id);
  if ((count ?? 0) >= IMAGE_LIMITS.maxImagesPerProperty) {
    return error(`Bir ilana en fazla ${IMAGE_LIMITS.maxImagesPerProperty} fotoğraf eklenebilir.`, 400);
  }

  let processed;
  try {
    processed = await processPropertyImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return error(e instanceof ImageValidationError ? e.message : GENERIC_ERROR, 400);
  }

  const path = `${id}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.propertyImages)
    .upload(path, processed.data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (uploadError) return error(GENERIC_ERROR, 502);

  const { data: last } = await supabase
    .from('property_images')
    .select('sort_order')
    .eq('property_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: cover } = await supabase.from('property_images').select('id').eq('property_id', id).eq('is_cover', true).maybeSingle();

  const { data: image, error: insertError } = await supabase
    .from('property_images')
    .insert({
      property_id: id,
      storage_path: path,
      width: processed.width,
      height: processed.height,
      blur_data_url: processed.blurDataUrl,
      alt: property.title.slice(0, 200),
      sort_order: (last?.sort_order ?? -1) + 1,
      is_cover: !cover,
    })
    .select('id, property_id, storage_path, width, height, blur_data_url, alt, sort_order, is_cover')
    .single();

  if (insertError || !image) {
    await supabase.storage.from(STORAGE_BUCKETS.propertyImages).remove([path]);
    return error(GENERIC_ERROR, 500);
  }

  revalidatePublic(CACHE_TAGS.properties);
  return NextResponse.json({ image }, { status: 201 });
}
