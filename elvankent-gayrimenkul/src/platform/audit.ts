import 'server-only';
import type { Json } from '@/types/supabase';
import { createServiceClient } from '@/lib/supabase/server';

export interface SecurityEvent {
  orgId: string | null;
  action: `${string}.${string}`;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  /** ŞİFRE, TOKEN, OTURUM BİLGİSİ gibi hassas veriler buraya YAZILMAZ. */
  metadata?: Record<string, Json>;
  ipHash?: string | null;
}

/**
 * Güvenlik olayını denetim kaydına yazar (oturum açma, yetkisiz erişim,
 * dışa aktarma...). Kayıt başarısız olursa kullanıcı işlemi etkilenmez.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const service = createServiceClient();
  if (!service) return;
  // Tüm parametreler (boş olanlar null olarak) gönderilmelidir; aksi halde
  // PostgREST fonksiyonu imzasıyla eşleştiremez (PGRST202).
  const nullable = (v: string | null | undefined) => (v ?? null) as unknown as string;
  const { error } = await service.rpc('log_security_event', {
    p_org: nullable(event.orgId),
    p_action: event.action,
    p_actor: nullable(event.actorId),
    p_target_type: nullable(event.targetType),
    p_target_id: nullable(event.targetId),
    p_target_label: nullable(event.targetLabel),
    p_metadata: (event.metadata ?? {}) as Json,
    p_ip_hash: nullable(event.ipHash),
  });
  if (error) console.warn('[audit] log_security_event failed', error.code);
}
