'use client';

import { useId, useState } from 'react';
import { LivePreview, type Brand } from '@/theme-engine/preview/live-preview';
import { Check, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { SaveBar, useSectionSave } from '@/components/site-editor/site-actions';
import { FONT_CATALOG } from '@/theme-engine/typography/catalog';
import { PALETTES, findPalette } from '@/theme-engine/palettes';
import { FONT_IDS, type ColorTokens, type ColorsConfig, type FontId, type SiteConfig, type StyleConfig, type ThemeId, type TypographyConfig } from '@/site-config/schema';
import { resolveStyle, THEME_LIST, THEMES } from '@/theme-engine/themes';
import { resolveColors } from '@/theme-engine/tokens';

export { LivePreview, type Brand } from '@/theme-engine/preview/live-preview';

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
const STYLE_OPTIONS: { key: Exclude<keyof StyleConfig, 'slots' | 'origin'>; label: string; options: [string, string][] }[] = [
  {
    key: 'hero',
    label: 'Ana sayfa üst bölüm (hero)',
    options: [
      ['overlay', 'Fotoğraf üzerinde arama'],
      ['centered', 'Ortalanmış başlık'],
      ['split', 'Bölünmüş (metin + görsel)'],
      ['cinematic', 'Sinematik (tam genişlik, yüzen arama)'],
      ['editorial', 'Editoryal (asimetrik, büyük tipografi)'],
      ['showcase', 'İlan öncelikli vitrin'],
    ],
  },
  { key: 'headerLayout', label: 'Üst bilgi (header) düzeni', options: [['classic', 'Klasik'], ['centered', 'Ortalı logo, ayrı menü satırı'], ['floating', 'Yüzen (ayrık, yarı saydam)']] },
  { key: 'card', label: 'İlan kartı yüzeyi', options: [['elevated', 'Gölgeli'], ['outline', 'Çizgili'], ['flat', 'Düz zemin'], ['bezel', 'Çift çerçeve']] },
  { key: 'cardLayout', label: 'İlan kartı düzeni', options: [['standard', 'Standart'], ['overlay', 'Görsel üstü'], ['editorial', 'Editoryal (kutusuz)'], ['horizontal', 'Yatay']] },
  { key: 'button', label: 'Düğmeler', options: [['rounded', 'Yuvarlatılmış'], ['pill', 'Hap (tam yuvarlak)'], ['square', 'Keskin köşeli']] },
  { key: 'footer', label: 'Alt bilgi (footer) zemini', options: [['dark', 'Koyu'], ['light', 'Açık'], ['brand', 'Marka rengi']] },
  { key: 'footerLayout', label: 'Alt bilgi (footer) düzeni', options: [['classic', 'Klasik (sütunlar)'], ['contact', 'İletişim öncelikli'], ['minimal', 'Minimal (tek satır)']] },
  { key: 'motion', label: 'Hareket dili', options: [['none', 'Yok'], ['subtle', 'Ölçülü (kaydırınca beliren bölümler)'], ['expressive', 'Belirgin (+ hero ve kart girişleri)']] },
];

export function ThemeForm({ draft, brand, darkAllowed, name }: { draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const [theme, setTheme] = useState<ThemeId>(draft.theme);
  const [style, setStyle] = useState<StyleConfig>(draft.style);
  const [usePalette, setUsePalette] = useState(false);
  const [previewing, setPreviewing] = useState<ThemeId | null>(null);
  const themeSave = useSectionSave('theme');
  const styleSave = useSectionSave('style');
  const colorsSave = useSectionSave('colors');
  const themeDirty = theme !== draft.theme;
  const styleDirty = JSON.stringify(style) !== JSON.stringify(draft.style);
  const paletteColors: ColorsConfig = { mode: 'preset', preset: THEMES[theme].palette, scheme: 'light' };
  const colors = usePalette ? paletteColors : draft.colors;
  const themeDefaults = resolveStyle({ theme, style: {} });
  const previewConfig = (id: ThemeId): SiteConfig => ({ ...draft, theme: id, style: id === theme ? style : draft.style, colors: usePalette ? { mode: 'preset', preset: THEMES[id].palette, scheme: 'light' } : draft.colors });
  return (
    <div className="space-y-8">
      <section aria-labelledby="tema-galerisi">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tema-galerisi" className="text-[15px] font-bold">
              Tema galerisi <span className="font-medium text-muted-foreground">({THEME_LIST.length} tema)</span>
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Her tema farklı yazı tipi, köşe, kart, header, hero, düğme ve footer karakterine sahiptir. Önizlemeler gerçek tema motoruyla, bu sitenin marka bilgileriyle çizilir.</p>
          </div>
          <Checkbox
            checked={usePalette}
            onChange={(e) => setUsePalette(e.target.checked)}
            label="Temanın önerilen paletini de uygula"
            description="Kapalıyken sitenin mevcut renkleri korunur."
          />
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {THEME_LIST.map((t) => {
            const selected = theme === t.id;
            const current = draft.theme === t.id;
            return (
              <li key={t.id} className={cn('flex flex-col overflow-hidden rounded-2xl border bg-surface transition', selected ? 'border-primary ring-2 ring-primary/25' : 'border-border')}>
                <div className="h-56 overflow-hidden border-b border-border bg-surface-muted">
                  <div className="origin-top-left scale-[0.62] [width:161%]">
                    <LivePreview config={previewConfig(t.id)} brand={brand} darkAllowed={darkAllowed} name={name} variant="thumb" label={`${t.name} teması önizlemesi`} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold">{t.name}</span>
                    {current && <Badge variant="neutral">Taslakta</Badge>}
                    {selected && !current && <Badge variant="info">Seçildi</Badge>}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.description}</p>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Uygun:</span> {t.audience} · {FONT_CATALOG[t.fonts.heading].name} / {FONT_CATALOG[t.fonts.body].name}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button type="button" size="sm" variant={selected ? 'soft' : 'primary'} aria-pressed={selected} aria-label={`${t.name} temasını seç`} onClick={() => setTheme(t.id)}>
                      {selected ? (
                        <>
                          <Check /> Seçili
                        </>
                      ) : (
                        'Bu temayı seç'
                      )}
                    </Button>
                    <Button type="button" size="sm" variant="outline" aria-label={`${t.name} temasını önizle`} onClick={() => setPreviewing(t.id)}>
                      <Eye /> Önizle
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <details className="group rounded-2xl border border-border bg-surface p-5">
        <summary className="cursor-pointer list-none text-[15px] font-bold marker:hidden">
          İleri ayarlar: bileşen stilleri <span className="font-medium text-muted-foreground">(isteğe bağlı)</span>
        </summary>
        <p className="mt-2 text-[13px] text-muted-foreground">Boş bırakılan seçenek temanın varsayılanını kullanır. Renk, yazı tipi ve header için ilgili sekmeleri kullanın.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {STYLE_OPTIONS.map((o) => (
            <Field key={o.key} label={o.label} htmlFor={`style-${o.key}`}>
              <Select id={`style-${o.key}`} value={style[o.key] ?? ''} onChange={(e) => setStyle((x) => ({ ...x, [o.key]: e.target.value || undefined }))}>
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
      </details>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <p className="text-[13px] text-muted-foreground">Tema ve stiller yalnızca görünümü değiştirir; ilanlar, müşteriler, adresler (URL) ve SEO verileri aynı kalır. Kaydedince taslağa yazılır; &quot;Önizle&quot; ile sitede görüp yayınlayın.</p>
        <div className="min-w-0 lg:row-span-2">
          <p className="mb-2 text-[12.5px] font-semibold tracking-wide text-muted-foreground uppercase">Seçili tema önizlemesi</p>
          <LivePreview config={{ ...draft, theme, style, colors }} brand={brand} darkAllowed={darkAllowed} name={name} />
        </div>
      </div>

      <SaveBar
        pending={themeSave.pending || styleSave.pending || colorsSave.pending}
        dirty={themeDirty || styleDirty || usePalette}
        onSave={async () => {
          if (themeDirty && !(await themeSave.save(theme))) return;
          if (styleDirty && !(await styleSave.save(style))) return;
          if (usePalette && (await colorsSave.save(paletteColors))) setUsePalette(false);
        }}
        onReset={() => {
          setTheme(draft.theme);
          setStyle(draft.style);
          setUsePalette(false);
        }}
      />

      <Dialog open={previewing !== null} onOpenChange={(o) => !o && setPreviewing(null)}>
        {previewing && (
          <DialogContent size="lg" title={`${THEMES[previewing].name} teması`} description={THEMES[previewing].audience}>
            <div className="mt-4">
              <LivePreview config={previewConfig(previewing)} brand={brand} darkAllowed={darkAllowed} name={name} label={`${THEMES[previewing].name} teması tam önizleme`} />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPreviewing(null)}>
                Kapat
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setTheme(previewing);
                  setPreviewing(null);
                }}
              >
                <Check /> Bu temayı seç
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
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

export function ColorsForm({ draft, brand, darkAllowed, name }: { draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const initial = draft.colors;
  const [colors, setColors] = useState<ColorsConfig>(initial);
  const { save, pending } = useSectionSave('colors');
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
export function TypographyForm({ draft, brand, darkAllowed, name }: { draft: SiteConfig; brand: Brand; darkAllowed: boolean; name: string }) {
  const initial = draft.typography;
  const [t, setT] = useState<TypographyConfig>(initial);
  const { save, pending } = useSectionSave('typography');
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
