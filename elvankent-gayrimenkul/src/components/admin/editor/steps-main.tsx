'use client';

import { useMemo } from 'react';
import { Info, MapPin } from 'lucide-react';
import { LazyMap } from '@/components/maps/lazy-map';
import { SegmentedControl } from '@/components/ui/choice';
import { Checkbox, Field, Input, Switch } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  CURRENCY_LABELS,
  DEED_STATUS_OPTIONS,
  FACADE_OPTIONS,
  FEATURE_GROUP_LABELS,
  FLOOR_OPTIONS,
  HEATING_OPTIONS,
  PARKING_OPTIONS,
  PRECISION_LABELS,
  roomsLabel,
  USAGE_STATUS_OPTIONS,
  VIEW_OPTIONS,
  ZONING_OPTIONS,
  type CurrencyCode,
  type ListingType,
  type LocationPrecision,
} from '@/modules/properties/constants';
import { useEditor } from './editor-context';
import { MultiChips, NumberField, SelectField, StepSection, TextAreaField, TextField, TriState } from './fields';

export function StepBasics() {
  const { values, set, errors, taxonomy, readOnly } = useEditor();
  const types = taxonomy.propertyTypes.map((t) => ({ value: t.id, label: t.name, group: CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS] }));
  const isRent = values.listing_type === 'rent';
  return (
    <div className="space-y-8">
      <StepSection title="İlan" description="Başlık ilanın sitedeki, arama motorlarındaki ve paylaşımlardaki adıdır.">
        <div className="space-y-5">
          <TextField
            label="İlan başlığı"
            name="title"
            required
            value={values.title}
            onChange={(v) => set('title', v)}
            maxLength={120}
            counter
            errors={errors}
            disabled={readOnly}
            hint="Örnek: “Elvankent’te site içinde, güney cepheli satılık 3+1 daire”. Yayın için en az 10 karakter."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-foreground/85">İlan türü</p>
              <SegmentedControl<ListingType>
                label="İlan türü"
                value={values.listing_type}
                onValueChange={(v) => !readOnly && set('listing_type', v)}
                options={[
                  { value: 'sale', label: 'Satılık' },
                  { value: 'rent', label: 'Kiralık' },
                ]}
                className="w-full"
              />
            </div>
            <SelectField
              label="Emlak tipi"
              name="property_type_id"
              required
              value={values.property_type_id}
              onChange={(v) => v && set('property_type_id', Number(v))}
              options={types}
              errors={errors}
              disabled={readOnly}
            />
          </div>
        </div>
      </StepSection>

      <StepSection title="Fiyat" description="Fiyat girilmezse sitede “Fiyat için arayın” yazar; yayınlamak için fiyat gerekir.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_10rem]">
          <NumberField label={isRent ? 'Aylık kira' : 'Satış fiyatı'} name="price" value={values.price} onChange={(v) => set('price', v)} errors={errors} disabled={readOnly} />
          <SelectField
            label="Para birimi"
            name="currency"
            value={values.currency}
            onChange={(v) => v && set('currency', v as CurrencyCode)}
            options={Object.entries(CURRENCY_LABELS).map(([value, label]) => ({ value, label }))}
            placeholder="Seçin"
            errors={errors}
            disabled={readOnly}
          />
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <NumberField label="Aidat (aylık)" name="dues" value={values.dues} onChange={(v) => set('dues', v)} suffix="₺" errors={errors} disabled={readOnly} />
          {isRent && <NumberField label="Depozito" name="deposit" value={values.deposit} onChange={(v) => set('deposit', v)} suffix="₺" errors={errors} disabled={readOnly} />}
        </div>
        <div className="mt-5">
          <Switch
            label="Pazarlık payı var"
            description="İlan sayfasında “Pazarlık payı var” ibaresi gösterilir."
            checked={values.price_negotiable}
            onCheckedChange={(v) => set('price_negotiable', v)}
            disabled={readOnly}
          />
        </div>
      </StepSection>
    </div>
  );
}

export function StepLocation() {
  const { values, set, errors, taxonomy, location, setLocation, map, readOnly } = useEditor();
  const districts = taxonomy.districts.filter((d) => d.city_id === values.city_id);
  const neighborhoods = taxonomy.neighborhoods.filter((n) => n.district_id === values.district_id);
  const fallbackCenter = useMemo(() => {
    const n = taxonomy.neighborhoods.find((x) => x.id === values.neighborhood_id);
    const d = taxonomy.districts.find((x) => x.id === values.district_id);
    const c = taxonomy.cities.find((x) => x.id === values.city_id) ?? taxonomy.cities[0];
    const point = [n, d, c].find((x) => x?.latitude !== null && x?.latitude !== undefined && x?.longitude !== null);
    return point ? { lat: Number(point.latitude), lng: Number(point.longitude) } : { lat: 39.925, lng: 32.837 };
  }, [taxonomy, values.city_id, values.district_id, values.neighborhood_id]);
  const center = location.latitude !== null && location.longitude !== null ? { lat: location.latitude, lng: location.longitude } : fallbackCenter;

  return (
    <div className="space-y-8">
      <StepSection title="Bölge" description="İlanlar il, ilçe ve mahalleye göre listelenir ve filtrelenir.">
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            label="İl"
            name="city_id"
            required
            value={values.city_id}
            onChange={(v) => {
              set('city_id', v ? Number(v) : null);
              set('district_id', null);
              set('neighborhood_id', null);
            }}
            options={taxonomy.cities.map((c) => ({ value: c.id, label: c.name }))}
            errors={errors}
            disabled={readOnly}
          />
          <SelectField
            label="İlçe"
            name="district_id"
            required
            value={values.district_id}
            onChange={(v) => {
              set('district_id', v ? Number(v) : null);
              set('neighborhood_id', null);
            }}
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
            errors={errors}
            disabled={readOnly || !values.city_id}
          />
          <SelectField
            label="Mahalle"
            name="neighborhood_id"
            value={values.neighborhood_id}
            onChange={(v) => set('neighborhood_id', v ? Number(v) : null)}
            options={neighborhoods.map((n) => ({ value: n.id, label: n.name }))}
            errors={errors}
            disabled={readOnly || !values.district_id}
            placeholder={neighborhoods.length ? 'Seçin' : 'Bu ilçe için mahalle yok'}
          />
        </div>
      </StepSection>

      <StepSection
        title="Harita konumu ve adres"
        description="Açık adres ve kesin nokta yalnızca ofis üyelerine görünür. Ziyaretçilere hangi hassasiyetle gösterileceğini aşağıdan seçin."
      >
        <Field label="Açık adres (gizli)" htmlFor="loc-address" hint="Sitede gösterilmez; yer gösterme ve randevular için ekibinize not.">
          <Input id="loc-address" value={location.address ?? ''} maxLength={300} onChange={(e) => setLocation({ address: e.target.value })} disabled={readOnly} />
        </Field>
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-foreground/85">
            <MapPin className="size-4" aria-hidden /> Haritada işaretleyin
            <span className="font-normal text-muted-foreground">— haritaya tıklayın veya işareti sürükleyin</span>
          </p>
          <LazyMap
            key={`${fallbackCenter.lat}-${fallbackCenter.lng}-${location.latitude === null}`}
            center={center}
            mode="pin"
            editable={!readOnly}
            onChange={(p) => setLocation({ latitude: Number(p.lat.toFixed(6)), longitude: Number(p.lng.toFixed(6)) })}
            zoom={location.latitude !== null ? 16 : 14}
            attribution={map.attribution}
            maxZoom={map.maxZoom}
            ariaLabel="İlan konumu seçimi"
            className="h-[340px] overflow-hidden rounded-2xl border border-border"
          />
          <p className="numeric mt-2 text-[12.5px] text-muted-foreground">
            {location.latitude !== null ? `Seçilen nokta: ${location.latitude}, ${location.longitude}` : 'Henüz nokta seçilmedi (mahalle/ilçe merkezi kullanılır).'}
            {location.latitude !== null && !readOnly && (
              <button type="button" className="ml-2 font-semibold text-primary-ink hover:underline" onClick={() => setLocation({ latitude: null, longitude: null })}>
                Noktayı kaldır
              </button>
            )}
          </p>
        </div>
        <div className="mt-6">
          <p className="mb-2 text-[13px] font-semibold text-foreground/85">Sitede gösterim</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['approximate', 'neighborhood', 'exact'] as LocationPrecision[]).map((p) => (
              <button
                key={p}
                type="button"
                disabled={readOnly}
                aria-pressed={values.location_precision === p}
                onClick={() => set('location_precision', p)}
                className={cn(
                  'rounded-xl border px-3.5 py-3 text-left text-[13px] transition',
                  values.location_precision === p ? 'border-primary bg-primary-soft text-primary-ink' : 'border-border hover:border-border-strong',
                )}
              >
                <span className="block font-semibold">{PRECISION_LABELS[p]}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {p === 'approximate' && 'Önerilen: yaklaşık 200 m çaplı alan.'}
                  {p === 'neighborhood' && 'Yalnızca mahalle bölgesi gösterilir.'}
                  {p === 'exact' && 'Kesin nokta herkese açık olur.'}
                </span>
              </button>
            ))}
          </div>
          {values.location_precision === 'exact' && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-[12.5px] text-warning">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Kesin konum paylaşmadan önce mülk sahibinin onayını alın.
            </p>
          )}
        </div>
      </StepSection>
    </div>
  );
}

export function StepDetails() {
  const { values, set, errors, taxonomy, featureIds, setFeatureIds, readOnly } = useEditor();
  const category = taxonomy.propertyTypes.find((t) => t.id === values.property_type_id)?.category ?? 'konut';
  const isLand = category === 'arsa';
  const isBuilding = category === 'konut' || category === 'ticari';
  const groups = useMemo(() => {
    const allowed = isLand ? ['arsa', 'ulasim', 'muhit', 'diger'] : category === 'ticari' ? ['ticari', 'ic', 'dis', 'ulasim', 'muhit', 'diger'] : ['konut', 'ic', 'dis', 'ulasim', 'muhit', 'diger'];
    return allowed
      .map((g) => ({ key: g, label: FEATURE_GROUP_LABELS[g] ?? g, items: taxonomy.features.filter((f) => f.feature_group === g) }))
      .filter((g) => g.items.length > 0);
  }, [taxonomy.features, category, isLand]);

  return (
    <div className="space-y-8">
      <StepSection title="Alan ve oda">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Brüt alan" name="gross_m2" suffix="m²" value={values.gross_m2} onChange={(v) => set('gross_m2', v)} errors={errors} disabled={readOnly} />
          {!isLand && <NumberField label="Net alan" name="net_m2" suffix="m²" value={values.net_m2} onChange={(v) => set('net_m2', v)} errors={errors} disabled={readOnly} />}
          {isBuilding && (
            <>
              <NumberField label="Oda sayısı" name="room_count" value={values.room_count} max={50} onChange={(v) => set('room_count', v)} errors={errors} disabled={readOnly} />
              <NumberField
                label="Salon sayısı"
                name="living_room_count"
                value={values.living_room_count}
                max={10}
                onChange={(v) => set('living_room_count', v)}
                errors={errors}
                disabled={readOnly}
                hint={roomsLabel(values.room_count, values.living_room_count) ? `Sitede: ${roomsLabel(values.room_count, values.living_room_count)}` : undefined}
              />
              <NumberField label="Banyo sayısı" name="bathroom_count" value={values.bathroom_count} max={20} onChange={(v) => set('bathroom_count', v)} errors={errors} disabled={readOnly} />
              <NumberField label="Balkon sayısı" name="balcony_count" value={values.balcony_count} max={20} onChange={(v) => set('balcony_count', v)} errors={errors} disabled={readOnly} />
            </>
          )}
        </div>
      </StepSection>

      {isBuilding && (
        <StepSection title="Bina">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Bulunduğu kat" name="floor" value={values.floor} onChange={(v) => set('floor', v)} options={FLOOR_OPTIONS} errors={errors} disabled={readOnly} />
            <NumberField label="Kat sayısı" name="total_floors" value={values.total_floors} max={200} onChange={(v) => set('total_floors', v)} errors={errors} disabled={readOnly} />
            <NumberField label="Bina yaşı" name="building_age" value={values.building_age} max={200} onChange={(v) => set('building_age', v)} errors={errors} disabled={readOnly} hint="Yeni bina için 0" />
            <SelectField label="Isıtma" name="heating" value={values.heating} onChange={(v) => set('heating', v)} options={HEATING_OPTIONS} errors={errors} disabled={readOnly} />
            <SelectField label="Otopark" name="parking" value={values.parking} onChange={(v) => set('parking', v)} options={PARKING_OPTIONS} errors={errors} disabled={readOnly} />
            <SelectField label="Kullanım durumu" name="usage_status" value={values.usage_status} onChange={(v) => set('usage_status', v)} options={USAGE_STATUS_OPTIONS} errors={errors} disabled={readOnly} />
          </div>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <TriState label="Asansör" value={values.has_elevator} onChange={(v) => set('has_elevator', v)} disabled={readOnly} />
            <TriState label="Eşyalı" value={values.is_furnished} onChange={(v) => set('is_furnished', v)} disabled={readOnly} />
            <TriState label="Site içinde" value={values.in_complex} onChange={(v) => set('in_complex', v)} disabled={readOnly} />
            <TriState label="Klima" value={values.has_air_conditioning} onChange={(v) => set('has_air_conditioning', v)} disabled={readOnly} />
          </div>
          {values.in_complex && (
            <TextField className="mt-5" label="Site adı" name="complex_name" value={values.complex_name} onChange={(v) => set('complex_name', v)} maxLength={120} errors={errors} disabled={readOnly} />
          )}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <MultiChips label="Cephe" options={FACADE_OPTIONS} value={values.facades} onChange={(v) => set('facades', v)} />
            <MultiChips label="Manzara" options={VIEW_OPTIONS} value={values.views} onChange={(v) => set('views', v)} />
          </div>
        </StepSection>
      )}

      {isLand && (
        <StepSection title="Arsa ve imar">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="İmar durumu" name="zoning_status" value={values.zoning_status} onChange={(v) => set('zoning_status', v)} options={ZONING_OPTIONS} errors={errors} disabled={readOnly} />
            <TextField label="Ada no" name="block_no" value={values.block_no} onChange={(v) => set('block_no', v)} maxLength={20} errors={errors} disabled={readOnly} />
            <TextField label="Parsel no" name="parcel_no" value={values.parcel_no} onChange={(v) => set('parcel_no', v)} maxLength={20} errors={errors} disabled={readOnly} />
            <Field label="Emsal (KAKS)" htmlFor="far" error={errors.floor_area_ratio} hint="Ör. 1,50">
              <Input
                id="far"
                inputMode="decimal"
                defaultValue={values.floor_area_ratio !== null ? String(values.floor_area_ratio).replace('.', ',') : ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim().replace(',', '.');
                  set('floor_area_ratio', raw === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : values.floor_area_ratio);
                }}
                disabled={readOnly}
              />
            </Field>
            <TextField label="Gabari" name="height_limit" value={values.height_limit} onChange={(v) => set('height_limit', v)} maxLength={30} errors={errors} disabled={readOnly} hint="Ör. 12,50 m / Serbest" />
          </div>
        </StepSection>
      )}

      <StepSection title="Tapu ve işlem">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Tapu durumu" name="deed_status" value={values.deed_status} onChange={(v) => set('deed_status', v)} options={DEED_STATUS_OPTIONS} errors={errors} disabled={readOnly} />
        </div>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {values.listing_type === 'sale' && <TriState label="Krediye uygun" value={values.credit_eligible} onChange={(v) => set('credit_eligible', v)} disabled={readOnly} />}
          <TriState label="Takasa uygun" value={values.swap_available} onChange={(v) => set('swap_available', v)} disabled={readOnly} />
          <TriState label="Yatırıma uygun" value={values.investment_suitable} onChange={(v) => set('investment_suitable', v)} disabled={readOnly} />
        </div>
      </StepSection>

      {groups.length > 0 && (
        <StepSection title="Olanaklar ve çevre" description="İlan sayfasında gruplar hâlinde gösterilir.">
          <div className="space-y-6">
            {groups.map((group) => (
              <fieldset key={group.key}>
                <legend className="mb-2.5 text-[13px] font-semibold text-foreground/85">{group.label}</legend>
                <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((f) => (
                    <Checkbox
                      key={f.id}
                      label={f.label}
                      checked={featureIds.includes(f.id)}
                      disabled={readOnly}
                      onChange={(e) => setFeatureIds(e.target.checked ? [...featureIds, f.id] : featureIds.filter((x) => x !== f.id))}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </StepSection>
      )}
    </div>
  );
}

export function StepDescription() {
  const { values, set, errors, readOnly } = useEditor();
  const length = (values.description ?? '').trim().length;
  return (
    <StepSection
      title="Açıklama"
      description="Mülkü dürüst ve anlaşılır biçimde anlatın: öne çıkan özellikler, çevre, ulaşım, kullanım durumu. Abartılı veya doğrulanamayan ifadelerden kaçının."
    >
      <TextAreaField
        label="İlan açıklaması"
        name="description"
        value={values.description}
        onChange={(v) => set('description', v)}
        maxLength={10_000}
        rows={14}
        errors={errors}
        disabled={readOnly}
        hint={length < 50 ? `Yayın için en az 50 karakter (${50 - length} karakter daha).` : length < 300 ? 'İyi bir başlangıç. 300+ karakter arama görünürlüğüne yardımcı olur.' : 'Harika, açıklama yeterli uzunlukta.'}
        placeholder={'Örnek:\n• Güney cepheli, gün boyu güneş alan salon\n• Site içinde, kapalı otopark ve çocuk oyun alanı\n• Metro istasyonuna yürüme mesafesinde'}
      />
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        Satır başları korunur. Telefon numarası ve e-posta yazmanıza gerek yoktur; iletişim butonları ilan sayfasında otomatik gösterilir.
      </p>
    </StepSection>
  );
}
