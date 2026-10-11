import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';
import type { Database } from '@/types/supabase';

export type DB = SupabaseClient<Database>;

/**
 * Oturum çerezlerini kullanan sunucu istemcisi (yönetim paneli, server action).
 * Kullanıcının JWT'si ile çalışır → tüm sorgular RLS'e tabidir.
 */
export async function createSessionClient(): Promise<DB> {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
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
 * service_role istemcisi — RLS'i ATLAR. SADECE sunucuda, dar kapsamlı sistem
 * işlemleri için kullanılır (form kaydı, olay kaydı, güvenlik logu, kullanıcı
 * oluşturma, zamanlanmış temizlik). Anahtar tanımlı değilse null döner.
 */
export function createServiceClient(cache?: { tags: string[]; revalidateSeconds: number }): DB | null {
  if (!serverEnv.supabaseServiceRoleKey || !publicEnv.supabaseUrl) return null;
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // İsteğe bağlı önbellek: yalnızca herkese açık, kullanıcıya özel olmayan sonuçlar için
    ...(cache ? { global: { fetch: (input, init) => fetch(input, { ...init, next: { revalidate: cache.revalidateSeconds, tags: cache.tags } }) } } : {}),
  });
}

/**
 * Önbelleğe alınabilir anonim istemci (herkese açık sayfalar). İstekler Next.js
 * veri önbelleğine verilen etiketlerle yazılır; yönetim işlemleri `revalidateTag`
 * ile ilgili etiketleri anında geçersiz kılar. Çerez kullanmaz.
 */
export function createPublicClient(tags: string[], revalidateSeconds = 300): DB {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate: revalidateSeconds, tags } }),
    },
  });
}

/**
 * Önbelleğe ALINMAYAN anonim istemci: her istekte güncel sonuç gereken ve yan
 * etkisi olan herkese açık çağrılar (ör. görüntülenme sayacını artıran özel
 * koleksiyon bağlantısı). Çerez kullanmaz; RLS anonim rolle uygulanır.
 */
export function createAnonClient(): DB {
  return createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
