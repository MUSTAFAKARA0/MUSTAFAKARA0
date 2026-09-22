'use server';

import { requireAdmin, UnauthorizedError } from '@/lib/auth';
import { revalidatePublic } from '@/lib/admin/revalidate';
import { CACHE_TAGS } from '@/lib/data/cache';
import { LISTING_TYPE_LABELS, STORAGE_BUCKETS } from '@/lib/constants';
import { isLocalImage } from '@/lib/images';
import { slugify } from '@/lib/slug';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/common';
import { propertySchema, type PropertyInput } from '@/lib/validation/property';
import type { PropertyStatus } from '@/types/database';

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof UnauthorizedError) return { ok: false, error: error.message };
  return { ok: false, error: fallback };
}

/** İlan başlığından SEO uyumlu slug tabanı (ilan no'yu veritabanı ekler) */
function buildSlugBase(title: string, listingType: 'sale' | 'rent'): string {
  const base = slugify(title.replace(/^demo\s*[–-]\s*/i, ''), 100);
  const prefix = slugify(LISTING_TYPE_LABELS[listingType]);
  return base.startsWith(prefix) ? base : slugify(`${prefix} ${base}`, 110);
}

/** Yeni ilan oluşturur veya mevcut ilanı günceller */
export async function saveProperty(
  id: string | null,
  input: PropertyInput,
): Promise<ActionResult<{ id: string; slug: string; listingNo: number }>> {
  try {
    const { supabase, user } = await requireAdmin();
    const parsed = propertySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'Lütfen işaretli alanları kontrol edin.', fieldErrors: toFieldErrors(parsed.error) };
    }
    if (id && !uuidRe.test(id)) return { ok: false, error: 'Geçersiz ilan.' };
    const d = parsed.data;

    const row = {
      slug: buildSlugBase(d.title, d.listing_type),
      title: d.title,
      description: d.description,
      listing_type: d.listing_type,
      property_type_id: d.property_type_id,
      status: d.status,
      is_featured: d.is_featured,
      price: d.price,
      currency: d.currency,
      price_negotiable: d.price_negotiable,
      dues: d.dues,
      deposit: d.listing_type === 'rent' ? d.deposit : null,
      city_id: d.city_id,
      district_id: d.district_id,
      neighborhood_id: d.neighborhood_id,
      gross_m2: d.gross_m2,
      net_m2: d.net_m2,
      room_count: d.room_count,
      living_room_count: d.living_room_count,
      building_age: d.building_age,
      floor: d.floor,
      total_floors: d.total_floors,
      bathroom_count: d.bathroom_count,
      balcony_count: d.balcony_count,
      heating: d.heating,
      has_elevator: d.has_elevator,
      parking: d.parking,
      is_furnished: d.is_furnished,
      in_complex: d.in_complex,
      complex_name: d.in_complex ? d.complex_name : null,
      has_air_conditioning: d.has_air_conditioning,
      credit_eligible: d.credit_eligible,
      deed_status: d.deed_status,
      usage_status: d.usage_status,
      facades: d.facades,
      views: d.views,
      swap_available: d.swap_available,
      zoning_status: d.zoning_status,
      block_no: d.block_no,
      parcel_no: d.parcel_no,
      floor_area_ratio: d.floor_area_ratio,
      height_limit: d.height_limit,
      meta_description: d.meta_description,
    };

    const query = id
      ? supabase.from('properties').update(row).eq('id', id)
      : supabase.from('properties').insert({ ...row, created_by: user.id });
    const { data: saved, error } = await query.select('id, slug, listing_no').single();
    if (error || !saved) {
      if (error?.code === '23514') return { ok: false, error: 'Konum bilgileri tutarsız. İl, ilçe ve mahalle seçimini kontrol edin.' };
      return { ok: false, error: 'İlan kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.' };
    }

    const { error: locError } = await supabase.from('property_locations').upsert({
      property_id: saved.id,
      address: d.address,
      latitude: d.latitude,
      longitude: d.longitude,
      precision: d.location_precision,
    });
    if (locError) return { ok: false, error: 'İlan kaydedildi ancak konum bilgisi kaydedilemedi. Lütfen tekrar kaydedin.' };

    const { error: delError } = await supabase.from('property_features').delete().eq('property_id', saved.id);
    const featureIds = Array.from(new Set(d.feature_ids));
    const { error: featError } = featureIds.length
      ? await supabase.from('property_features').insert(featureIds.map((feature_id) => ({ property_id: saved.id, feature_id })))
      : { error: null };
    if (delError || featError) return { ok: false, error: 'İlan kaydedildi ancak özellikler kaydedilemedi. Lütfen tekrar kaydedin.' };

    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true, data: { id: saved.id, slug: saved.slug, listingNo: saved.listing_no } };
  } catch (e) {
    return fail(e, 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
  }
}

export async function setPropertyStatus(id: string, status: PropertyStatus): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id) || !['draft', 'active', 'passive', 'sold', 'rented'].includes(status)) {
      return { ok: false, error: 'Geçersiz işlem.' };
    }
    const { error } = await supabase.from('properties').update({ status }).eq('id', id);
    if (error) return { ok: false, error: 'İlan durumu güncellenemedi.' };
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'İlan durumu güncellenemedi.');
  }
}

export async function setPropertyFeatured(id: string, featured: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id)) return { ok: false, error: 'Geçersiz ilan.' };
    const { error } = await supabase.from('properties').update({ is_featured: featured }).eq('id', id);
    if (error) return { ok: false, error: 'Öne çıkarma durumu güncellenemedi.' };
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Öne çıkarma durumu güncellenemedi.');
  }
}

/** Fiyatı hızlıca günceller (ilan tablosundan) */
export async function updatePropertyPrice(id: string, price: number): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id) || !Number.isFinite(price) || price <= 0 || price > 999_999_999_999) {
      return { ok: false, error: 'Geçerli bir fiyat girin.' };
    }
    const { error } = await supabase.from('properties').update({ price }).eq('id', id);
    if (error) return { ok: false, error: 'Fiyat güncellenemedi.' };
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Fiyat güncellenemedi.');
  }
}

async function removeStorageFiles(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], paths: string[]) {
  const remote = paths.filter((p) => !isLocalImage(p));
  if (remote.length) await supabase.storage.from(STORAGE_BUCKETS.propertyImages).remove(remote);
}

/** İlanı ve tüm fotoğraflarını kalıcı olarak siler (adres 301 ile kategoriye yönlenir) */
export async function deleteProperty(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id)) return { ok: false, error: 'Geçersiz ilan.' };
    const { data: images } = await supabase.from('property_images').select('storage_path').eq('property_id', id);
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) return { ok: false, error: 'İlan silinemedi.' };
    await removeStorageFiles(supabase, (images ?? []).map((i) => i.storage_path));
    revalidatePublic(CACHE_TAGS.properties, CACHE_TAGS.redirects);
    return { ok: true };
  } catch (e) {
    return fail(e, 'İlan silinemedi.');
  }
}

/** Fotoğraf sırasını kaydeder */
export async function reorderImages(propertyId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(propertyId) || orderedIds.length > 100 || !orderedIds.every((x) => uuidRe.test(x))) {
      return { ok: false, error: 'Geçersiz işlem.' };
    }
    const results = await Promise.all(
      orderedIds.map((imageId, index) =>
        supabase.from('property_images').update({ sort_order: index }).eq('id', imageId).eq('property_id', propertyId),
      ),
    );
    if (results.some((r) => r.error)) return { ok: false, error: 'Fotoğraf sırası kaydedilemedi.' };
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Fotoğraf sırası kaydedilemedi.');
  }
}

export async function setCoverImage(propertyId: string, imageId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(propertyId) || !uuidRe.test(imageId)) return { ok: false, error: 'Geçersiz işlem.' };
    const { error: e1 } = await supabase
      .from('property_images')
      .update({ is_cover: false })
      .eq('property_id', propertyId)
      .eq('is_cover', true);
    const { error: e2 } = await supabase
      .from('property_images')
      .update({ is_cover: true })
      .eq('id', imageId)
      .eq('property_id', propertyId);
    if (e1 || e2) return { ok: false, error: 'Kapak fotoğrafı değiştirilemedi.' };
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Kapak fotoğrafı değiştirilemedi.');
  }
}

export async function deleteImage(propertyId: string, imageId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(propertyId) || !uuidRe.test(imageId)) return { ok: false, error: 'Geçersiz işlem.' };
    const { data: img } = await supabase
      .from('property_images')
      .select('storage_path, is_cover')
      .eq('id', imageId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (!img) return { ok: false, error: 'Fotoğraf bulunamadı.' };
    const { error } = await supabase.from('property_images').delete().eq('id', imageId);
    if (error) return { ok: false, error: 'Fotoğraf silinemedi.' };
    await removeStorageFiles(supabase, [img.storage_path]);
    if (img.is_cover) {
      const { data: next } = await supabase
        .from('property_images')
        .select('id')
        .eq('property_id', propertyId)
        .order('sort_order')
        .limit(1)
        .maybeSingle();
      if (next) await supabase.from('property_images').update({ is_cover: true }).eq('id', next.id);
    }
    revalidatePublic(CACHE_TAGS.properties);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Fotoğraf silinemedi.');
  }
}

/** İlan formundan hızlıca yeni mahalle/ilçe ekleme */
export async function addLocation(
  kind: 'district' | 'neighborhood',
  parentId: number,
  name: string,
): Promise<ActionResult<{ id: number; name: string; slug: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 80 || !Number.isInteger(parentId) || parentId <= 0) {
      return { ok: false, error: 'Geçerli bir ad girin (2-80 karakter).' };
    }
    const slug = slugify(clean, 60);
    if (!slug) return { ok: false, error: 'Geçerli bir ad girin.' };
    const table = kind === 'district' ? 'districts' : 'neighborhoods';
    const parentKey = kind === 'district' ? 'city_id' : 'district_id';
    const { data, error } = await supabase
      .from(table)
      .insert({ [parentKey]: parentId, name: clean, slug })
      .select('id, name, slug')
      .single();
    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Bu ad zaten listede mevcut.' };
      return { ok: false, error: 'Konum eklenemedi.' };
    }
    revalidatePublic(CACHE_TAGS.taxonomy);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Konum eklenemedi.');
  }
}
