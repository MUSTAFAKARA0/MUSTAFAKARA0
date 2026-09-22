import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { getAdminContext } from '@/lib/auth';
import { revalidatePublic } from '@/lib/admin/revalidate';
import { ImageValidationError, processLogo } from '@/lib/admin/image-processing';
import { CACHE_TAGS } from '@/lib/data/cache';
import { STORAGE_BUCKETS } from '@/lib/constants';
import { imageUrl } from '@/lib/images';

export const runtime = 'nodejs';

/** Logo yükleme (yalnızca admin). SVG kabul edilmez (XSS riski). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: 'Lütfen tekrar giriş yapın.' }, { status: 401 });

  let png: Buffer;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Dosya seçilmedi.' }, { status: 400 });
    png = await processLogo(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    const msg = e instanceof ImageValidationError ? e.message : 'Logo yüklenemedi. Lütfen tekrar deneyin.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const path = `logo-${randomUUID()}.png`;
  const { error: upErr } = await admin.supabase.storage
    .from(STORAGE_BUCKETS.branding)
    .upload(path, png, { contentType: 'image/png', cacheControl: '31536000' });
  if (upErr) return NextResponse.json({ error: 'Logo yüklenemedi. Lütfen tekrar deneyin.' }, { status: 502 });

  const url = imageUrl(path, STORAGE_BUCKETS.branding);
  const { error } = await admin.supabase.from('site_settings').update({ logo_url: url }).eq('id', 1);
  if (error) return NextResponse.json({ error: 'Logo kaydedilemedi.' }, { status: 500 });
  revalidatePublic(CACHE_TAGS.settings);
  return NextResponse.json({ url }, { status: 201 });
}
