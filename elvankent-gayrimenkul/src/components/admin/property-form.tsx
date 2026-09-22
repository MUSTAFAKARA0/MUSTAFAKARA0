'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Camera, CheckCircle2, Coins, ListChecks, MapPin, Plus, Rocket, Ruler, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Label, Select, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { NumberInput } from '@/components/forms/number-input';
import { LazyMap } from '@/components/map/lazy-map';
import { ImageManager, PendingImagePicker, type PendingImage } from './image-manager';
import { addLocation, saveProperty } from '@/app/actions/admin-properties';
import { prepareImageForUpload, uploadPropertyImage } from '@/lib/client-image';
import {
  CATEGORY_LABELS,
  CURRENCY_LABELS,
  DEED_STATUS_OPTIONS,
  FACADE_OPTIONS,
  FEATURE_GROUP_LABELS,
  FLOOR_OPTIONS,
  HEATING_OPTIONS,
  PARKING_OPTIONS,
  STATUS_LABELS,
  USAGE_STATUS_OPTIONS,
  VIEW_OPTIONS,
  ZONING_OPTIONS,
} from '@/lib/constants';
import type { FieldErrors } from '@/lib/validation/common';
import type { PropertyInput } from '@/lib/validation/property';
import { cn } from '@/lib/utils';
import { publicEnv } from '@/lib/env';
import type {
  City,
  District,
  Feature,
  FeatureGroup,
  Neighborhood,
  PropertyCategory,
  PropertyImage,
  PropertyLocation,
  PropertyRow,
  PropertyStatus,
  PropertyType,
} from '@/types/database';

export interface PropertyFormOptions {
  cities: City[];
  districts: District[];
  neighborhoods: Neighborhood[];
  propertyTypes: PropertyType[];
  features: Feature[];
}

interface PropertyFormProps {
  options: PropertyFormOptions;
  initial?: {
    property: PropertyRow;
    location: PropertyLocation | null;
    featureIds: number[];
    images: PropertyImage[];
  };
}

type FormState = {
  [K in keyof Omit<PropertyInput, 'feature_ids' | 'facades' | 'views' | 'is_featured' | 'price_negotiable'>]: string;
} & { feature_ids: number[]; facades: string[]; views: string[]; is_featured: boolean; price_negotiable: boolean };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const tri = (v: boolean | null | undefined) => (v === null || v === undefined ? '' : v ? 'true' : 'false');

function initialState(opts: PropertyFormOptions, init?: PropertyFormProps['initial']): FormState {
  const p = init?.property;
  const l = init?.location;
  const defaultCity = opts.cities.length === 1 ? String(opts.cities[0].id) : '';
  return {
    title: str(p?.title),
    description: str(p?.description),
    listing_type: p?.listing_type ?? 'sale',
    property_type_id: str(p?.property_type_id),
    status: p?.status ?? 'active',
    is_featured: p?.is_featured ?? false,
    price: p ? String(Math.round(Number(p.price))) : '',
    currency: p?.currency ?? 'TRY',
    price_negotiable: p?.price_negotiable ?? false,
    dues: p?.dues ? String(Math.round(Number(p.dues))) : '',
    deposit: p?.deposit ? String(Math.round(Number(p.deposit))) : '',
    city_id: p ? String(p.city_id) : defaultCity,
    district_id: str(p?.district_id),
    neighborhood_id: str(p?.neighborhood_id),
    address: str(l?.address),
    latitude: str(l?.latitude),
    longitude: str(l?.longitude),
    location_precision: l?.precision ?? 'approximate',
    gross_m2: str(p?.gross_m2),
    net_m2: str(p?.net_m2),
    room_count: str(p?.room_count),
    living_room_count: p ? str(p.living_room_count) : '1',
    building_age: str(p?.building_age),
    floor: str(p?.floor),
    total_floors: str(p?.total_floors),
    bathroom_count: str(p?.bathroom_count),
    balcony_count: str(p?.balcony_count),
    heating: str(p?.heating),
    has_elevator: tri(p?.has_elevator),
    parking: str(p?.parking),
    is_furnished: tri(p?.is_furnished),
    in_complex: tri(p?.in_complex),
    complex_name: str(p?.complex_name),
    has_air_conditioning: tri(p?.has_air_conditioning),
    credit_eligible: tri(p?.credit_eligible),
    deed_status: str(p?.deed_status),
    usage_status: str(p?.usage_status),
    facades: p?.facades ?? [],
    views: p?.views ?? [],
    swap_available: tri(p?.swap_available),
    zoning_status: str(p?.zoning_status),
    block_no: str(p?.block_no),
    parcel_no: str(p?.parcel_no),
    floor_area_ratio: str(p?.floor_area_ratio),
    height_limit: str(p?.height_limit),
    meta_description: str(p?.meta_description),
    feature_ids: init?.featureIds ?? [],
  };
}

const SECTIONS = [
  { id: 'genel', label: 'Genel Bilgiler', icon: Building2 },
  { id: 'konum', label: 'Konum', icon: MapPin },
  { id: 'fiyat', label: 'Fiyat', icon: Coins },
  { id: 'temel', label: 'Temel Özellikler', icon: Ruler },
  { id: 'ozellikler', label: 'Özellikler', icon: ListChecks },
  { id: 'fotograflar', label: 'Fotoğraflar', icon: Camera },
  { id: 'yayin', label: 'Yayın', icon: Settings2 },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id);
  const Icon = s?.icon ?? Building2;
  return (
    <section id={id} aria-labelledby={`${id}-baslik`} className="scroll-mt-32 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id={`${id}-baslik`} className="text-lg font-bold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-sand-600">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TriSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Belirtilmemiş</option>
      <option value="true">Evet</option>
      <option value="false">Hayır</option>
    </Select>
  );
}

export function PropertyForm({ options, initial }: PropertyFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<FormState>(() => initialState(options, initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [saving, startSaving] = useTransition();
  const [uploadingNew, setUploadingNew] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [locations, setLocations] = useState({ districts: options.districts, neighborhoods: options.neighborhoods });
  const [addLoc, setAddLoc] = useState<null | 'district' | 'neighborhood'>(null);
  const [newLocName, setNewLocName] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: '' }));
  };

  // Kaydedilmemiş değişiklik varken sayfadan çıkışta uyar
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const type = options.propertyTypes.find((t) => String(t.id) === form.property_type_id);
  const category: PropertyCategory | undefined = type?.category;
  const isLand = category === 'arsa';
  const isResidential = category === 'konut';
  const city = options.cities.find((c) => String(c.id) === form.city_id);
  const districts = locations.districts.filter((d) => String(d.city_id) === form.city_id);
  const district = districts.find((d) => String(d.id) === form.district_id);
  const neighborhoods = locations.neighborhoods.filter((n) => String(n.district_id) === form.district_id);
  const neighborhood = neighborhoods.find((n) => String(n.id) === form.neighborhood_id);

  const mapCenter = useMemo(() => {
    if (form.latitude && form.longitude) return { lat: Number(form.latitude), lng: Number(form.longitude) };
    const src = [neighborhood, district, city].find((x) => x?.latitude && x?.longitude);
    return src ? { lat: Number(src.latitude), lng: Number(src.longitude) } : { lat: 39.9334, lng: 32.8597 };
  }, [form.latitude, form.longitude, neighborhood, district, city]);

  const featuresByGroup = (['ic', 'dis', 'muhit', 'ulasim'] as FeatureGroup[]).map((g) => ({
    group: g,
    items: options.features.filter((f) => f.feature_group === g),
  }));

  const toggleIn = (key: 'facades' | 'views', value: string) =>
    set(key, form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value]);
  const toggleFeature = (id: number) =>
    set('feature_ids', form.feature_ids.includes(id) ? form.feature_ids.filter((x) => x !== id) : [...form.feature_ids, id]);

  const toInput = (status: PropertyStatus): PropertyInput => ({
    ...form,
    status,
    listing_type: form.listing_type as PropertyInput['listing_type'],
    currency: form.currency as PropertyInput['currency'],
    location_precision: form.location_precision as PropertyInput['location_precision'],
    // Arsa için konut alanlarını gönderme
    ...(isLand
      ? {
          room_count: '',
          living_room_count: '',
          building_age: '',
          floor: '',
          total_floors: '',
          bathroom_count: '',
          balcony_count: '',
          heating: '',
          has_elevator: '',
          is_furnished: '',
          has_air_conditioning: '',
        }
      : { zoning_status: '', block_no: '', parcel_no: '', floor_area_ratio: '', height_limit: '' }),
  });

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs).find((k) => errs[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"], #pf-${first}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };

  const uploadPending = async (propertyId: string) => {
    let failed = 0;
    setUploadingNew(true);
    for (const item of pendingImages) {
      setPendingImages((list) => list.map((i) => (i.key === item.key ? { ...i, progress: 0, error: undefined } : i)));
      try {
        const blob = await prepareImageForUpload(item.file);
        await uploadPropertyImage(propertyId, blob, item.file.name, (progress) =>
          setPendingImages((list) => list.map((i) => (i.key === item.key ? { ...i, progress } : i))),
        );
      } catch (e) {
        failed += 1;
        setPendingImages((list) => list.map((i) => (i.key === item.key ? { ...i, error: e instanceof Error ? e.message : 'Hata' } : i)));
      }
    }
    setUploadingNew(false);
    return failed;
  };

  const submit = (status: PropertyStatus) => {
    startSaving(async () => {
      const res = await saveProperty(initial?.property.id ?? null, toInput(status));
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        if (res.fieldErrors) focusFirstError(res.fieldErrors);
        return;
      }
      setDirty(false);
      set('status', status);
      setDirty(false);
      if (!isEdit) {
        const failed = pendingImages.length ? await uploadPending(res.data.id) : 0;
        if (failed) toast.warning(`${failed} fotoğraf yüklenemedi. İlan düzenleme ekranından tekrar deneyebilirsiniz.`);
        toast.success(status === 'active' ? 'İlan yayınlandı' : 'İlan kaydedildi', { description: `İlan No: ${res.data.listingNo}` });
        router.replace(`/admin/ilan/${res.data.id}?yeni=1`);
      } else {
        toast.success(status === 'active' ? 'Değişiklikler yayında' : 'Değişiklikler kaydedildi');
        router.refresh();
      }
    });
  };

  const submitAddLocation = async () => {
    if (!addLoc) return;
    const parentId = Number(addLoc === 'district' ? form.city_id : form.district_id);
    const res = await addLocation(addLoc, parentId, newLocName);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (addLoc === 'district') {
      setLocations((l) => ({ ...l, districts: [...l.districts, { ...res.data, city_id: parentId, latitude: null, longitude: null }] }));
      setForm((f) => ({ ...f, district_id: String(res.data.id), neighborhood_id: '' }));
    } else {
      setLocations((l) => ({ ...l, neighborhoods: [...l.neighborhoods, { ...res.data, district_id: parentId, latitude: null, longitude: null }] }));
      setForm((f) => ({ ...f, neighborhood_id: String(res.data.id) }));
    }
    toast.success(`“${res.data.name}” eklendi`);
    setNewLocName('');
    setAddLoc(null);
  };

  const busy = saving || uploadingNew;
  const e = errors;
  const fid = (name: string) => `pf-${name}`;

  return (
    <form
      ref={formRef}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit(form.status as PropertyStatus);
      }}
      noValidate
      className="pb-28"
    >
      <nav aria-label="Form bölümleri" className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-sand-100/95 px-4 py-2 backdrop-blur lg:top-0">
        <ul className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-sand-700 hover:bg-surface hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-5">
        <Section id="genel" title="Genel Bilgiler" description="İlanın başlığı, türü ve açıklaması.">
          <div className="grid gap-5">
            <Field label="İlan başlığı" htmlFor={fid('title')} error={e.title} required hint={`${form.title.length}/120 · Ör. “Elvankent’te site içinde 3+1 satılık daire”`}>
              <Input id={fid('title')} name="title" value={form.title} maxLength={120} onChange={(ev) => set('title', ev.target.value)} aria-invalid={Boolean(e.title)} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold text-sand-700">
                İlan tipi <span className="text-danger">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {(['sale', 'rent'] as const).map((lt) => (
                  <label
                    key={lt}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition',
                      form.listing_type === lt ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface text-sand-700 hover:border-brand-300',
                    )}
                  >
                    <input type="radio" name="listing_type" value={lt} checked={form.listing_type === lt} onChange={() => set('listing_type', lt)} className="sr-only" />
                    {lt === 'sale' ? 'Satılık' : 'Kiralık'}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Emlak tipi" htmlFor={fid('property_type_id')} error={e.property_type_id} required>
              <Select id={fid('property_type_id')} name="property_type_id" value={form.property_type_id} onChange={(ev) => set('property_type_id', ev.target.value)} aria-invalid={Boolean(e.property_type_id)}>
                <option value="">Seçin</option>
                {(Object.keys(CATEGORY_LABELS) as PropertyCategory[]).map((c) => (
                  <optgroup key={c} label={CATEGORY_LABELS[c]}>
                    {options.propertyTypes
                      .filter((t) => t.category === c)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Açıklama" htmlFor={fid('description')} error={e.description} required hint={`${form.description.length}/10000 · Mülkü, çevresini ve öne çıkan özelliklerini anlatın.`}>
              <Textarea id={fid('description')} name="description" rows={8} value={form.description} maxLength={10000} onChange={(ev) => set('description', ev.target.value)} aria-invalid={Boolean(e.description)} />
            </Field>
          </div>
        </Section>

        <Section id="konum" title="Konum" description="Açık adres ve kesin konum ziyaretçilere gösterilmez (gizlilik ayarına göre).">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="İl" htmlFor={fid('city_id')} error={e.city_id} required>
              <Select id={fid('city_id')} name="city_id" value={form.city_id} onChange={(ev) => setForm((f) => ({ ...f, city_id: ev.target.value, district_id: '', neighborhood_id: '' }))}>
                <option value="">Seçin</option>
                {options.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <Field label="İlçe" htmlFor={fid('district_id')} error={e.district_id} required>
                <Select id={fid('district_id')} name="district_id" value={form.district_id} disabled={!city} onChange={(ev) => setForm((f) => ({ ...f, district_id: ev.target.value, neighborhood_id: '' }))}>
                  <option value="">{city ? 'Seçin' : 'Önce il seçin'}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {city && (
                <button type="button" onClick={() => setAddLoc('district')} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                  <Plus className="size-3.5" /> Listede yok mu? İlçe ekle
                </button>
              )}
            </div>
            <div>
              <Field label="Mahalle" htmlFor={fid('neighborhood_id')} error={e.neighborhood_id}>
                <Select id={fid('neighborhood_id')} name="neighborhood_id" value={form.neighborhood_id} disabled={!district} onChange={(ev) => set('neighborhood_id', ev.target.value)}>
                  <option value="">{district ? 'Seçin' : 'Önce ilçe seçin'}</option>
                  {neighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {district && (
                <button type="button" onClick={() => setAddLoc('neighborhood')} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                  <Plus className="size-3.5" /> Listede yok mu? Mahalle ekle
                </button>
              )}
            </div>
            <Field label="Açık adres (sadece yönetici görür)" htmlFor={fid('address')} error={e.address} className="sm:col-span-3">
              <Input id={fid('address')} name="address" value={form.address} maxLength={400} onChange={(ev) => set('address', ev.target.value)} placeholder="Sokak, bina no, daire no" />
            </Field>
          </div>

          <div className="mt-6">
            <Label>Harita konumu</Label>
            <p className="mb-3 text-sm text-sand-600">Haritada mülkün yerine tıklayın veya işareti sürükleyin.</p>
            <LazyMap
              className="h-80 overflow-hidden rounded-xl ring-1 ring-line"
              center={mapCenter}
              mode="pin"
              editable
              zoom={form.latitude ? 16 : 14}
              attribution={publicEnv.mapAttribution}
              ariaLabel="Mülk konumunu seçmek için harita"
              onChange={(p) => {
                setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
                setDirty(true);
              }}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label="Enlem" id={fid('latitude')} name="latitude" value={form.latitude} inputMode="decimal" placeholder="Enlem (ör. 39.9480)" onChange={(ev) => set('latitude', ev.target.value)} />
              <Input aria-label="Boylam" name="longitude" value={form.longitude} inputMode="decimal" placeholder="Boylam (ör. 32.6240)" onChange={(ev) => set('longitude', ev.target.value)} />
              {form.latitude && (
                <Button type="button" variant="ghost" onClick={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}>
                  Konumu temizle
                </Button>
              )}
            </div>
            {e.latitude && <p className="mt-1.5 text-[13px] font-medium text-danger">{e.latitude}</p>}
            <fieldset className="mt-5">
              <legend className="mb-2 text-[13px] font-semibold text-sand-700">Sitede konum nasıl gösterilsin?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['approximate', 'Yaklaşık bölge (önerilir)', 'Yaklaşık 300 m çaplı alan gösterilir'],
                    ['exact', 'Tam konum', 'İşaret tam noktada gösterilir'],
                    ['neighborhood', 'Sadece mahalle', 'Mahalle merkezi gösterilir'],
                  ] as const
                ).map(([v, label, hint]) => (
                  <label key={v} className={cn('cursor-pointer rounded-xl border p-3 transition', form.location_precision === v ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-300')}>
                    <input type="radio" name="location_precision" value={v} checked={form.location_precision === v} onChange={() => set('location_precision', v)} className="mr-2 accent-brand-700" />
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <span className="mt-0.5 block pl-5 text-[12px] text-sand-500">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>

        <Section id="fiyat" title="Fiyat">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={form.listing_type === 'rent' ? 'Aylık kira' : 'Fiyat'} htmlFor={fid('price')} error={e.price} required>
              <NumberInput id={fid('price')} name="price" value={form.price} onValueChange={(v) => set('price', v)} aria-invalid={Boolean(e.price)} />
            </Field>
            <Field label="Para birimi" htmlFor={fid('currency')}>
              <Select id={fid('currency')} value={form.currency} onChange={(ev) => set('currency', ev.target.value)}>
                {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end pb-2.5">
              <Checkbox label="Pazarlık payı var" checked={form.price_negotiable} onChange={(ev) => set('price_negotiable', ev.target.checked)} />
            </div>
            {!isLand && (
              <Field label="Aidat (aylık)" htmlFor={fid('dues')} error={e.dues}>
                <NumberInput id={fid('dues')} name="dues" value={form.dues} onValueChange={(v) => set('dues', v)} />
              </Field>
            )}
            {form.listing_type === 'rent' && (
              <Field label="Depozito" htmlFor={fid('deposit')} error={e.deposit}>
                <NumberInput id={fid('deposit')} name="deposit" value={form.deposit} onValueChange={(v) => set('deposit', v)} />
              </Field>
            )}
          </div>
        </Section>

        <Section id="temel" title="Temel Özellikler" description={isLand ? 'Arsa bilgileri' : 'Metrekare, oda, kat ve bina bilgileri'}>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Field label={isLand ? 'Alan (m²)' : 'Brüt m²'} htmlFor={fid('gross_m2')} error={e.gross_m2}>
              <NumberInput id={fid('gross_m2')} name="gross_m2" value={form.gross_m2} onValueChange={(v) => set('gross_m2', v)} />
            </Field>
            {!isLand && (
              <>
                <Field label="Net m²" htmlFor={fid('net_m2')} error={e.net_m2}>
                  <NumberInput id={fid('net_m2')} name="net_m2" value={form.net_m2} onValueChange={(v) => set('net_m2', v)} />
                </Field>
                <Field label="Oda" htmlFor={fid('room_count')} error={e.room_count}>
                  <Select id={fid('room_count')} name="room_count" value={form.room_count} onChange={(ev) => set('room_count', ev.target.value)}>
                    <option value="">—</option>
                    {Array.from({ length: 11 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 10 ? '10+' : i}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Salon" htmlFor={fid('living_room_count')} error={e.living_room_count}>
                  <Select id={fid('living_room_count')} name="living_room_count" value={form.living_room_count} onChange={(ev) => set('living_room_count', ev.target.value)}>
                    <option value="">—</option>
                    {[0, 1, 2, 3].map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Bina yaşı" htmlFor={fid('building_age')} error={e.building_age}>
                  <Input id={fid('building_age')} name="building_age" type="number" inputMode="numeric" min={0} max={200} value={form.building_age} onChange={(ev) => set('building_age', ev.target.value)} />
                </Field>
                <Field label="Bulunduğu kat" htmlFor={fid('floor')} error={e.floor}>
                  <Select id={fid('floor')} name="floor" value={form.floor} onChange={(ev) => set('floor', ev.target.value)}>
                    <option value="">—</option>
                    {FLOOR_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {/^\d+$/.test(f) ? `${f}. kat` : f}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Toplam kat" htmlFor={fid('total_floors')} error={e.total_floors}>
                  <Input id={fid('total_floors')} name="total_floors" type="number" inputMode="numeric" min={0} max={200} value={form.total_floors} onChange={(ev) => set('total_floors', ev.target.value)} />
                </Field>
                <Field label="Banyo" htmlFor={fid('bathroom_count')} error={e.bathroom_count}>
                  <Input id={fid('bathroom_count')} name="bathroom_count" type="number" inputMode="numeric" min={0} max={20} value={form.bathroom_count} onChange={(ev) => set('bathroom_count', ev.target.value)} />
                </Field>
                <Field label="Balkon" htmlFor={fid('balcony_count')} error={e.balcony_count}>
                  <Input id={fid('balcony_count')} name="balcony_count" type="number" inputMode="numeric" min={0} max={20} value={form.balcony_count} onChange={(ev) => set('balcony_count', ev.target.value)} />
                </Field>
              </>
            )}
            {isLand && (
              <>
                <Field label="İmar durumu" htmlFor={fid('zoning_status')}>
                  <Select id={fid('zoning_status')} value={form.zoning_status} onChange={(ev) => set('zoning_status', ev.target.value)}>
                    <option value="">—</option>
                    {ZONING_OPTIONS.map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ada no" htmlFor={fid('block_no')} error={e.block_no}>
                  <Input id={fid('block_no')} name="block_no" value={form.block_no} maxLength={20} onChange={(ev) => set('block_no', ev.target.value)} />
                </Field>
                <Field label="Parsel no" htmlFor={fid('parcel_no')} error={e.parcel_no}>
                  <Input id={fid('parcel_no')} name="parcel_no" value={form.parcel_no} maxLength={20} onChange={(ev) => set('parcel_no', ev.target.value)} />
                </Field>
                <Field label="KAKS (Emsal)" htmlFor={fid('floor_area_ratio')} error={e.floor_area_ratio}>
                  <Input id={fid('floor_area_ratio')} name="floor_area_ratio" inputMode="decimal" value={form.floor_area_ratio} onChange={(ev) => set('floor_area_ratio', ev.target.value.replace(',', '.'))} placeholder="Ör. 1.20" />
                </Field>
                <Field label="Gabari" htmlFor={fid('height_limit')} error={e.height_limit}>
                  <Input id={fid('height_limit')} name="height_limit" value={form.height_limit} maxLength={30} onChange={(ev) => set('height_limit', ev.target.value)} placeholder="Ör. 4 kat / 12.50 m" />
                </Field>
              </>
            )}
          </div>
        </Section>

        <Section id="ozellikler" title="Özellikler" description="Bilmediğiniz alanları “Belirtilmemiş” bırakabilirsiniz; sitede gösterilmez.">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {!isLand && (
              <>
                <Field label="Isıtma" htmlFor={fid('heating')}>
                  <Select id={fid('heating')} value={form.heating} onChange={(ev) => set('heating', ev.target.value)}>
                    <option value="">Belirtilmemiş</option>
                    {HEATING_OPTIONS.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Asansör" htmlFor={fid('has_elevator')}>
                  <TriSelect id={fid('has_elevator')} value={form.has_elevator} onChange={(v) => set('has_elevator', v)} />
                </Field>
                <Field label="Klima" htmlFor={fid('has_air_conditioning')}>
                  <TriSelect id={fid('has_air_conditioning')} value={form.has_air_conditioning} onChange={(v) => set('has_air_conditioning', v)} />
                </Field>
                {isResidential && (
                  <Field label="Eşyalı" htmlFor={fid('is_furnished')}>
                    <TriSelect id={fid('is_furnished')} value={form.is_furnished} onChange={(v) => set('is_furnished', v)} />
                  </Field>
                )}
              </>
            )}
            <Field label="Otopark" htmlFor={fid('parking')}>
              <Select id={fid('parking')} value={form.parking} onChange={(ev) => set('parking', ev.target.value)}>
                <option value="">Belirtilmemiş</option>
                {PARKING_OPTIONS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
            <Field label="Site içerisinde" htmlFor={fid('in_complex')}>
              <TriSelect id={fid('in_complex')} value={form.in_complex} onChange={(v) => set('in_complex', v)} />
            </Field>
            {form.in_complex === 'true' && (
              <Field label="Site adı" htmlFor={fid('complex_name')} error={e.complex_name}>
                <Input id={fid('complex_name')} value={form.complex_name} maxLength={120} onChange={(ev) => set('complex_name', ev.target.value)} />
              </Field>
            )}
            <Field label="Krediye uygun" htmlFor={fid('credit_eligible')}>
              <TriSelect id={fid('credit_eligible')} value={form.credit_eligible} onChange={(v) => set('credit_eligible', v)} />
            </Field>
            <Field label="Tapu durumu" htmlFor={fid('deed_status')}>
              <Select id={fid('deed_status')} value={form.deed_status} onChange={(ev) => set('deed_status', ev.target.value)}>
                <option value="">Belirtilmemiş</option>
                {DEED_STATUS_OPTIONS.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </Select>
            </Field>
            {!isLand && (
              <Field label="Kullanım durumu" htmlFor={fid('usage_status')}>
                <Select id={fid('usage_status')} value={form.usage_status} onChange={(ev) => set('usage_status', ev.target.value)}>
                  <option value="">Belirtilmemiş</option>
                  {USAGE_STATUS_OPTIONS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Takas" htmlFor={fid('swap_available')}>
              <TriSelect id={fid('swap_available')} value={form.swap_available} onChange={(v) => set('swap_available', v)} />
            </Field>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-sand-700">Cephe</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {FACADE_OPTIONS.map((o) => (
                  <Checkbox key={o} label={o} checked={form.facades.includes(o)} onChange={() => toggleIn('facades', o)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-sand-700">Manzara</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {VIEW_OPTIONS.map((o) => (
                  <Checkbox key={o} label={o} checked={form.views.includes(o)} onChange={() => toggleIn('views', o)} />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-7 grid gap-6 border-t border-line pt-6 sm:grid-cols-2 xl:grid-cols-4">
            {featuresByGroup.map(({ group, items }) => (
              <fieldset key={group}>
                <legend className="mb-2.5 text-sm font-bold text-ink">{FEATURE_GROUP_LABELS[group]}</legend>
                <div className="grid gap-2">
                  {items.map((f) => (
                    <Checkbox key={f.id} label={f.label} checked={form.feature_ids.includes(f.id)} onChange={() => toggleFeature(f.id)} />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Section>

        <Section id="fotograflar" title="Fotoğraflar" description="İyi ışıkta, yatay çekilmiş fotoğraflar ilanın ilgi görmesini sağlar.">
          {initial ? (
            <ImageManager propertyId={initial.property.id} initialImages={initial.images} />
          ) : (
            <PendingImagePicker items={pendingImages} onChange={setPendingImages} uploading={uploadingNew} />
          )}
        </Section>

        <Section id="yayin" title="Yayın Ayarları">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="İlan durumu" htmlFor={fid('status')} hint="“Yayında” olmayan ilanlar sitede görünmez.">
              <Select id={fid('status')} value={form.status} onChange={(ev) => set('status', ev.target.value)}>
                {(Object.keys(STATUS_LABELS) as PropertyStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end pb-2.5">
              <Checkbox label="Öne çıkan ilan (ana sayfada gösterilir)" checked={form.is_featured} onChange={(ev) => set('is_featured', ev.target.checked)} />
            </div>
            <Field
              label="Arama motoru açıklaması (isteğe bağlı)"
              htmlFor={fid('meta_description')}
              error={e.meta_description}
              hint="Boş bırakırsanız açıklamadan otomatik oluşturulur. En fazla 300 karakter."
              className="sm:col-span-2"
            >
              <Textarea id={fid('meta_description')} rows={2} maxLength={300} value={form.meta_description} onChange={(ev) => set('meta_description', ev.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 sm:px-2 lg:px-4">
          <p className="hidden text-sm text-sand-600 sm:block">
            {uploadingNew ? (
              'Fotoğraflar yükleniyor…'
            ) : dirty ? (
              'Kaydedilmemiş değişiklikler var'
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" aria-hidden /> {isEdit ? 'Tüm değişiklikler kaydedildi' : 'Yeni ilan'}
              </span>
            )}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            {isEdit ? (
              <Button type="submit" size="lg" loading={busy} className="flex-1 sm:flex-none">
                {!busy && <Save />} Kaydet
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="lg" loading={busy} onClick={() => submit('draft')} className="flex-1 sm:flex-none">
                  Taslak kaydet
                </Button>
                <Button type="button" size="lg" loading={busy} onClick={() => submit('active')} className="flex-1 sm:flex-none">
                  {!busy && <Rocket />} Yayınla
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(addLoc)} onOpenChange={(o) => !o && setAddLoc(null)}>
        <DialogContent title={addLoc === 'district' ? 'Yeni ilçe ekle' : 'Yeni mahalle ekle'} description={addLoc === 'district' ? `${city?.name ?? ''} iline eklenecek.` : `${district?.name ?? ''} ilçesine eklenecek.`}>
          <div className="mt-4">
            <Label htmlFor="new-loc">Ad</Label>
            <Input id="new-loc" value={newLocName} onChange={(ev) => setNewLocName(ev.target.value)} maxLength={80} autoFocus onKeyDown={(ev) => ev.key === 'Enter' && (ev.preventDefault(), void submitAddLocation())} />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Vazgeç
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => void submitAddLocation()} disabled={newLocName.trim().length < 2}>
              Ekle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
