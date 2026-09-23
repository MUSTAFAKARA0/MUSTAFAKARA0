import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';

/**
 * Oturum çerezlerini kullanan sunucu istemcisi (yönetim paneli, server action).
 * Kullanıcının JWT'si ile çalışır → tüm sorgular RLS'e tabidir.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component içinden çerez yazılamaz; oturum yenilemesi proxy.ts'de yapılır.
        }
      },
    },
  });
}

/**
 * service_role istemcisi — RLS'i atlar. SADECE sunucuda, dar kapsamlı
 * işlemler için (iletişim formu kaydı, istatistik olayı) kullanılır.
 * Anahtar tanımlı değilse null döner.
 */
export function createServiceClient(): SupabaseClient | null {
  if (!serverEnv.supabaseServiceRoleKey || !publicEnv.supabaseUrl) return null;
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
