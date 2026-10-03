'use client';

import { useState } from 'react';
import { LivePreview } from '@/theme-engine/preview/live-preview';
import { cn } from '@/lib/utils';
import type { SiteConfig } from '@/platform/site/schema';
import { THEME_LIST, THEMES } from '@/theme-engine/themes';

/**
 * KARAY sayfasındaki tema vitrini. Önizleme, emlak ofisi sitelerinin kullandığı GERÇEK tema
 * motoruyla (aynı tokenlar, aynı CSS) çizilir; örnek marka adı "Örnek Gayrimenkul"dür
 * (gerçek bir müşteri değildir). Her tema kendi önerilen paletiyle gösterilir.
 * Varsayılan yapılandırma sunucuda üretilip verilir: şema doğrulayıcısı (zod) tarayıcıya gitmez.
 */
export function ThemeShowcase({ baseConfig }: { baseConfig: SiteConfig }) {
  const [active, setActive] = useState(THEME_LIST[0].id);
  const theme = THEMES[active];
  const config: SiteConfig = { ...baseConfig, theme: active, colors: { mode: 'preset' as const, preset: theme.palette, scheme: 'light' as const } };
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start">
      <div role="radiogroup" aria-label="Tema seçin" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {THEME_LIST.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active === t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              'rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6bff]',
              active === t.id ? 'border-[#0b1b3a] bg-[#0b1b3a] text-white' : 'border-[#dfe5ee] bg-white text-[#0b1b3a] hover:border-[#9aa8c0]',
            )}
          >
            <span className="block text-[15px] font-semibold">{t.name}</span>
            <span className={cn('mt-0.5 hidden text-[12.5px] leading-snug lg:block', active === t.id ? 'text-white/75' : 'text-[#5b6b85]')}>{t.audience}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        <div className="mx-auto max-w-md">
          <LivePreview config={config} brand={{ primary_color: null, accent_color: null }} darkAllowed={false} name="Örnek Gayrimenkul" label={`${theme.name} teması örnek site önizlemesi`} />
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-[14px] leading-relaxed text-[#33415c]">
          <span className="font-semibold text-[#0b1b3a]">{theme.name}:</span> {theme.description}
        </p>
      </div>
    </div>
  );
}
