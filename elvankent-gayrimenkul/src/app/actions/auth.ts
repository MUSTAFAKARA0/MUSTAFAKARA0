'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSessionClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
  email?: string;
}

const loginSchema = z.object({
  email: z.email({ error: 'Geçerli bir e-posta adresi girin.' }).max(160),
  password: z.string().min(6, { error: 'Şifre en az 6 karakter olmalıdır.' }).max(200),
});

/** Yalnızca site içi göreli yollara yönlendir (açık yönlendirme açığını önler) */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  return value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const parsed = loginSchema.safeParse({ email, password: String(formData.get('password') ?? '') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const rateLimited = error.status === 429;
    return {
      error: rateLimited
        ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
        : 'E-posta veya şifre hatalı.',
      email,
    };
  }
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: 'Bu hesabın yönetim paneline erişim yetkisi yok.', email };
  }
  redirect(safeNext(formData.get('next')));
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect('/admin/giris');
}
