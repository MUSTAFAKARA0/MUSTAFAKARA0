import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/same-origin';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestFingerprint } from '@/lib/request';

const bodySchema = z.object({
  propertyId: z.uuid(),
  event: z.enum(['view', 'phone_click', 'whatsapp_click', 'favorite_add', 'share']),
});

/**
 * İlan etkileşim olaylarını kaydeder. Tekrarlı sayım ve kötüye kullanım
 * veritabanı fonksiyonu (track_property_event) içinde sınırlandırılır.
 * Yanıt her zaman 204'tür; istemciye bilgi sızdırılmaz.
 */
export async function POST(request: Request) {
  const noContent = new NextResponse(null, { status: 204 });
  // sendBeacon aynı kaynaktan Origin başlığı gönderir; başka sitelerden gelen istekler yok sayılır
  if (request.headers.get('origin') && !isSameOrigin(request)) return noContent;

  let json: unknown;
  try {
    const text = await request.text();
    if (text.length > 500) return noContent;
    json = JSON.parse(text);
  } catch {
    return noContent;
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return noContent;

  const ua = request.headers.get('user-agent') ?? '';
  if (/bot|crawler|spider|preview|headless|lighthouse/i.test(ua)) return noContent;

  const supabase = createServiceClient();
  if (!supabase) return noContent;
  const { sessionHash } = await getRequestFingerprint();
  await supabase.rpc('track_property_event', {
    p_property_id: parsed.data.propertyId,
    p_event: parsed.data.event,
    p_session_hash: sessionHash,
  });
  return noContent;
}
