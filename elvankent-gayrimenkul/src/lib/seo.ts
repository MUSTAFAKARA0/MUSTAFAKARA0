import { absoluteUrl } from '@/lib/env';
import { imageUrl } from '@/lib/images';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS } from '@/lib/constants';
import type { PropertyDetail, SiteSettings } from '@/types/database';

export function organizationJsonLd(s: SiteSettings) {
  const sameAs = [s.instagram_url, s.facebook_url, s.x_url, s.youtube_url, s.linkedin_url].filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': absoluteUrl('/#organization'),
    name: s.business_name,
    url: absoluteUrl('/'),
    logo: s.logo_url ?? absoluteUrl('/icon.svg'),
    image: absoluteUrl('/og-default.png'),
    ...(s.tagline ? { description: s.tagline } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'TR' } } : {}),
    ...(s.office_latitude && s.office_longitude
      ? { geo: { '@type': 'GeoCoordinates', latitude: Number(s.office_latitude), longitude: Number(s.office_longitude) } }
      : {}),
    areaServed: ['Etimesgut', 'Elvankent', 'Eryaman', 'Ankara'],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function schemaTypeFor(p: PropertyDetail): string {
  if (p.category === 'arsa' || p.category === 'isyeri') return 'Place';
  if (p.type.slug === 'mustakil-ev' || p.type.slug === 'villa') return 'SingleFamilyResidence';
  return 'Apartment';
}

/** Gayrimenkul ilanı için Schema.org RealEstateListing + Offer */
export function propertyJsonLd(p: PropertyDetail, s: SiteSettings) {
  const url = absoluteUrl(`/ilan/${p.slug}`);
  const locality = [p.neighborhood?.name, p.district.name].filter(Boolean).join(', ');
  const place: Record<string, unknown> = {
    '@type': schemaTypeFor(p),
    name: p.title,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locality,
      addressRegion: p.city.name,
      addressCountry: 'TR',
    },
  };
  if (p.gross_m2) place.floorSize = { '@type': 'QuantitativeValue', value: p.gross_m2, unitCode: 'MTK' };
  if (p.room_count !== null && p.category === 'konut') place.numberOfRooms = p.room_count + (p.living_room_count ?? 0);
  if (p.bathroom_count) place.numberOfBathroomsTotal = p.bathroom_count;
  if (p.location_precision === 'exact' && p.public_latitude && p.public_longitude) {
    place.geo = { '@type': 'GeoCoordinates', latitude: p.public_latitude, longitude: p.public_longitude };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    url,
    name: p.title,
    description: p.meta_description ?? p.description.slice(0, 300),
    datePosted: p.published_at ?? p.created_at,
    dateModified: p.updated_at,
    image: p.images.slice(0, 8).map((img) => {
      const src = imageUrl(img.storage_path);
      return src.startsWith('/') ? absoluteUrl(src) : src;
    }),
    identifier: String(p.listing_no),
    category: `${LISTING_TYPE_LABELS[p.listing_type]} ${CATEGORY_LABELS[p.category]}`,
    about: place,
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.currency,
      availability: 'https://schema.org/InStock',
      businessFunction: p.listing_type === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
      seller: { '@id': absoluteUrl('/#organization'), name: s.business_name },
    },
  };
}
