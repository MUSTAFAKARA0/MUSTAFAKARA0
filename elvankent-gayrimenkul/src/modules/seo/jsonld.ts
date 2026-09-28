import { openingHoursSchema, parseOpeningHours } from '@/modules/content/hours';
import { brandingUrl, mediaUrl } from '@/modules/media/variants';
import { siteOgImage } from '@/modules/seo/og';
import { CATEGORY_LABELS, LISTING_TYPE_LABELS } from '@/modules/properties/constants';
import type { PropertyDetail } from '@/modules/properties/types';
import { tenantUrl, type Tenant } from '@/platform/tenant/tenant';

/**
 * Schema.org yapılandırılmış verileri.
 *
 * Google Search Central (Temmuz 2026) desteklenen özellikleri esas alınmıştır:
 *  - Organization / LocalBusiness (RealEstateAgent): LocalBusiness için zorunlu
 *    alanlar name + address'tir; adres girilmemişse Organization kullanılır.
 *  - WebSite: site adı (SearchAction/sitelinks arama kutusu Google tarafından
 *    kaldırıldığı için eklenmez).
 *  - BreadcrumbList.
 *  - BlogPosting (Article).
 * Google'ın emlak ilanı için bir zengin sonuç türü YOKTUR. İlanlarda
 * schema.org'un RealEstateListing tipi (pending.schema.org) yalnızca içeriği
 * tanımlamak için kullanılır; zengin sonuç garantisi yoktur. Gerçek olmayan
 * puan/yorum (aggregateRating, review) ASLA eklenmez.
 */

function absolute(tenant: Tenant, pathOrUrl: string): string {
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : tenantUrl(tenant, pathOrUrl);
}

export function organizationId(tenant: Tenant): string {
  return tenantUrl(tenant, '/#organization');
}

export function organizationJsonLd(tenant: Tenant, seo?: { schemaType: 'RealEstateAgent' | 'LocalBusiness' | 'Organization'; priceRange?: string }) {
  const s = tenant.settings;
  const sameAs = [s.instagram_url, s.facebook_url, s.x_url, s.youtube_url, s.linkedin_url, s.tiktok_url].filter(Boolean);
  const hasAddress = Boolean(s.address_line && s.address_city);
  const logo = brandingUrl(s.logo_url);
  const hours = parseOpeningHours(s.opening_hours);

  return {
    '@context': 'https://schema.org',
    // Adres yoksa yerel işletme türleri kullanılmaz (Google gereği); site SEO ayarı türü seçebilir
    '@type': hasAddress ? (seo?.schemaType ?? 'RealEstateAgent') : 'Organization',
    ...(hasAddress && seo?.priceRange ? { priceRange: seo.priceRange } : {}),
    '@id': organizationId(tenant),
    name: s.display_name,
    ...(s.legal_name ? { legalName: s.legal_name } : {}),
    url: tenantUrl(tenant, '/'),
    ...(logo ? { logo: absolute(tenant, logo) } : {}),
    image: absolute(tenant, siteOgImage(tenant).url),
    ...(s.description || s.tagline ? { description: s.description ?? s.tagline } : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(hasAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: s.address_line,
            ...(s.address_district ? { addressLocality: s.address_district } : {}),
            addressRegion: s.address_city,
            ...(s.postal_code ? { postalCode: s.postal_code } : {}),
            addressCountry: 'TR',
          },
        }
      : {}),
    ...(hasAddress && s.office_latitude !== null && s.office_longitude !== null
      ? { geo: { '@type': 'GeoCoordinates', latitude: Number(s.office_latitude), longitude: Number(s.office_longitude) } }
      : {}),
    ...(hasAddress && hours.length ? { openingHoursSpecification: openingHoursSchema(hours) } : {}),
    ...(s.service_area ? { areaServed: s.service_area } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(tenant: Tenant) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': tenantUrl(tenant, '/#website'),
    name: tenant.settings.display_name,
    url: tenantUrl(tenant, '/'),
    inLanguage: 'tr-TR',
    publisher: { '@id': organizationId(tenant) },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(tenant: Tenant, items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: tenantUrl(tenant, item.path),
    })),
  };
}

function accommodationType(p: PropertyDetail): string {
  if (p.category !== 'konut') return 'Place';
  if (['mustakil-ev', 'villa'].includes(p.typeSlug)) return 'SingleFamilyResidence';
  if (['daire', 'rezidans', 'dubleks'].includes(p.typeSlug)) return 'Apartment';
  return 'Accommodation';
}

export function listingJsonLd(tenant: Tenant, p: PropertyDetail) {
  const url = tenantUrl(tenant, `/ilan/${p.slug}`);
  const place: Record<string, unknown> = {
    '@type': accommodationType(p),
    name: p.title,
    address: {
      '@type': 'PostalAddress',
      addressLocality: [p.neighborhoodName, p.districtName].filter(Boolean).join(', '),
      addressRegion: p.cityName,
      addressCountry: 'TR',
    },
  };
  if (p.grossM2) place.floorSize = { '@type': 'QuantitativeValue', value: p.grossM2, unitCode: 'MTK' };
  if (p.category === 'konut' && p.roomCount !== null) {
    place.numberOfRooms = p.roomCount + (p.livingRoomCount ?? 0);
    place.numberOfBedrooms = p.roomCount;
  }
  if (p.bathroomCount) place.numberOfBathroomsTotal = p.bathroomCount;
  // Yaklaşık/mahalle konumu yanıltıcı olmasın diye yalnızca kesin konum paylaşılır
  if (p.locationPrecision === 'exact' && p.latitude !== null && p.longitude !== null) {
    place.geo = { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    url,
    name: p.title,
    description: p.seoDescription ?? (p.description ?? '').slice(0, 300),
    datePosted: p.publishedAt ?? p.createdAt,
    dateModified: p.updatedAt,
    image: p.images.slice(0, 8).map((img) => absolute(tenant, mediaUrl(img, 1440))),
    identifier: p.referenceNo,
    category: `${LISTING_TYPE_LABELS[p.listingType]} ${CATEGORY_LABELS[p.category]}`,
    about: place,
    ...(p.price
      ? {
          offers: {
            '@type': 'Offer',
            price: p.price,
            priceCurrency: p.currency,
            availability: p.status === 'published' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
            businessFunction:
              p.listingType === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
            seller: { '@id': organizationId(tenant) },
          },
        }
      : {}),
  };
}

export function articleJsonLd(
  tenant: Tenant,
  post: { slug: string; title: string; excerpt: string | null; publishedAt: string; updatedAt: string; imageUrl: string | null },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    url: tenantUrl(tenant, `/blog/${post.slug}`),
    mainEntityOfPage: tenantUrl(tenant, `/blog/${post.slug}`),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    ...(post.imageUrl ? { image: [absolute(tenant, post.imageUrl)] } : {}),
    author: { '@type': 'Organization', name: tenant.settings.display_name, url: tenantUrl(tenant, '/') },
    publisher: { '@id': organizationId(tenant) },
  };
}
