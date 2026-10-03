'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Plus, Save, Trash2, X } from 'lucide-react';
import { TextAreaField, TextField } from '@/components/admin/editor/fields';
import { Panel } from '@/components/panel/ui';
import { LazyMap } from '@/components/common/maps/lazy-map';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice';
import { Field, Input } from '@/components/ui/form-controls';
import { saveCompanySettings } from '@/app/actions/admin-settings';
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '@/modules/content/hours';
import { buildTheme, contrastRatio } from '@/platform/branding/theme';

export interface CompanyValues {
  display_name: string;
  legal_name: string;
  tagline: string;
  description: string;
  service_area: string;
  primary_color: string;
  accent_color: string;
  phone: string;
  whatsapp: string;
  email: string;
  address_line: string;
  address_district: string;
  address_city: string;
  postal_code: string;
  office_latitude: string;
  office_longitude: string;
  opening_hours: { days: Weekday[]; opens: string; closes: string }[];
  working_hours_note: string;
  instagram_url: string;
  facebook_url: string;
  x_url: string;
  youtube_url: string;
  linkedin_url: string;
  tiktok_url: string;
}

const SOCIAL: { key: keyof CompanyValues; label: string; placeholder: string }[] = [
  { key: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { key: 'x_url', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  { key: 'youtube_url', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
  { key: 'tiktok_url', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
];

const SHORT_DAY: Record<Weekday, string> = { mo: 'Pzt', tu: 'Sal', we: 'Çar', th: 'Per', fr: 'Cum', sa: 'Cmt', su: 'Paz' };

function ratioLabel(ratio: number) {
  const rounded = ratio.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  return ratio >= 4.5 ? `${rounded}:1 · okunaklı` : `${rounded}:1 · düşük`;
}

export function CompanyForm({
  initial,
  map,
  defaultCenter,
  branding,
}: {
  initial: CompanyValues;
  map: { attribution: string; maxZoom: number };
  defaultCenter: { lat: number; lng: number };
  branding: React.ReactNode;
}) {
  const router = useRouter();
  const [v, setV] = useState<CompanyValues>(initial);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(v) !== snapshot;
  const set = <K extends keyof CompanyValues>(key: K, value: CompanyValues[K]) => setV((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const validPrimary = /^#[0-9a-f]{6}$/i.test(v.primary_color);
  const validAccent = /^#[0-9a-f]{6}$/i.test(v.accent_color);
  const theme = useMemo(() => buildTheme(validPrimary ? v.primary_color : null, validAccent ? v.accent_color : null), [v.primary_color, v.accent_color, validPrimary, validAccent]);
  const hasPin = v.office_latitude !== '' && v.office_longitude !== '';
  const center = hasPin ? { lat: Number(v.office_latitude), lng: Number(v.office_longitude) } : defaultCenter;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    const res = await saveCompanySettings({
      ...v,
      office_latitude: v.office_latitude === '' ? null : v.office_latitude,
      office_longitude: v.office_longitude === '' ? null : v.office_longitude,
    });
    setPending(false);
    if (!res.ok) {
      const next: Record<string, string> = {};
      for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) next[k.startsWith('opening_hours') ? 'opening_hours' : k] ??= msgs[0];
      setErrors(next);
      toast.error(res.error);
      return;
    }
    setSnapshot(JSON.stringify(v));
    toast.success(res.message ?? 'Kaydedildi.');
    router.refresh();
  }

  const colorField = (key: 'primary_color' | 'accent_color', label: string, hint: string) => (
    <Field label={label} htmlFor={key} error={errors[key]} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} seçici`}
          value={/^#[0-9a-f]{6}$/i.test(v[key]) ? v[key] : '#000000'}
          onChange={(e) => set(key, e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-border bg-surface p-1"
        />
        <Input id={key} value={v[key]} onChange={(e) => set(key, e.target.value.trim())} maxLength={7} className="numeric font-mono uppercase" aria-invalid={Boolean(errors[key])} />
      </div>
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Panel title="Marka" description="Sitede, yönetim panelinde, paylaşım görsellerinde ve broşürlerde kullanılır.">
        <div className="space-y-6">
          {branding}
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Şirket adı" name="display_name" required value={v.display_name} onChange={(x) => set('display_name', x)} maxLength={80} errors={errors} />
            <TextField label="Slogan" name="tagline" value={v.tagline} onChange={(x) => set('tagline', x)} maxLength={160} errors={errors} placeholder="ör. Bölgenizde güvenilir gayrimenkul danışmanlığı" />
            <TextField label="Ticari unvan" name="legal_name" value={v.legal_name} onChange={(x) => set('legal_name', x)} maxLength={160} errors={errors} hint="KVKK ve yasal metinlerde kullanılır." />
            <TextField label="Hizmet bölgesi" name="service_area" value={v.service_area} onChange={(x) => set('service_area', x)} maxLength={160} errors={errors} placeholder="ör. hizmet verdiğiniz ilçe ve semtler" />
          </div>
          <TextAreaField label="Tanıtım metni" name="description" value={v.description} onChange={(x) => set('description', x)} maxLength={2000} rows={4} errors={errors} hint="Site altbilgisinde ve arama motoru açıklamasında kullanılır. Doğrulanamayan iddialar (en iyi, 1 numara vb.) kullanmayın." />
        </div>
      </Panel>

      <Panel title="Renkler" description="Yazı renkleri erişilebilirlik için otomatik ayarlanır (WCAG AA, en az 4,5:1).">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-5 sm:grid-cols-2">
            {colorField('primary_color', 'Ana renk', 'Butonlar, bağlantılar ve vurgular.')}
            {colorField('accent_color', 'Vurgu rengi', 'Rozetler ve ikincil vurgular.')}
          </div>
          <div className="rounded-2xl border border-border p-4" aria-label="Renk önizlemesi">
            <p className="text-[12.5px] font-semibold text-muted-foreground">Önizleme</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold" style={{ background: theme.primary, color: theme.primaryFg }}>
                İlanları gör
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: theme.accent, color: theme.accentFg }}>
                Yeni
              </span>
              <span className="text-sm font-semibold underline" style={{ color: theme.primaryInk }}>
                Bağlantı
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-[12.5px] text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Buton yazısı</dt>
                <dd className="numeric">{ratioLabel(contrastRatio(theme.primary, theme.primaryFg))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Beyaz zeminde metin</dt>
                <dd className="numeric">{ratioLabel(contrastRatio(theme.primaryInk, '#ffffff'))}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Panel>

      <Panel title="İletişim" description="Sitedeki arama, WhatsApp ve e-posta düğmeleri bu bilgileri kullanır.">
        <div className="grid gap-5 md:grid-cols-3">
          <TextField label="Telefon" name="phone" value={v.phone} onChange={(x) => set('phone', x)} maxLength={30} errors={errors} placeholder="0312 000 00 00" />
          <TextField label="WhatsApp" name="whatsapp" value={v.whatsapp} onChange={(x) => set('whatsapp', x)} maxLength={30} errors={errors} placeholder="0532 000 00 00" hint="Boşsa telefon numarası kullanılır." />
          <TextField label="E-posta" name="email" value={v.email} onChange={(x) => set('email', x)} maxLength={160} errors={errors} placeholder="info@ornek.com" />
        </div>
      </Panel>

      <Panel title="Adres ve ofis konumu" description="İletişim sayfasında, harita ve yerel işletme (LocalBusiness) bilgilerinde kullanılır.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-5 sm:grid-cols-2">
            <TextField label="Adres" name="address_line" value={v.address_line} onChange={(x) => set('address_line', x)} maxLength={240} errors={errors} className="sm:col-span-2" placeholder="Mahalle, cadde/sokak, no" />
            <TextField label="İlçe" name="address_district" value={v.address_district} onChange={(x) => set('address_district', x)} maxLength={80} errors={errors} />
            <TextField label="İl" name="address_city" value={v.address_city} onChange={(x) => set('address_city', x)} maxLength={80} errors={errors} />
            <TextField label="Posta kodu" name="postal_code" value={v.postal_code} onChange={(x) => set('postal_code', x)} maxLength={5} errors={errors} />
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <TextField label="Enlem" name="office_latitude" value={v.office_latitude} onChange={(x) => set('office_latitude', x)} maxLength={12} errors={errors} placeholder="39.97…" />
              <TextField label="Boylam" name="office_longitude" value={v.office_longitude} onChange={(x) => set('office_longitude', x)} maxLength={12} errors={errors} placeholder="32.60…" />
            </div>
            {hasPin && (
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setV((s) => ({ ...s, office_latitude: '', office_longitude: '' }))}>
                <X /> Konumu temizle
              </Button>
            )}
          </div>
          <div>
            <LazyMap
              key={hasPin ? 'pin' : 'empty'}
              center={center}
              mode="pin"
              editable
              onChange={(p) => setV((s) => ({ ...s, office_latitude: p.lat.toFixed(6), office_longitude: p.lng.toFixed(6) }))}
              zoom={hasPin ? 16 : 12}
              attribution={map.attribution}
              maxZoom={map.maxZoom}
              ariaLabel="Ofis konumu seçimi"
              className="h-[300px] overflow-hidden rounded-2xl border border-border"
            />
            <p className="mt-2 text-[12.5px] text-muted-foreground">Haritaya tıklayarak veya işaretçiyi sürükleyerek ofis konumunu seçin.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Çalışma saatleri" description="İletişim sayfasında ve arama motorlarındaki işletme bilgisinde gösterilir.">
        <ul className="space-y-3">
          {v.opening_hours.map((row, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-xl border border-border p-3.5 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${i + 1}. satır günleri`}>
                {WEEKDAYS.map((d) => (
                  <ChoiceChip
                    key={d}
                    size="sm"
                    pressed={row.days.includes(d)}
                    onPressedChange={(on) =>
                      set(
                        'opening_hours',
                        v.opening_hours.map((r, j) => (j === i ? { ...r, days: on ? WEEKDAYS.filter((x) => x === d || r.days.includes(x)) : r.days.filter((x) => x !== d) } : r)),
                      )
                    }
                  >
                    <span aria-hidden>{SHORT_DAY[d]}</span>
                    <span className="sr-only">{WEEKDAY_LABELS[d]}</span>
                  </ChoiceChip>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <label className="sr-only" htmlFor={`opens-${i}`}>
                  Açılış
                </label>
                <Input id={`opens-${i}`} type="time" value={row.opens} onChange={(e) => set('opening_hours', v.opening_hours.map((r, j) => (j === i ? { ...r, opens: e.target.value } : r)))} className="h-10 w-32" />
                <span className="text-muted-foreground">–</span>
                <label className="sr-only" htmlFor={`closes-${i}`}>
                  Kapanış
                </label>
                <Input id={`closes-${i}`} type="time" value={row.closes} onChange={(e) => set('opening_hours', v.opening_hours.map((r, j) => (j === i ? { ...r, closes: e.target.value } : r)))} className="h-10 w-32" />
                <Button size="icon-sm" variant="danger-ghost" aria-label="Satırı sil" onClick={() => set('opening_hours', v.opening_hours.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {v.opening_hours.length === 0 && <p className="text-sm text-muted-foreground">Çalışma saati eklenmedi.</p>}
        {errors.opening_hours && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
            {errors.opening_hours}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={v.opening_hours.length >= 7}
          onClick={() => set('opening_hours', [...v.opening_hours, { days: ['mo', 'tu', 'we', 'th', 'fr'], opens: '09:00', closes: '18:00' }])}
        >
          <Plus /> Satır ekle
        </Button>
        <TextField
          label="Not"
          name="working_hours_note"
          value={v.working_hours_note}
          onChange={(x) => set('working_hours_note', x)}
          maxLength={300}
          errors={errors}
          className="mt-5"
          placeholder="ör. Pazar günleri randevu ile gösterim yapılır."
        />
      </Panel>

      <Panel title="Sosyal medya" description="Yalnızca doldurulan hesaplar sitede gösterilir.">
        <div className="grid gap-5 md:grid-cols-2">
          {SOCIAL.map((s) => (
            <TextField key={s.key} label={s.label} name={s.key} value={v[s.key] as string} onChange={(x) => set(s.key, x as never)} maxLength={300} errors={errors} placeholder={s.placeholder} />
          ))}
        </div>
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-[#f5f4f1]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        {dirty ? (
          <p className="mr-auto text-[13px] font-medium text-warning" role="status">
            Kaydedilmemiş değişiklikler var.
          </p>
        ) : (
          <p className="mr-auto flex items-center gap-1.5 text-[13px] text-muted-foreground" role="status">
            <Check className="size-4" aria-hidden /> Tüm değişiklikler kaydedildi.
          </p>
        )}
        <Button type="submit" loading={pending} disabled={!dirty && !pending}>
          {!pending && <Save />} Kaydet
        </Button>
      </div>
    </form>
  );
}
