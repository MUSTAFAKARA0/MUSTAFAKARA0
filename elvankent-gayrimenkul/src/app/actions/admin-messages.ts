'use server';

import { requireAdmin, UnauthorizedError } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { ContactStatus } from '@/types/database';

type Result = { ok: true } | { ok: false; error: string };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: ContactStatus[] = ['new', 'read', 'replied', 'archived'];

function fail(e: unknown, msg: string): Result {
  return { ok: false, error: e instanceof UnauthorizedError ? e.message : msg };
}

export async function updateContactStatus(id: string, status: ContactStatus): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id) || !STATUSES.includes(status)) return { ok: false, error: 'Geçersiz işlem.' };
    const { error } = await supabase.from('contact_requests').update({ status }).eq('id', id);
    if (error) return { ok: false, error: 'Durum güncellenemedi.' };
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Durum güncellenemedi.');
  }
}

export async function saveContactNote(id: string, note: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id)) return { ok: false, error: 'Geçersiz işlem.' };
    const clean = note.trim().slice(0, 2000);
    const { error } = await supabase.from('contact_requests').update({ admin_note: clean || null }).eq('id', id);
    if (error) return { ok: false, error: 'Not kaydedilemedi.' };
    revalidatePath('/admin/mesajlar');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Not kaydedilemedi.');
  }
}

export async function deleteContact(id: string): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!uuidRe.test(id)) return { ok: false, error: 'Geçersiz işlem.' };
    const { error } = await supabase.from('contact_requests').delete().eq('id', id);
    if (error) return { ok: false, error: 'Mesaj silinemedi.' };
    revalidatePath('/admin', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Mesaj silinemedi.');
  }
}
