'use client';

import { startTransition, useRef, useState, type KeyboardEvent } from 'react';
import { LivePreview } from '@/theme-engine/preview/live-preview';
import { DeviceFrame } from '@/components/karay/device-frame';
import { cn } from '@/lib/utils';
import type { SiteConfig } from '@/site-config/schema';
import { THEME_LIST, THEMES } from '@/theme-engine/themes';

const HERO = { overlay: 'Görsel üstü', centered: 'Ortalı', split: 'Bölünmüş' } as const;
const BUTTON = { rounded: 'Yuvarlak', pill: 'Hap', square: 'Köşeli' } as const;
const CARD = { elevated: 'Gölgeli', outline: 'Çerçeveli', flat: 'Düz' } as const;
const TONE = { light: 'Açık', dark: 'Koyu', brand: 'Marka rengi' } as const;
/** Seçili temanın gerçek tanım alanları (tema motorunun verisi) */
function traits(t: (typeof THEMES)[keyof typeof THEMES]): [string, string][] {
  return [
    ['Hero', HERO[t.hero]],
    ['Düğme', BUTTON[t.button]],
    ['Kart', CARD[t.card]],
    ['Header', TONE[t.header]],
    ['Footer', TONE[t.footer]],
  ];
}

/**
 * KARAY sayfasındaki tema vitrini (koyu sahne). Önizleme, emlak ofisi sitelerinin kullandığı GERÇEK tema
 * motoruyla (aynı tokenlar, aynı CSS) çizilir; örnek marka adı "Örnek Gayrimenkul"dür
 * (gerçek bir müşteri değildir). Her tema kendi önerilen paletiyle gösterilir.
 * Varsayılan yapılandırma sunucuda üretilip verilir: şema doğrulayıcısı (zod) tarayıcıya gitmez.
 * Radyo grubu klavyeyle gezilir (ok tuşları, Home/End; "roving tabindex").
 */
export function ThemeShowcase({ baseConfig }: { baseConfig: SiteConfig }) {
  const [active, setActiveNow] = useState(THEME_LIST[0].id);
  // Geçiş: önizleme yazı tipi/stil dosyası yüklenirken eski görünüm kalır (Suspense gizlemez, odak kaybolmaz)
  const setActive = (id: typeof active) => startTransition(() => setActiveNow(id));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const theme = THEMES[active];
  const config: SiteConfig = { ...baseConfig, theme: active, colors: { mode: 'preset' as const, preset: theme.palette, scheme: 'light' as const } };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = THEME_LIST.length - 1;
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const target = (next + THEME_LIST.length) % THEME_LIST.length;
    setActive(THEME_LIST[target].id);
    refs.current[target]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <div className="min-w-0 lg:sticky lg:top-24">
        <div role="radiogroup" aria-label="Tema seçin" className="ky-chips-row -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pt-1 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0">
          {THEME_LIST.map((t, i) => {
            const on = active === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(t.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  'ky-theme-chip min-w-[8.5rem] shrink-0 snap-start rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc0ff] lg:min-w-0',
                  on ? 'border-white bg-white text-[#0b1b3a]' : 'border-white/20 bg-white/[0.06] text-white hover:border-white/50 hover:bg-white/10',
                )}
              >
                <span className="block text-[15px] font-semibold">{t.name}</span>
                <span className={cn('mt-0.5 hidden text-[12.5px] leading-snug lg:block', on ? 'text-[#33415c]' : 'text-white/75')}>{t.audience}</span>
              </button>
            );
          })}
        </div>
        <div className="ky-theme-card mt-5 hidden lg:block">
          <p className="text-[12.5px] font-semibold tracking-[0.12em] text-[#9fc0ff] uppercase">Seçili tema</p>
          <p className="mt-1.5 text-[1.5rem] leading-tight font-semibold tracking-tight">{theme.name}</p>
          <p className="mt-1 text-[14.5px] text-white/80">{theme.audience}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {traits(theme).map(([k, v]) => (
              <li key={k} className="ky-trait">
                <span>{k}</span> {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative min-w-0">
        <div aria-hidden className="ky-theme-glow" />
        <div className="relative mx-auto max-w-md">
          {/* key: tema değişince önizleme yeniden bağlanır ve CSS "swap" girişi oynar (yalnızca hareket serbestken) */}
          <div key={active} className="ky-swap">
            <DeviceFrame title={`${theme.name} teması · örnek site`}>
              <LivePreview config={config} brand={{ primary_color: null, accent_color: null }} darkAllowed name="Örnek Gayrimenkul" label={`${theme.name} teması örnek site önizlemesi`} />
            </DeviceFrame>
          </div>
        </div>
        <p aria-live="polite" className="mx-auto mt-5 max-w-md text-center text-[14px] leading-relaxed text-white/85">
          <span className="font-semibold text-white">{theme.name}:</span> {theme.description}
        </p>
      </div>
    </div>
  );
}
