import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSessionClient } from '@/lib/supabase/server';

export interface AdminContext {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Oturumdaki kullanıcıyı Auth sunucusunda doğrular ve admin rolünü
 * veritabanındaki is_admin() fonksiyonu ile kontrol eder.
 * Sadece istemci tarafı kontrole güvenilmez; RLS ayrıca her sorguyu korur.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin');
  if (rpcError || isAdmin !== true) return null;
  return { supabase, user: data.user };
});

/** Sayfa/layout için: admin değilse giriş sayfasına yönlendirir. */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/admin/giris');
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Bu işlem için yönetici girişi gereklidir.');
    this.name = 'UnauthorizedError';
  }
}

/** Server action / route handler için: admin değilse hata fırlatır. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}
