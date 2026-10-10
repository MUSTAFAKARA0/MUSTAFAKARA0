import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOrigin } from '@/lib/same-origin';
import { createServiceClient } from '@/lib/supabase/server';
import { getRequestFingerprint } from '@/lib/request';

const bodySchema = z.object({
  propertyId: z.uuid(),
  event: z.enum(['view', 'phone_click', 'whatsapp_click', 'favorite_add', 'share', 'qr_visit', 'compare_add']),
});

/**
 * İlan etkileşim olaylarını kaydeder (çerezsiz). Tekrarlı sayım ve kötüye
 * kullanım veritabanı fonksiyonu (track_event) içinde sınırlandırılır.
 * Yanıt her zaman 204'tür; istemciye bilgi sızdırılmaz.
 */
export async function POST(request: Request) {
  const noContent = new NextResponse(null, { status: 204 });
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
  if (/bot|crawler|spider|preview|headless|lighthouse|slurp/i.test(ua)) return noContent;

  const supabase = createServiceClient();
  if (!supabase) return noContent;
  const { sessionHash } = await getRequestFingerprint();
  await supabase.rpc('track_event', {
    p_property_id: parsed.data.propertyId,
    p_event: parsed.data.event,
    p_session_hash: sessionHash,
  });
  return noContent;
}
