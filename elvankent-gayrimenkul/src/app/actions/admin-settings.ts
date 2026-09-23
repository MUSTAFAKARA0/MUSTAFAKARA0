'use server';

import { z } from 'zod';
import { requireAdmin, UnauthorizedError } from '@/lib/auth';
import { revalidatePublic } from '@/lib/admin/revalidate';
import { CACHE_TAGS } from '@/lib/data/cache';
import { STORAGE_BUCKETS } from '@/lib/constants';
import { emailSchema, optionalText, phoneSchema, text, toFieldErrors, urlSchema, type FieldErrors } from '@/lib/validation/common';

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

function fail(e: unknown, msg: string): Result {
  return { ok: false, error: e instanceof UnauthorizedError ? e.message : msg };
}

const coord = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(min).max(max).nullable());

const settingsSchema = z.object({
  business_name: text(2, 120, 'İşletme adı'),
  tagline: optionalText(200, 'Kısa tanıtım'),
  phone: phoneSchema,
  whatsapp: phoneSchema,
  email: emailSchema,
  address: optionalText(400, 'Adres'),
  working_hours: optionalText(400, 'Çalışma saatleri'),
  about_text: optionalText(6000, 'Hakkımızda metni'),
  office_latitude: coord(-90, 90),
  office_longitude: coord(-180, 180),
  instagram_url: urlSchema('Instagram adresi'),
  facebook_url: urlSchema('Facebook adresi'),
  x_url: urlSchema('X adresi'),
  youtube_url: urlSchema('YouTube adresi'),
  linkedin_url: urlSchema('LinkedIn adresi'),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'Lütfen işaretli alanları kontrol edin.', fieldErrors: toFieldErrors(parsed.error) };
    }
    const { error } = await supabase.from('site_settings').update(parsed.data).eq('id', 1);
    if (error) return { ok: false, error: 'Ayarlar kaydedilemedi.' };
    revalidatePublic(CACHE_TAGS.settings);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Ayarlar kaydedilemedi.');
  }
}

export async function removeLogo(): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from('site_settings').update({ logo_url: null }).eq('id', 1);
    if (error) return { ok: false, error: 'Logo kaldırılamadı.' };
    revalidatePublic(CACHE_TAGS.settings);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Logo kaldırılamadı.');
  }
}

/** Tüm DEMO ilanları ve fotoğraflarını siler */
export async function deleteDemoProperties(): Promise<Result & { count?: number }> {
  try {
    const { supabase } = await requireAdmin();
    const { data: demos, error: listError } = await supabase.from('properties').select('id, slug, property_images(storage_path)').eq('is_demo', true);
    if (listError) return { ok: false, error: 'Demo ilanlar listelenemedi.' };
    if (!demos?.length) return { ok: true, count: 0 };
    const ids = demos.map((d) => d.id);
    const { error } = await supabase.from('properties').delete().in('id', ids);
    if (error) return { ok: false, error: 'Demo ilanlar silinemedi.' };
    const remote = demos
      .flatMap((d) => (d.property_images as { storage_path: string }[]).map((i) => i.storage_path))
      .filter((p) => !p.startsWith('/'));
    if (remote.length) await supabase.storage.from(STORAGE_BUCKETS.propertyImages).remove(remote);
    // Demo ilanlar için silme tetikleyicisinin oluşturduğu yönlendirmeler gereksizdir
    await supabase
      .from('redirects')
      .delete()
      .in(
        'from_path',
        demos.map((d) => `/ilan/${d.slug}`),
      );
    revalidatePublic(CACHE_TAGS.properties, CACHE_TAGS.redirects);
    return { ok: true, count: ids.length };
  } catch (e) {
    return fail(e, 'Demo ilanlar silinemedi.');
  }
}
