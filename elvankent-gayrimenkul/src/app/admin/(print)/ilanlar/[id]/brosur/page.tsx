import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { mediaUrl } from '@/modules/media/variants';
import { formatArea, formatDate, formatListingPrice, formatNumber, formatPhoneDisplay } from '@/lib/format';
import { DEED_STATUS_LABELS, floorLabel, HEATING_LABELS, LISTING_TYPE_LABELS, PARKING_LABELS } from '@/modules/properties/constants';
import { getPropertyForPreview } from '@/modules/properties/queries';
import { brandingUrl } from '@/modules/media/variants';
import { requirePageContext } from '@/platform/auth/session';
import { getTenant, tenantUrl } from '@/platform/tenant/tenant';
import { PrintToolbar } from './print-toolbar';

export const metadata: Metadata = { title: 'İlan broşürü' };

/**
 * Yazdırılabilir A4 broşür (tarayıcının "PDF olarak kaydet" özelliğiyle PDF).
 * Sunucu tarafında PDF motoru gerektirmez; görseller web varyantlarından gelir.
 */
export default async function BrochurePage({ params }: PageProps<'/admin/ilanlar/[id]/brosur'>) {
  const ctx = await requirePageContext();
  const { id } = await params;
  if (!ctx.plan.features.pdf) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-display text-2xl">PDF broşür planınızda bulunmuyor</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu özelliği kullanmak için planınızı yükseltin.</p>
      </main>
    );
  }
  const result = await getPropertyForPreview(ctx.supabase, id);
  if (!result || result.property.organizationId !== ctx.org.id) notFound();
  const p = result.property;
  const tenant = await getTenant(ctx.org.slug);
  const s = tenant?.settings;
  const url = tenant ? tenantUrl(tenant, `/ilan/${p.slug}?kaynak=qr`) : `/ilan/${p.slug}`;
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b1f1c', light: '#ffffff' } });
  const photos = p.images.slice(0, 5);
  const location = [p.neighborhoodName, p.districtName, p.cityName].filter(Boolean).join(', ');
  const description = (p.description ?? '').length > 1400 ? `${(p.description ?? '').slice(0, 1400).trimEnd()}…` : (p.description ?? '');
  const facts = [
    { label: 'Brüt alan', value: formatArea(p.grossM2) },
    { label: 'Net alan', value: formatArea(p.netM2) },
    { label: 'Oda', value: p.roomsLabel },
    { label: 'Kat', value: floorLabel(p.floor, p.totalFloors) },
    { label: 'Bina yaşı', value: p.buildingAge === null ? null : p.buildingAge === 0 ? 'Sıfır' : String(p.buildingAge) },
    { label: 'Isıtma', value: p.heating ? (HEATING_LABELS[p.heating] ?? p.heating) : null },
    { label: 'Otopark', value: p.parking ? (PARKING_LABELS[p.parking] ?? p.parking) : null },
    { label: 'Tapu', value: p.deedStatus ? (DEED_STATUS_LABELS[p.deedStatus] ?? p.deedStatus) : null },
    { label: 'Aidat', value: p.dues ? `${formatNumber(p.dues)} ₺` : null },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));
  const logo = brandingUrl(s?.logo_url);

  return (
    <>
      <style>{`@page { size: A4; margin: 11mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar backHref={`/admin/ilanlar/${p.id}?adim=yayin`} />
      <main className="mx-auto my-6 max-w-[210mm] bg-white p-[11mm] text-[#16201e] shadow-lg print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[var(--primary)] pb-4">
          <div>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={s?.display_name ?? ''} className="h-12 w-auto object-contain" />
            ) : (
              <p className="font-display text-2xl text-[var(--primary)]">{s?.display_name ?? ctx.org.name}</p>
            )}
            {s?.tagline && <p className="mt-1 text-[11px] text-[#5b6563]">{s.tagline}</p>}
          </div>
          <div className="text-right text-[11px] leading-relaxed text-[#3d4745]">
            {s?.phone && <p className="text-[13px] font-bold">{formatPhoneDisplay(s.phone)}</p>}
            {s?.email && <p>{s.email}</p>}
            {s?.address_line && <p>{[s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ')}</p>}
          </div>
        </header>

        <section className="mt-5 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--accent-ink)] uppercase">
              {LISTING_TYPE_LABELS[p.listingType]} · {p.typeName} · İlan no {p.referenceNo}
            </p>
            <h1 className="mt-1.5 font-display text-[26px] leading-tight">{p.title}</h1>
            <p className="mt-1 text-[12.5px] text-[#5b6563]">{location}</p>
          </div>
          <p className="numeric shrink-0 text-right text-[24px] font-bold text-[var(--primary)]">{formatListingPrice(p.price, p.currency, p.listingType)}</p>
        </section>

        {photos.length > 0 && (
          <section className="mt-4 grid grid-cols-4 gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(photos[0], 1440)} alt="" className="col-span-4 aspect-[16/8] w-full rounded-md object-cover" />
            {photos.slice(1, 5).map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id} src={mediaUrl(img, 640)} alt="" className="aspect-[4/3] w-full rounded-md object-cover" />
            ))}
          </section>
        )}

        <section className="mt-5 grid grid-cols-[1fr_46mm] gap-6">
          <div>
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2.5 rounded-lg bg-[#f4f2ee] p-3.5">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-[9.5px] font-bold tracking-wide text-[#6b7472] uppercase">{f.label}</dt>
                  <dd className="numeric text-[12.5px] font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
            {description && <p className="mt-4 text-[11.5px] leading-relaxed whitespace-pre-line text-[#2a3431]">{description}</p>}
            {p.features.length > 0 && (
              <p className="mt-3 text-[10.5px] leading-relaxed text-[#3d4745]">
                <strong>Özellikler:</strong> {p.features.map((f) => f.label).join(' · ')}
              </p>
            )}
          </div>
          <aside className="flex flex-col items-center text-center">
            <div className="w-[40mm]" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="İlan sayfasının QR kodu" />
            <p className="mt-2 text-[10px] leading-snug text-[#5b6563]">Tüm fotoğraflar, konum ve güncel bilgiler için okutun.</p>
          </aside>
        </section>

        <footer className="mt-6 border-t border-[#d9d5ce] pt-3 text-[9px] leading-relaxed text-[#6b7472]">
          {p.isDemo && <p className="font-bold">DEMO İLAN: Gerçek bir gayrimenkulü temsil etmez.</p>}
          <p>
            Bu broşürdeki bilgiler bilgilendirme amaçlıdır; tapu, imar ve diğer resmi bilgiler işlem öncesinde ilgili kurumlardan teyit edilmelidir. Hazırlanma tarihi:{' '}
            {formatDate(new Date())}.
          </p>
        </footer>
      </main>
    </>
  );
}
