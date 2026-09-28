'use client';

import { useId, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Field, Input, Select } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { SaveBar, useSectionSave } from '@/components/platform/site/site-actions';
import { FONT_CATALOG } from '@/platform/site/font-catalog';
import { PALETTES, findPalette } from '@/platform/site/palettes';
import { FONT_IDS, type ColorTokens, type ColorsConfig, type FontId, type SiteConfig, type ThemeId, type TypographyConfig } from '@/platform/site/schema';
import { THEME_LIST, THEMES } from '@/platform/site/themes';
import { resolveColors, siteCss } from '@/platform/site/tokens';

type Brand = { primary_color: string | null; accent_color: string | null };

/** Küçük site örneği: seçilen tema/renk/yazı tipiyle canlı önizleme (tarayıcıda hesaplanır) */
export function LivePreview({ config, brand, darkAllowed, name }: { config: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const css = useMemo(() => siteCss(config, brand, darkAllowed, `[data-live-preview="${id}"]`), [config, brand, darkAllowed, id]);
  const theme = THEMES[config.theme];
  const headerDark = config.header.style === 'dark';
  return (
    <div aria-label="Canlı önizleme" className="overflow-hidden rounded-2xl border border-border">
      <style>{css}</style>
      <div data-live-preview={id} data-site-theme={theme.id} data-site-card={theme.card} className="bg-background font-sans text-foreground">
        <div data-header-style={headerDark ? 'dark' : 'light'} className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 text-foreground">
          <span className="font-display text-[15px] font-semibold">{name}</span>
          <span className="hidden gap-3 text-[12px] text-foreground/70 sm:flex">
            <span>Satılık</span>
            <span>Kiralık</span>
            <span>İletişim</span>
          </span>
          <span className="rounded-lg bg-primary px-2.5 py-1 text-[11.5px] font-semibold text-primary-fg">Bize ulaşın</span>
        </div>
        <div className="px-4 py-5">
          <p className="eyebrow eyebrow-line">Öne çıkanlar</p>
          <h3 className="mt-2 font-display text-[1.4rem] leading-tight">Size uygun gayrimenkulü bulun</h3>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">Satılık ve kiralık seçilmiş ilanlar.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-lift rounded-2xl p-2">
                <div className="aspect-[4/3] rounded-xl bg-surface-sunken" />
                <p className="mt-2 px-1 text-[14px] font-bold text-primary-ink">₺{i === 1 ? '4.250.000' : '18.500'}</p>
                <p className="px-1 pb-1 text-[11.5px] text-muted-foreground">3+1 · 125 m²</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg">Birincil düğme</span>
            <span className="rounded-xl bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent-ink">Vurgu</span>
            <span className="rounded-xl border border-border px-3 py-1.5 text-[12px] font-semibold">Çerçeveli</span>
          </div>
        </div>
        <div className="bg-surface-inverse px-4 py-3 text-[11.5px] text-inverse-foreground/80">© {name} · KVKK · Gizlilik</div>
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
export function ThemeForm({ orgId, draft, brand, darkAllowed, name }: { orgId: string; draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const [theme, setTheme] = useState<ThemeId>(draft.theme);
  const { save, pending } = useSectionSave(orgId, 'theme');
  const dirty = theme !== draft.theme;
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
          <p className="mt-4 text-[13px] text-muted-foreground">Tema yalnızca görünümü değiştirir; ilanlar, müşteriler, adresler (URL) ve SEO verileri aynı kalır.</p>
          <SaveBar pending={pending} dirty={dirty} onSave={() => void save(theme)} onReset={() => setTheme(draft.theme)} />
        </>
      }
      preview={<LivePreview config={{ ...draft, theme }} brand={brand} darkAllowed={darkAllowed} name={name} />}
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
                ['brand', 'Ofisin marka renkleri', 'Ana ve vurgu rengi ofisin Şirket Ayarları’ndan gelir (ofis kendisi değiştirebilir).'],
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

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
