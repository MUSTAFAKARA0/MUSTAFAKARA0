import QRCode from 'qrcode';
import { isUuid } from '@/lib/utils';
import { getOrgContext } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';

/**
 * İlan QR kodu (PNG veya baskı için SVG). Kod, ilanın herkese açık adresini
 * `?kaynak=qr` ile açar → ziyaretler istatistiklerde "QR" olarak sayılır.
 * Yalnızca ilanın organizasyonundaki, ilanları görüntüleme yetkisi olan
 * kullanıcılar üretebilir.
 */
export async function GET(request: Request, { params }: RouteContext<'/api/admin/properties/[id]/qr'>) {
  const ctx = await getOrgContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });
  if (!ctx.can('properties.read')) return new Response('Forbidden', { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return new Response('Not found', { status: 404 });

  const { data: property } = await ctx.supabase
    .from('properties')
    .select('slug, reference_no, organization_id')
    .eq('id', id)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();
  if (!property) return new Response('Not found', { status: 404 });

  const tenant = await getTenant(ctx.org.slug);
  const target = tenant ? tenantUrl(tenant, `/ilan/${property.slug}?kaynak=qr`) : `/ilan/${property.slug}?kaynak=qr`;
  const format = new URL(request.url).searchParams.get('format') === 'svg' ? 'svg' : 'png';
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${property.reference_no}-qr.${format}"`,
  };
  const options = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#0b1f1c', light: '#ffffff' } };

  if (format === 'svg') {
    const svg = await QRCode.toString(target, { ...options, type: 'svg' });
    return new Response(svg, { headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8' } });
  }
  const png = await QRCode.toBuffer(target, { ...options, type: 'png', width: 1024 });
  return new Response(new Uint8Array(png), { headers: { ...headers, 'Content-Type': 'image/png' } });
}
