import { formatArea, formatListingPrice } from '@/lib/format';
import { mediaUrl } from '@/modules/media/variants';
import { LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import { getPublicPropertyBySlug } from '@/modules/properties/queries';
import { imageAsJpegDataUrl, OG_SIZE, renderListingOgImage } from '@/modules/seo/og-image';
import { buildTheme } from '@/platform/branding/theme';
import { getTenant } from '@/platform/tenant/tenant';

/** İlanın dinamik paylaşım görseli (/ilan/{slug}/og → /t/{kiracı}/ilan/{slug}/og) */
export async function GET(request: Request, { params }: RouteContext<'/t/[tenant]/ilan/[slug]/og'>) {
  const { tenant: key, slug } = await params;
  const tenant = await getTenant(decodeURIComponent(key));
  if (!tenant) return new Response('Not found', { status: 404 });
  const p = await getPublicPropertyBySlug(tenant.id, decodeURIComponent(slug));
  if (!p) return new Response('Not found', { status: 404 });

  const s = tenant.settings;
  const theme = buildTheme(s.primary_color, s.accent_color);
  const source = p.ogImage ?? p.cover;
  const photo = source ? await imageAsJpegDataUrl(mediaUrl(source, 1440), request.url, OG_SIZE.width, OG_SIZE.height) : null;
  const facts = [p.roomsLabel, formatArea(p.grossM2)].filter((v): v is string => Boolean(v));

  return renderListingOgImage({
    brand: { name: s.display_name, primary: theme.primary, accent: theme.accent, domain: new URL(tenant.baseUrl).host },
    kicker: `${LISTING_TYPE_LABELS[p.listingType]} · ${p.typeName}`,
    title: p.title,
    price: formatListingPrice(p.price, p.currency, p.listingType),
    facts,
    location: [p.neighborhoodName, p.districtName].filter(Boolean).join(', ') || p.cityName,
    referenceNo: p.referenceNo,
    statusLabel: p.status === 'sold' ? 'Satıldı' : p.status === 'rented' ? 'Kiralandı' : p.isDemo ? 'Demo ilan' : null,
    photo,
  });
}
