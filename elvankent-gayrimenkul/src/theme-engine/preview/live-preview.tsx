'use client';

import { useId, useMemo } from 'react';
import { Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme } from '@/theme-engine/runtime';
import type { ThemeInput } from '@/theme-engine/types';
import { THEMES } from '@/theme-engine/themes';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';

export type Brand = { primary_color: string | null; accent_color: string | null; logoUrl?: string | null; tagline?: string | null };

/**
 * Önizlemenin girdisi: tema verisi + örnek header'ın gösterdiği birkaç alan. Site
 * yapılandırması (SiteConfig) bunu yapısal olarak karşılar; Theme Engine site
 * yapılandırmasının tamamına bağımlı değildir.
 */
export interface ThemePreviewInput extends ThemeInput {
  header: {
    style?: 'light' | 'dark';
    brand: 'auto' | 'logo' | 'logo-name' | 'name';
    showTagline: boolean;
    showFavorites: boolean;
    cta?: { label: string; href: string };
  };
}

/**
 * Canlı önizleme: seçilen tema/renk/yazı tipi/header/bileşen stilleriyle küçük bir site
 * örneği. Gerçek sitenin AYNI token üreticisini (siteCss), aynı tema çözümleyicisini
 * (resolveStyle) ve aynı CSS kancalarını (data-site-*, card-lift, site-media, eyebrow, btn,
 * site-footer) kullanır; ayrı bir sahte stil sistemi yoktur. Kaydedilmemiş değerler
 * tarayıcıda hesaplanır.
 *   variant="full"  → header, hero, arama, ilan kartları, ilan detayı, çağrı bandı, footer
 *   variant="thumb" → tema galerisi küçük görünümü (header, hero, kartlar)
 */
export function LivePreview({
  config,
  brand,
  darkAllowed,
  name,
  variant = 'full',
  label = 'Canlı önizleme',
}: {
  config: ThemePreviewInput;
  brand: Brand;
  darkAllowed: boolean;
  name: string;
  variant?: 'full' | 'thumb';
  label?: string;
}) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  // Yayındaki siteyle AYNI çalışma zamanı: tema verisi → CSS değişkenleri + öznitelikler
  const { css, attributes, style } = useMemo(
    () => applyTheme(config, brand, darkAllowed, `[data-live-preview="${id}"]`),
    [config, brand, darkAllowed, id],
  );
  // Yazı tipleri: yalnızca önizlenen başlık/gövde ailesi, statik dosyadan (<link>) yüklenir;
  // katalog verisi JavaScript paketine girmez (bkz. scripts/fonts/build-site-fonts.mjs)
  const theme = THEMES[config.theme];
  const fontIds = [...new Set([config.typography.heading ?? theme.fonts.heading, config.typography.body ?? theme.fonts.body])];
  const fontVars = Object.fromEntries(fontIds.map((f) => [FONT_CATALOG[f].cssVar, `"${FONT_CATALOG[f].name}", "${FONT_CATALOG[f].name} Fallback"`]));
  const h = config.header;
  const thumb = variant === 'thumb';
  const showLogo = Boolean(brand.logoUrl) && h.brand !== 'name';
  const showName = !showLogo || h.brand === 'logo-name';
  const search = (
    <div className="flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-3 text-left text-foreground shadow-md">
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">Konum</span>
        <span className="block truncate text-[12px] font-semibold">Tüm bölgeler</span>
      </span>
      {!thumb && (
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">Tip</span>
          <span className="block truncate text-[12px] font-semibold">Daire</span>
        </span>
      )}
      <Button size="sm" tabIndex={-1}>
        <Search /> Ara
      </Button>
    </div>
  );
  const photo = 'bg-[linear-gradient(160deg,#c9d3d6,#98a6ab)]';
  return (
    // Önizleme, tema CSS'ini ve önizlenen yazı tiplerini kendisi getirir: KARAY platformu ve
    // KARAY sayfasının kökleri bunları yüklemez (yalnızca önizlemenin bulunduğu sayfalar yükler)
    <div aria-label={label} role="img" style={fontVars} className="overflow-hidden rounded-2xl border border-border shadow-sm">
      {fontIds.map((f) => (
        <link key={f} rel="stylesheet" href={`/fonts/site/${f}/preview.css`} precedence="default" />
      ))}
      <style>{css}</style>
      <div
        data-live-preview={id}
        {...attributes}
        className="pointer-events-none bg-background font-sans text-foreground select-none"
      >
        {/* Header */}
        <div className="site-header">
        <div data-header-style={style.header} className={`site-header-bar flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 text-foreground ${style.headerLayout === 'centered' ? 'flex-col justify-center' : 'justify-between'}`}>
          <span className="flex min-w-0 items-center gap-2">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- depolamadaki logo (önizleme)
              <img src={brand.logoUrl!} alt="" className="h-7 w-auto max-w-[110px] object-contain" />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-[11px] font-semibold text-primary-fg">
                {name.slice(0, 1).toLocaleUpperCase('tr-TR')}
              </span>
            )}
            {showName && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-[13.5px] font-semibold">{name}</span>
                {h.showTagline && brand.tagline && <span className="block truncate text-[10px] text-muted-foreground">{brand.tagline}</span>}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {h.showFavorites && <Heart className="size-4 text-foreground/70" aria-hidden />}
            <Button size="xs" tabIndex={-1}>
              {h.cta?.label ?? 'Bize ulaşın'}
            </Button>
          </span>
        </div>
        </div>
        {/* Hero */}
        {style.hero === 'overlay' && (
          <div className="site-media relative m-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#5b6b72,#2b3438)] px-4 pt-8 pb-4 text-white">
            <p className="text-[9.5px] font-bold tracking-[0.2em] text-white/75 uppercase">{name}</p>
            <h3 className="mt-1.5 font-display text-[1.45rem] leading-[1.1]">Size uygun gayrimenkulü bulun.</h3>
            <div className="mt-4">{search}</div>
          </div>
        )}
        {style.hero === 'centered' && (
          <div className="px-4 pt-7 pb-5 text-center">
            <p className="eyebrow justify-center">{name}</p>
            <h3 className="mx-auto mt-2 max-w-xs font-display text-[1.5rem] leading-[1.1]">Size uygun gayrimenkulü bulun.</h3>
            <div className="mx-auto mt-4 max-w-sm">{search}</div>
          </div>
        )}
        {style.hero === 'split' && (
          <div className="grid grid-cols-[1.2fr_1fr] items-center gap-3 px-4 pt-6 pb-4">
            <div className="min-w-0">
              <p className="eyebrow eyebrow-line">{name}</p>
              <h3 className="mt-2 font-display text-[1.3rem] leading-[1.1]">Size uygun gayrimenkulü bulun.</h3>
            </div>
            <div className={`site-media aspect-[4/3] rounded-xl ${photo}`} />
            <div className="col-span-2">{search}</div>
          </div>
        )}
        {style.hero === 'cinematic' && (
          <div className="relative">
            <div className="hero-media relative bg-[linear-gradient(160deg,#4b5a61,#1d2427)] px-4 pt-12 pb-12 text-white">
              <p className="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] uppercase ring-1 ring-white/25">Ankara · Çankaya</p>
              <h3 className="mt-2 font-display text-[1.85rem] leading-[1]">Size uygun gayrimenkulü bulun.</h3>
            </div>
            <div className="relative z-10 mx-3 -mt-6 rounded-2xl bg-surface/80 p-1 shadow-lg">{search}</div>
          </div>
        )}
        {style.hero === 'editorial' && (
          <div className="grid grid-cols-[1.25fr_1fr] items-end gap-3 px-4 pt-6 pb-4">
            <div className="min-w-0">
              <p className="eyebrow eyebrow-line">{name}</p>
              <h3 className="mt-2 font-display text-[1.6rem] leading-[1.02]">Size uygun gayrimenkulü bulun.</h3>
              <p className="mt-2 border-t border-border pt-1.5 text-[10px] text-muted-foreground"><span className="font-display text-[15px] text-foreground">24</span> yayında ilan</p>
            </div>
            <div className={`site-media aspect-[4/5] rounded-xl ${photo}`} />
            <div className="col-span-2">{search}</div>
          </div>
        )}
        {style.hero === 'showcase' && (
          <div className="px-4 pt-5 pb-4">
            <h3 className="font-display text-[1.35rem] leading-[1.05]">Size uygun gayrimenkulü bulun.</h3>
            <div className="relative mt-3">
              <div className={`site-media aspect-[16/9] rounded-xl ${photo}`} />
              <div className="relative z-10 mx-2 -mt-5 rounded-xl bg-surface p-2.5 shadow-md ring-1 ring-black/5">
                <p className="text-[13px] font-bold text-primary-ink">₺4.250.000</p>
                <p className="truncate text-[11px] font-semibold">Bahçeli 3+1 daire</p>
              </div>
            </div>
            <div className="mt-3">{search}</div>
          </div>
        )}
        {/* Kartlar */}
        <div className="px-4 pb-4">
          <p className="eyebrow eyebrow-line">Öne çıkanlar</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="property-card card-lift relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <div className={`pc-media site-media aspect-[4/3] ${photo}`} />
                <div className="pc-body flex flex-col p-2.5">
                  <p className="pc-price text-[14px] font-bold text-primary-ink">₺{i === 1 ? '4.250.000' : '18.500 / ay'}</p>
                  <p className="pc-title truncate text-[11.5px] font-semibold">{i === 1 ? 'Satılık 3+1 daire' : 'Kiralık 2+1 daire'}</p>
                  <p className="pc-location text-[10.5px] text-muted-foreground">3+1 · 125 m² · 4. kat</p>
                </div>
              </div>
            ))}
          </div>
          {!thumb && (
            <>
              {/* İlan detayı */}
              <div className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_1fr] rounded-2xl border border-border bg-surface p-3">
                <div className={`site-media aspect-[4/3] rounded-xl ${photo}`} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground">İlan detayı</p>
                  <p className="mt-0.5 font-display text-[14px] leading-tight">Bahçeli 3+1 daire</p>
                  <p className="mt-1 text-[15px] font-bold text-primary-ink">₺4.250.000</p>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-2 text-[10px]">
                    <dt className="text-muted-foreground">Net</dt>
                    <dd className="font-semibold">110 m²</dd>
                    <dt className="text-muted-foreground">Kat</dt>
                    <dd className="font-semibold">4 / 8</dd>
                  </dl>
                  <Button size="xs" className="mt-2 w-full" tabIndex={-1}>
                    Bilgi al
                  </Button>
                </div>
              </div>
              {/* Çağrı bandı */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-inverse px-4 py-4 text-inverse-foreground">
                <p className="font-display text-[14px] leading-snug">Mülkünüzü satmak mı istiyorsunuz?</p>
                <Button size="xs" variant="inverse" tabIndex={-1}>
                  Değerleme talebi
                </Button>
              </div>
            </>
          )}
        </div>
        {/* Footer */}
        {!thumb && (
          <div className="site-footer bg-surface-inverse px-4 py-3 text-[11px] text-inverse-foreground/80">
            <span className="font-semibold text-inverse-foreground">{name}</span> · © {new Date().getFullYear()} · KVKK · Gizlilik
          </div>
        )}
      </div>
    </div>
  );
}

