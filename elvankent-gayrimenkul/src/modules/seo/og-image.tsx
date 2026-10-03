import 'server-only';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { publicEnv } from '@/lib/env';

/**
 * Dinamik paylaşım görselleri (Open Graph / X kartı, 1200×630 PNG).
 *
 * - Fontlar depoda TTF olarak tutulur (assets/fonts, SIL OFL): ImageResponse
 *   yalnızca ttf/otf/woff okur ve varsayılan fontu Türkçe karakterlerin
 *   tamamını garanti etmez.
 * - ImageResponse (Satori) WebP/AVIF okuyamaz; kapak fotoğrafı sunucuda sharp
 *   ile JPEG'e çevrilip gömülür.
 * - Yalnızca kendi alanımızdaki (/demo/...) veya Supabase depolamasındaki
 *   görseller okunur (SSRF koruması).
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

type FontWeight = 400 | 500 | 700;
interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
}

let fontsPromise: Promise<OgFont[]> | null = null;

async function loadFont(file: string, name: string, weight: FontWeight): Promise<OgFont> {
  const buf = await readFile(join(process.cwd(), 'assets', 'fonts', file));
  return { name, weight, style: 'normal', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
}

export function ogFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all([
    loadFont('Manrope-Medium.ttf', 'Manrope', 500),
    loadFont('Manrope-Bold.ttf', 'Manrope', 700),
    // Başlık fontu: DM Serif Display (Fraunces'in bileşik glifleri — ör. "+" — Satori'de hatalı çiziliyor)
    loadFont('DMSerifDisplay-Regular.ttf', 'DisplaySerif', 400),
  ]).catch((error) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}

function allowedRemote(url: URL): boolean {
  const supabase = publicEnv.supabaseUrl ? new URL(publicEnv.supabaseUrl) : null;
  const storage = publicEnv.storageUrl ? new URL(publicEnv.storageUrl) : null;
  return [supabase?.origin, storage?.origin].includes(url.origin) && url.pathname.includes('/storage/v1/object/public/');
}

async function readSource(src: string, requestUrl: string): Promise<Buffer | null> {
  if (src.startsWith('/')) {
    // Yerel dosya (public/demo...). Dizin dışına çıkış engellenir.
    const safe = normalize(src).replace(/^(\.\.[/\\])+/, '');
    if (safe.startsWith('/demo/') || safe.startsWith('/og-')) {
      try {
        return await readFile(join(process.cwd(), 'public', safe));
      } catch {
        // Sunucusuz ortamda public/ klasörü paket dışında olabilir → HTTP ile dene
      }
      const res = await fetch(new URL(safe, requestUrl), { cache: 'force-cache' }).catch(() => null);
      return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    return null;
  }
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (!allowedRemote(url)) return null;
  const res = await fetch(url, { next: { revalidate: 86_400 } }).catch(() => null);
  if (!res?.ok) return null;
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > 15 * 1024 * 1024) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Görseli verilen boyuta kırpıp JPEG data URL'e çevirir (başarısızsa null) */
export async function imageAsJpegDataUrl(src: string | null | undefined, requestUrl: string, width: number, height: number): Promise<string | null> {
  if (!src) return null;
  try {
    const input = await readSource(src, requestUrl);
    if (!input) return null;
    const jpeg = await sharp(input, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface OgBrand {
  name: string;
  primary: string;
  accent: string;
  domain: string;
}

function BrandChip({ brand }: { brand: OgBrand }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          width: 46,
          height: 46,
          borderRadius: 12,
          background: brand.accent,
          color: '#fff',
          fontFamily: 'DisplaySerif',
          fontSize: 28,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {brand.name.trim().charAt(0).toLocaleUpperCase('tr-TR')}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Manrope', fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: -0.3 }}>{brand.name}</div>
    </div>
  );
}

function headers(): Record<string, string> {
  // URL'de sürüm parametresi (?v=) bulunduğu için CDN'de uzun süre saklanabilir
  return { 'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800' };
}

export async function renderSiteOgImage(opts: { brand: OgBrand; headline: string; subline: string | null; photo: string | null }) {
  const { brand, headline, subline, photo } = opts;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: brand.primary, fontFamily: 'Manrope' }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={photo} width={OG_SIZE.width} height={OG_SIZE.height} style={{ position: 'absolute', top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height, objectFit: 'cover' }} />
        )}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            background: photo
              ? 'linear-gradient(90deg, rgba(10,14,13,0.86) 0%, rgba(10,14,13,0.62) 55%, rgba(10,14,13,0.25) 100%)'
              : `linear-gradient(135deg, ${brand.primary} 0%, rgba(0,0,0,0.35) 100%)`,
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', width: '100%' }}>
          <BrandChip brand={brand} />
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
            <div style={{ display: 'flex', fontFamily: 'DisplaySerif', fontSize: 68, lineHeight: 1.08, color: '#fff', letterSpacing: -1 }}>
              {truncate(headline, 80)}
            </div>
            {subline && (
              <div style={{ display: 'flex', marginTop: 22, fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>
                {truncate(subline, 120)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            <div style={{ display: 'flex', width: 40, height: 4, borderRadius: 2, background: brand.accent }} />
            {brand.domain}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: headers() },
  );
}

export async function renderListingOgImage(opts: {
  brand: OgBrand;
  kicker: string;
  title: string;
  price: string;
  facts: string[];
  location: string;
  referenceNo: string;
  statusLabel: string | null;
  photo: string | null;
}) {
  const { brand, kicker, title, price, facts, location, referenceNo, statusLabel, photo } = opts;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', background: brand.primary, fontFamily: 'Manrope' }}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={photo} width={OG_SIZE.width} height={OG_SIZE.height} style={{ position: 'absolute', top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height, objectFit: 'cover' }} />
        )}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            background: 'linear-gradient(180deg, rgba(8,12,11,0.35) 0%, rgba(8,12,11,0.08) 32%, rgba(8,12,11,0.72) 64%, rgba(8,12,11,0.92) 100%)',
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 60px 52px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BrandChip brand={brand} />
            <div style={{ display: 'flex', gap: 12 }}>
              {statusLabel && (
                <div style={{ display: 'flex', padding: '8px 16px', borderRadius: 999, background: '#fff', color: '#16201e', fontSize: 20, fontWeight: 700 }}>
                  {statusLabel}
                </div>
              )}
              <div style={{ display: 'flex', padding: '8px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20, fontWeight: 700 }}>
                {referenceNo}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
              {kicker}
            </div>
            <div style={{ display: 'flex', marginTop: 12, fontFamily: 'DisplaySerif', fontSize: 54, lineHeight: 1.1, color: '#fff', letterSpacing: -0.8, maxWidth: 1040 }}>
              {truncate(title, 78)}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, color: '#fff', letterSpacing: -1 }}>{price}</div>
                <div style={{ display: 'flex', marginTop: 8, fontSize: 25, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                  {[location, ...facts].filter(Boolean).join('  ·  ')}
                </div>
              </div>
              <div style={{ display: 'flex', fontSize: 21, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{brand.domain}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(), headers: headers() },
  );
}
