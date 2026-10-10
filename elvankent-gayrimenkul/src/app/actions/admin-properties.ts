'use server';

import { redirect } from 'next/navigation';
import { updateTag } from 'next/cache';
import { z } from 'zod';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import {
  featureIdsSchema,
  locationSchema,
  propertyPatchSchema,
  type PrivateLocation,
  type PropertyPatch,
} from '@/modules/properties/admin';
import type { ListingStatus } from '@/modules/properties/constants';
import { ActionError, assertNoDbError, mapDbError, NotFoundError, runAction, toActionFailure, type ActionResult } from '@/platform/actions';
import { requirePermission, type OrgContext } from '@/platform/auth/session';
import type { TablesInsert } from '@/types/supabase';

function invalidate(orgId: string) {
  updateTag(cacheTags.properties(orgId));
  updateTag(cacheTags.redirects(orgId));
}

async function loadOwned(ctx: OrgContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError('İlan bulunamadı.');
  const { data, error } = await ctx.supabase
    .from('properties')
    .select('id, organization_id, updated_at, deleted_at, status, listing_type, title')
    .eq('id', id)
    .maybeSingle();
  assertNoDbError(error);
  // Kullanıcının aktif organizasyonu dışındaki ilanlar (RLS izin verse bile) işlenmez
  if (!data || data.organization_id !== ctx.org.id) throw new NotFoundError('İlan bulunamadı veya erişim yetkiniz yok.');
  return data;
}

export interface CreatePropertyState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const createSchema = z.object({
  title: z.string().trim().min(3, { error: 'Başlık en az 3 karakter olmalıdır.' }).max(120, { error: 'Başlık en fazla 120 karakter olabilir.' }),
  listing_type: z.enum(['sale', 'rent'], { error: 'İlan türünü seçin.' }),
  property_type_id: z.coerce.number({ error: 'Emlak tipini seçin.' }).int().positive({ error: 'Emlak tipini seçin.' }),
});

/** Yeni ilan: taslak oluşturulur ve sihirbaza yönlendirilir (sonraki adımlar otomatik kaydedilir) */
export async function createProperty(_prev: CreatePropertyState, formData: FormData): Promise<CreatePropertyState> {
  const parsed = createSchema.safeParse({
    title: formData.get('title'),
    listing_type: formData.get('listing_type'),
    property_type_id: formData.get('property_type_id'),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: 'Lütfen işaretli alanları kontrol edin.', fieldErrors };
  }
  let id: string;
  try {
    const ctx = await requirePermission('properties.create');
    const [{ data: type }, { data: settings }] = await Promise.all([
      ctx.supabase.from('property_types').select('category').eq('id', parsed.data.property_type_id).maybeSingle(),
      ctx.supabase.from('organization_settings').select('default_location_precision').eq('organization_id', ctx.org.id).maybeSingle(),
    ]);
    if (!type) return { fieldErrors: { property_type_id: 'Geçersiz emlak tipi.' } };
    const { data, error } = await ctx.supabase
      .from('properties')
      .insert({
        organization_id: ctx.org.id,
        title: parsed.data.title.replace(/[<>]/g, ''),
        listing_type: parsed.data.listing_type,
        property_type_id: parsed.data.property_type_id,
        category: type.category,
        // Şirket ayarlarındaki varsayılan konum gösterimi (Ayarlar › İlan varsayılanları)
        location_precision: settings?.default_location_precision ?? 'approximate',
        // Veritabanı tetikleyicisi üretir (benzersiz adres ve EKG-2026-0001 biçiminde ilan no)
        slug: '',
        reference_no: '',
        status: 'draft',
        created_by: ctx.user.id,
      })
      .select('id')
      .single();
    if (error) return { error: mapDbError(error) };
    id = data.id;
    invalidate(ctx.org.id);
  } catch (error) {
    return { error: toActionFailure(error).error };
  }
  redirect(`/admin/ilanlar/${id}?adim=konum`);
}

export interface SaveInput {
  patch?: PropertyPatch;
  location?: PrivateLocation;
  featureIds?: number[];
  /** Düzenlemeye başlanan sürüm: başkası arada kaydetmişse üzerine yazılmaz */
  expectedUpdatedAt: string;
}

export interface SaveResult {
  updatedAt: string;
  slug: string;
}

/**
 * Otomatik kaydetme. İyimser eşzamanlılık: `updated_at` değişmişse (başka bir
 * kullanıcı/sekme kaydetmiş) kayıt yapılmaz ve "conflict" döner.
 */
export async function saveProperty(id: string, input: SaveInput): Promise<ActionResult<SaveResult>> {
  return runAction(async () => {
    const ctx = await requirePermission('properties.update');
    const current = await loadOwned(ctx, id);
    if (current.deleted_at) throw new ActionError('Bu ilan çöp kutusunda. Düzenlemek için önce geri yükleyin.', 'deleted');
    if (current.updated_at !== input.expectedUpdatedAt) {
      throw new ActionError('Bu ilan siz düzenlerken başka bir oturumda değiştirildi. Son hali yüklenecek.', 'conflict');
    }

    const patch = input.patch ? propertyPatchSchema.parse(input.patch) : {};
    if ('is_featured' in patch || 'show_on_homepage' in patch) {
      if (!ctx.can('properties.publish')) throw new ActionError('Öne çıkarma ve ana sayfa vitrini için yayın yetkisi gerekir.', 'forbidden');
    }
    if (patch.og_media_id) {
      const { data: media } = await ctx.supabase.from('media_assets').select('property_id, status').eq('id', patch.og_media_id).maybeSingle();
      if (!media || media.property_id !== id || media.status !== 'ready') throw new ActionError('Paylaşım görseli bu ilana ait olmalıdır.');
    }

    if (Object.keys(patch).length > 0) {
      const { data, error } = await ctx.supabase
        .from('properties')
        .update({ ...patch, updated_by: ctx.user.id })
        .eq('id', id)
        .eq('updated_at', input.expectedUpdatedAt)
        .select('id');
      assertNoDbError(error);
      if (!data?.length) throw new ActionError('Bu ilan siz düzenlerken başka bir oturumda değiştirildi. Son hali yüklenecek.', 'conflict');
    }

    if (input.location) {
      const location = locationSchema.parse(input.location);
      const { data: prop } = await ctx.supabase.from('properties').select('location_precision').eq('id', id).single();
      const { error } = await ctx.supabase.from('property_locations').upsert(
        {
          property_id: id,
          organization_id: ctx.org.id,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          precision: prop?.location_precision ?? 'approximate',
        },
        { onConflict: 'property_id' },
      );
      assertNoDbError(error);
    }

    if (input.featureIds) {
      const ids = [...new Set(featureIdsSchema.parse(input.featureIds))];
      const { error: delError } = await ctx.supabase.from('property_features').delete().eq('property_id', id);
      assertNoDbError(delError);
      if (ids.length) {
        const { error } = await ctx.supabase
          .from('property_features')
          .insert(ids.map((feature_id) => ({ property_id: id, feature_id, organization_id: ctx.org.id })));
        assertNoDbError(error);
      }
    }

    const { data: fresh, error: freshError } = await ctx.supabase.from('properties').select('updated_at, slug').eq('id', id).single();
    assertNoDbError(freshError);
    if (!fresh) throw new NotFoundError();
    invalidate(ctx.org.id);
    return { updatedAt: fresh.updated_at, slug: fresh.slug };
  });
}

const statusSchema = z.enum(['draft', 'pending', 'published', 'sold', 'rented', 'archived']);

/** Durum değişikliği (yayınla, onaya gönder, satıldı...). Kurallar veritabanında da uygulanır. */
export async function setPropertyStatus(id: string, status: ListingStatus, expectedUpdatedAt: string): Promise<ActionResult<SaveResult>> {
  return runAction(async () => {
    const next = statusSchema.parse(status);
    const needsPublish = ['published', 'sold', 'rented'].includes(next);
    const ctx = await requirePermission(needsPublish ? 'properties.publish' : 'properties.update');
    const current = await loadOwned(ctx, id);
    if (current.deleted_at) throw new ActionError('Çöp kutusundaki ilanın durumu değiştirilemez.');
    if (current.updated_at !== expectedUpdatedAt) {
      throw new ActionError('Bu ilan siz düzenlerken başka bir oturumda değiştirildi. Son hali yüklenecek.', 'conflict');
    }
    if (['published', 'sold', 'rented'].includes(current.status) && !ctx.can('properties.publish')) {
      throw new ActionError('Yayındaki ilanların durumunu değiştirme yetkiniz yok.', 'forbidden');
    }
    const { data, error } = await ctx.supabase
      .from('properties')
      .update({ status: next, updated_by: ctx.user.id })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at, slug');
    assertNoDbError(error);
    if (!data?.length) throw new ActionError('Bu ilan siz düzenlerken başka bir oturumda değiştirildi.', 'conflict');
    invalidate(ctx.org.id);
    return { updatedAt: data[0].updated_at, slug: data[0].slug };
  });
}

const BULK_ACTIONS = ['publish', 'archive', 'delete', 'restore', 'feature', 'unfeature', 'purge'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

const BULK_PERMISSION: Record<BulkAction, 'properties.publish' | 'properties.delete' | 'properties.update'> = {
  publish: 'properties.publish',
  archive: 'properties.publish',
  feature: 'properties.publish',
  unfeature: 'properties.publish',
  delete: 'properties.delete',
  restore: 'properties.delete',
  purge: 'properties.delete',
};

export interface BulkResult {
  done: number;
  failed: { id: string; error: string }[];
}

/** Toplu işlem: her ilan ayrı alt işlemde; başarısız olanlar gerekçesiyle raporlanır */
export async function bulkPropertyAction(ids: string[], action: BulkAction): Promise<ActionResult<BulkResult>> {
  return runAction(async () => {
    const act = z.enum(BULK_ACTIONS).parse(action);
    const list = z.array(z.uuid()).min(1, { error: 'İlan seçilmedi.' }).max(100, { error: 'Tek seferde en fazla 100 ilan seçilebilir.' }).parse(ids);
    const ctx = await requirePermission(BULK_PERMISSION[act]);
    // Yalnızca aktif organizasyonun ilanları işlenir
    const { data: owned, error: ownedError } = await ctx.supabase.from('properties').select('id').eq('organization_id', ctx.org.id).in('id', list);
    assertNoDbError(ownedError);
    const ownedIds = (owned ?? []).map((r) => r.id);
    const { data, error } = await ctx.supabase.rpc('bulk_property_action', { p_ids: ownedIds, p_action: act });
    assertNoDbError(error);
    const result = data as unknown as { ok: string[]; failed: { id: string; error: string; detail?: string; hint?: string }[] };
    invalidate(ctx.org.id);
    return {
      done: result.ok.length,
      failed: [
        ...list.filter((i) => !ownedIds.includes(i)).map((i) => ({ id: i, error: 'İlan bulunamadı.' })),
        ...result.failed.map((f) => ({
          id: f.id,
          error:
            f.error === 'not_found_or_forbidden'
              ? 'İşlem bu ilana uygulanamadı.'
              : mapDbError({ message: f.error, details: f.detail ?? null, hint: f.hint ?? null }),
        })),
      ],
    };
  });
}

/** İlanı kopyala: fotoğraflar hariç tüm bilgilerle yeni taslak */
export async function duplicateProperty(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requirePermission('properties.create');
    await loadOwned(ctx, id);
    const { data: source, error } = await ctx.supabase.from('properties').select('*').eq('id', id).single();
    assertNoDbError(error);
    if (!source) throw new NotFoundError();
    const omit = new Set([
      'id', 'slug', 'reference_no', 'status', 'published_at', 'created_at', 'updated_at', 'deleted_at', 'deleted_by', 'updated_by',
      'status_changed_at', 'price_previous', 'price_changed_at', 'price_dropped_at', 'og_media_id', 'is_featured', 'show_on_homepage',
      'is_demo', 'floor_position', 'rooms_label', 'public_latitude', 'public_longitude', 'created_by',
    ]);
    const copy = Object.fromEntries(Object.entries(source).filter(([k]) => !omit.has(k)));
    const title = `${source.title} (kopya)`.slice(0, 120);
    const insert = { ...copy, title, slug: '', reference_no: '', status: 'draft', created_by: ctx.user.id } as TablesInsert<'properties'>;
    const { data: created, error: insertError } = await ctx.supabase.from('properties').insert(insert).select('id').single();
    assertNoDbError(insertError);
    if (!created) throw new ActionError('İlan kopyalanamadı.');
    const [{ data: features }, { data: location }] = await Promise.all([
      ctx.supabase.from('property_features').select('feature_id').eq('property_id', id),
      ctx.supabase.from('property_locations').select('address, latitude, longitude, precision').eq('property_id', id).maybeSingle(),
    ]);
    if (features?.length) {
      await ctx.supabase.from('property_features').insert(features.map((f) => ({ property_id: created.id, feature_id: f.feature_id, organization_id: ctx.org.id })));
    }
    if (location) await ctx.supabase.from('property_locations').insert({ ...location, property_id: created.id, organization_id: ctx.org.id });
    invalidate(ctx.org.id);
    return { id: created.id };
  }, 'İlan kopyalandı. Fotoğrafları yeni taslağa ekleyebilirsiniz.');
}
