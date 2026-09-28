'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { SaveBar, useSectionSave } from '@/components/platform/site/site-actions';
import { FONT_CATALOG } from '@/platform/site/font-catalog';
import { PALETTES, findPalette } from '@/platform/site/palettes';
import { FONT_IDS, type ColorTokens, type ColorsConfig, type FontId, type SiteConfig, type StyleConfig, type ThemeId, type TypographyConfig } from '@/platform/site/schema';
import { resolveStyle, THEME_LIST, THEMES } from '@/platform/site/themes';
import { resolveColors, siteCss } from '@/platform/site/tokens';

export type Brand = { primary_color: string | null; accent_color: string | null; logoUrl?: string | null; tagline?: string | null };

/**
 * Canlı önizleme: seçilen tema/renk/yazı tipi/header/bileşen stilleriyle küçük bir site
 * örneği. Gerçek sitenin AYNI token üreticisini (siteCss) ve aynı CSS kancalarını
 * (data-site-*, card-lift, btn, site-footer) kullanır; ayrı bir sahte stil sistemi yoktur.
 * Kaydedilmemiş değerler tarayıcıda hesaplanır.
 */
export function LivePreview({ config, brand, darkAllowed, name }: { config: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const css = useMemo(() => siteCss(config, brand, darkAllowed, `[data-live-preview="${id}"]`), [config, brand, darkAllowed, id]);
  const theme = THEMES[config.theme];
  const style = resolveStyle(config);
  const h = config.header;
  const showLogo = Boolean(brand.logoUrl) && h.brand !== 'name';
  const showName = !showLogo || h.brand === 'logo-name';
  const search = (
    <div className="flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-3 text-left text-foreground shadow-md">
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">Konum</span>
        <span className="block truncate text-[12px] font-semibold">Tüm bölgeler</span>
      </span>
      <span className="hidden min-w-0 flex-1 sm:block">
        <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">Tip</span>
        <span className="block truncate text-[12px] font-semibold">Daire</span>
      </span>
      <Button size="sm" tabIndex={-1}>
        <Search /> Ara
      </Button>
    </div>
  );
  return (
    <div aria-label="Canlı önizleme" className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <style>{css}</style>
      <div
        data-live-preview={id}
        data-site-theme={theme.id}
        data-site-card={style.card}
        data-site-button={style.button}
        data-site-footer={style.footer}
        className="bg-background font-sans text-foreground"
      >
        {/* Header */}
        <div data-header-style={h.style} className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 text-foreground">
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
        {/* Hero */}
        {style.hero === 'overlay' && (
          <div className="relative m-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#5b6b72,#2b3438)] px-4 pt-8 pb-4 text-white">
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
            <div className="aspect-[4/3] rounded-xl bg-[linear-gradient(135deg,#8c9aa1,#4b585e)]" />
            <div className="col-span-2">{search}</div>
          </div>
        )}
        {/* Kartlar */}
        <div className="px-4 pb-4">
          <p className="eyebrow eyebrow-line">Öne çıkanlar</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-lift overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="aspect-[4/3] bg-[linear-gradient(160deg,#c9d3d6,#98a6ab)]" />
                <div className="p-2.5">
                  <p className="text-[14px] font-bold text-primary-ink">₺{i === 1 ? '4.250.000' : '18.500 / ay'}</p>
                  <p className="truncate text-[11.5px] font-semibold">{i === 1 ? 'Satılık 3+1 daire' : 'Kiralık 2+1 daire'}</p>
                  <p className="text-[10.5px] text-muted-foreground">3+1 · 125 m² · 4. kat</p>
                </div>
              </div>
            ))}
          </div>
          {/* Çağrı bandı */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-inverse px-4 py-4 text-inverse-foreground">
            <p className="font-display text-[14px] leading-snug">Mülkünüzü satmak mı istiyorsunuz?</p>
            <Button size="xs" variant="inverse" tabIndex={-1}>
              Değerleme talebi
            </Button>
          </div>
        </div>
        {/* Footer */}
        <div className="site-footer bg-surface-inverse px-4 py-3 text-[11px] text-inverse-foreground/80">
          <span className="font-semibold text-inverse-foreground">{name}</span> · © {new Date().getFullYear()} · KVKK · Gizlilik
        </div>
      </div>
    </div>
  );
}

function TwoColumn({ form, preview }: { form: React.ReactNode; preview: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="min-w-0">{form}</div>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-[12.5px] font-semibold tracking-wide text-muted-foreground uppercase">Önizleme</p>
        {preview}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Tema
const STYLE_OPTIONS: { key: keyof StyleConfig; label: string; options: [string, string][] }[] = [
  { key: 'hero', label: 'Ana sayfa üst bölüm (hero)', options: [['overlay', 'Fotoğraf üzerinde arama'], ['centered', 'Ortalanmış başlık'], ['split', 'Bölünmüş (metin + görsel)']] },
  { key: 'card', label: 'İlan kartları', options: [['elevated', 'Gölgeli'], ['outline', 'Çizgili'], ['flat', 'Düz zemin']] },
  { key: 'button', label: 'Düğmeler', options: [['rounded', 'Yuvarlatılmış'], ['pill', 'Hap (tam yuvarlak)'], ['square', 'Keskin köşeli']] },
  { key: 'footer', label: 'Alt bilgi (footer) zemini', options: [['dark', 'Koyu'], ['light', 'Açık'], ['brand', 'Marka rengi']] },
];

export function ThemeForm({ orgId, draft, brand, darkAllowed, name }: { orgId: string; draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const [theme, setTheme] = useState<ThemeId>(draft.theme);
  const [style, setStyle] = useState<StyleConfig>(draft.style);
  const themeSave = useSectionSave(orgId, 'theme');
  const styleSave = useSectionSave(orgId, 'style');
  const themeDirty = theme !== draft.theme;
  const styleDirty = JSON.stringify(style) !== JSON.stringify(draft.style);
  const themeDefaults = resolveStyle({ theme, style: {} });
  return (
    <TwoColumn
      form={
        <>
          <fieldset>
            <legend className="mb-3 text-[14px] font-semibold">Site teması</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THEME_LIST.map((t) => {
                const selected = theme === t.id;
                return (
                  <label
                    key={t.id}
                    className={cn('relative cursor-pointer rounded-2xl border bg-surface p-4 transition', selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border-strong')}
                  >
                    <input type="radio" name="theme" value={t.id} checked={selected} onChange={() => setTheme(t.id)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold">{t.name}</span>
                      {selected && <Check className="size-4 text-primary" aria-hidden />}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{t.description}</span>
                    <span className="mt-2 block text-[12px] text-muted-foreground">
                      {FONT_CATALOG[t.fonts.heading].name} / {FONT_CATALOG[t.fonts.body].name}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="mt-8">
            <legend className="mb-1 text-[14px] font-semibold">Bileşen stilleri</legend>
            <p className="mb-4 text-[13px] text-muted-foreground">Boş bırakılan seçenek temanın varsayılanını kullanır. Tema değişse de buradaki seçimleriniz korunur.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {STYLE_OPTIONS.map((o) => (
                <Field key={o.key} label={o.label} htmlFor={`style-${o.key}`}>
                  <Select
                    id={`style-${o.key}`}
                    value={style[o.key] ?? ''}
                    onChange={(e) => setStyle((x) => ({ ...x, [o.key]: e.target.value || undefined }))}
                  >
                    <option value="">Temadan ({o.options.find(([v]) => v === themeDefaults[o.key as keyof typeof themeDefaults])?.[1] ?? '—'})</option>
                    {o.options.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </fieldset>
          <p className="mt-4 text-[13px] text-muted-foreground">Tema ve stiller yalnızca görünümü değiştirir; ilanlar, müşteriler, adresler (URL) ve SEO verileri aynı kalır.</p>
          <SaveBar
            pending={themeSave.pending || styleSave.pending}
            dirty={themeDirty || styleDirty}
            onSave={async () => {
              if (themeDirty && !(await themeSave.save(theme))) return;
              if (styleDirty) await styleSave.save(style);
            }}
            onReset={() => {
              setTheme(draft.theme);
              setStyle(draft.style);
            }}
          />
        </>
      }
      preview={<LivePreview config={{ ...draft, theme, style }} brand={brand} darkAllowed={darkAllowed} name={name} />}
    />
  );
}

// --------------------------------------------------------------------------- Renkler
const TOKEN_LABELS: Record<keyof ColorTokens, string> = {
  primary: 'Ana renk (primary)',
  secondary: 'İkincil (footer, koyu bloklar)',
  accent: 'Vurgu (accent)',
  background: 'Sayfa zemini',
  surface: 'Kart / yüzey',
  text: 'Metin',
  muted: 'İkincil metin',
  border: 'Çizgi',
  success: 'Başarı',
  warning: 'Uyarı',
  error: 'Hata',
};

export function ColorsForm({ orgId, draft, brand, darkAllowed, name }: { orgId: string; draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const initial = draft.colors;
  const [colors, setColors] = useState<ColorsConfig>(initial);
  const { save, pending } = useSectionSave(orgId, 'colors');
  const dirty = JSON.stringify(colors) !== JSON.stringify(initial);
  const resolved = resolveColors({ ...draft, colors }, brand, darkAllowed).tokens;
  const palettes = PALETTES.filter((p) => p.scheme === 'light' || darkAllowed);
  const setToken = (k: keyof ColorTokens, v: string) => setColors((c) => ({ ...c, mode: 'custom', preset: c.preset ?? 'modern-green', tokens: { ...(c.tokens ?? {}), [k]: v } }));
  return (
    <TwoColumn
      form={
        <>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-[14px] font-semibold">Renk kaynağı</legend>
            {(
              [
                ['brand', 'Ofisin marka renkleri', 'Ana ve vurgu rengi Marka sekmesinden (ofis de kendi panelindeki Marka ve Görünüm ekranından) gelir.'],
                ['preset', 'Hazır palet', 'Tüm renkler birbiriyle uyumlu olarak değişir.'],
                ['custom', 'Özel', 'Paletten başlayıp renkleri tek tek değiştirin.'],
              ] as const
            ).map(([mode, label, desc]) => (
              <label key={mode} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', colors.mode === mode ? 'border-primary bg-primary-soft/40' : 'border-border')}>
                <input
                  type="radio"
                  name="color-mode"
                  className="mt-1 accent-[var(--primary)]"
                  checked={colors.mode === mode}
                  onChange={() => setColors((c) => ({ ...c, mode, preset: c.preset ?? (mode === 'brand' ? undefined : 'modern-green') }))}
                />
                <span>
                  <span className="block text-[14px] font-semibold">{label}</span>
                  <span className="block text-[12.5px] text-muted-foreground">{desc}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {colors.mode !== 'brand' && (
            <fieldset className="mt-6">
              <legend className="mb-3 text-[14px] font-semibold">Hazır paletler</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {palettes.map((p) => {
                  const selected = colors.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setColors((c) => ({ ...c, preset: p.id, tokens: c.mode === 'custom' ? {} : c.tokens }))}
                      className={cn('flex items-center gap-3 rounded-xl border p-3 text-left', selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border-strong')}
                    >
                      <span className="flex shrink-0 overflow-hidden rounded-lg border border-border">
                        {(['primary', 'secondary', 'accent', 'background'] as const).map((k) => (
                          <span key={k} className="size-6" style={{ background: p.tokens[k] }} />
                        ))}
                      </span>
                      <span className="text-[13.5px] font-semibold">{p.name}</span>
                    </button>
                  );
                })}
              </div>
              {!darkAllowed && <p className="mt-2 text-[12.5px] text-muted-foreground">Koyu palet için Özellikler sekmesinden &quot;Koyu görünüm&quot;ü açın.</p>}
            </fieldset>
          )}

          {colors.mode === 'custom' && (
            <fieldset className="mt-6">
              <legend className="mb-3 text-[14px] font-semibold">Renkleri tek tek düzenleyin</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.keys(TOKEN_LABELS) as (keyof ColorTokens)[]).map((k) => (
                  <ColorInput key={k} label={TOKEN_LABELS[k]} value={colors.tokens?.[k] ?? resolved[k]} onChange={(v) => setToken(k, v)} />
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-muted-foreground">Okunabilirlik için metin/zemin kontrastı yayında otomatik olarak düzeltilir.</p>
            </fieldset>
          )}
          <SaveBar
            pending={pending}
            dirty={dirty}
            onSave={() => void save(colors.mode === 'brand' ? { mode: 'brand', scheme: 'light' } : { ...colors, scheme: findPalette(colors.preset)?.scheme ?? 'light' })}
            onReset={() => setColors(initial)}
          />
        </>
      }
      preview={<LivePreview config={{ ...draft, colors }} brand={brand} darkAllowed={darkAllowed} name={name} />}
    />
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12.5px] font-semibold text-foreground/80">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} seçici`}
          value={value}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-surface p-1"
        />
        <Input
          id={id}
          value={text}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          className="font-mono"
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Tipografi
export function TypographyForm({ orgId, draft, brand, darkAllowed, name }: { orgId: string; draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const initial = draft.typography;
  const [t, setT] = useState<TypographyConfig>(initial);
  const { save, pending } = useSectionSave(orgId, 'typography');
  const theme = THEMES[draft.theme];
  const dirty = JSON.stringify(t) !== JSON.stringify(initial);
  const fontOptions = (value: FontId | undefined, fallback: FontId, onChange: (v: FontId | undefined) => void, id: string) => (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as FontId | undefined)}>
      <option value="">Tema varsayılanı ({FONT_CATALOG[fallback].name})</option>
      {FONT_IDS.map((f) => (
        <option key={f} value={f}>
          {FONT_CATALOG[f].name} ({FONT_CATALOG[f].kind === 'serif' ? 'serif' : 'sans-serif'})
        </option>
      ))}
    </Select>
  );
  return (
    <TwoColumn
      form={
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Başlık yazı tipi" htmlFor="font-heading">
              {fontOptions(t.heading, theme.fonts.heading, (v) => setT((x) => ({ ...x, heading: v })), 'font-heading')}
            </Field>
            <Field label="Metin yazı tipi" htmlFor="font-body">
              {fontOptions(t.body, theme.fonts.body, (v) => setT((x) => ({ ...x, body: v })), 'font-body')}
            </Field>
            <Field label="Başlık kalınlığı" htmlFor="font-weight">
              <Select id="font-weight" value={t.headingWeight ?? ''} onChange={(e) => setT((x) => ({ ...x, headingWeight: e.target.value ? (Number(e.target.value) as 400 | 500 | 600 | 700) : undefined }))}>
                <option value="">Tema varsayılanı ({theme.headingWeight})</option>
                <option value="400">Normal (400)</option>
                <option value="500">Orta (500)</option>
                <option value="600">Yarı kalın (600)</option>
                <option value="700">Kalın (700)</option>
              </Select>
            </Field>
            <Field label={`Genel yazı ölçeği: %${Math.round((t.scale ?? 1) * 100)}`} htmlFor="font-scale">
              <input
                id="font-scale"
                type="range"
                min={0.9}
                max={1.15}
                step={0.025}
                value={t.scale ?? 1}
                onChange={(e) => setT((x) => ({ ...x, scale: Number(e.target.value) === 1 ? undefined : Number(e.target.value) }))}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">Performans için yalnızca bu listedeki yazı tipleri kullanılabilir ve yalnızca seçilen yazı tipi indirilir.</p>
          <SaveBar pending={pending} dirty={dirty} onSave={() => void save(t)} onReset={() => setT(initial)} />
        </>
      }
      preview={<LivePreview config={{ ...draft, typography: t }} brand={brand} darkAllowed={darkAllowed} name={name} />}
    />
  );
}
