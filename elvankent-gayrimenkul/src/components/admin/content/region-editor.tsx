'use client';

import { useDistrictNeighborhoods } from '@/components/admin/use-neighborhoods';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { StepSection, TextAreaField, TextField } from '@/components/admin/editor/fields';
import { MarkdownEditor } from '@/components/admin/content/markdown-editor';
import { SerpPreview } from '@/components/admin/content/serp-preview';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/choice';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { deleteRegionPage, saveRegionPage } from '@/app/actions/admin-content';
import { slugify } from '@/lib/slug';

export interface RegionEditorInitial {
  id: string;
  slug: string;
  name: string;
  cityId: number;
  districtId: number | null;
  neighborhoodId: number | null;
  intro: string | null;
  body: string;
  faqs: { q: string; a: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: 'draft' | 'published';
  sortOrder: number;
}

interface LocationOptions {
  cities: { id: number; name: string }[];
  districts: { id: number; city_id: number; name: string }[];
  neighborhoods: { id: number; district_id: number; name: string }[];
}

type Faq = { key: number; q: string; a: string };

let faqKey = 0;

export function RegionEditor({ initial, locations, siteBase, siteHost }: { initial: RegionEditorInitial | null; locations: LocationOptions; siteBase: string; siteHost: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [cityId, setCityId] = useState<number | ''>(initial?.cityId ?? (locations.cities.length === 1 ? locations.cities[0].id : ''));
  const [districtId, setDistrictId] = useState<number | ''>(initial?.districtId ?? '');
  const [neighborhoodId, setNeighborhoodId] = useState<number | ''>(initial?.neighborhoodId ?? '');
  const [intro, setIntro] = useState(initial?.intro ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [faqs, setFaqs] = useState<Faq[]>(() => (initial?.faqs ?? []).map((f) => ({ key: ++faqKey, ...f })));
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [savedStatus, setSavedStatus] = useState(initial?.status ?? null);
  const [savedSlug, setSavedSlug] = useState(initial?.slug ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = JSON.stringify([name, slug, cityId, districtId, neighborhoodId, intro, body, faqs.map((f) => [f.q, f.a]), seoTitle, seoDescription, status, sortOrder]);
  const [snapshot, setSnapshot] = useState(current);
  const dirty = current !== snapshot;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const districts = useMemo(() => locations.districts.filter((d) => d.city_id === cityId), [locations.districts, cityId]);
  const { items: neighborhoods } = useDistrictNeighborhoods(districtId, locations.neighborhoods);

  function updateFaq(key: number, patch: Partial<Faq>) {
    setFaqs((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }
  function moveFaq(index: number, delta: number) {
    setFaqs((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setPending(true);
    setErrors({});
    const res = await saveRegionPage(initial?.id ?? null, {
      name,
      slug,
      city_id: cityId === '' ? 0 : cityId,
      district_id: districtId === '' ? null : districtId,
      neighborhood_id: neighborhoodId === '' ? null : neighborhoodId,
      intro,
      body,
      faqs: faqs.filter((f) => f.q.trim() || f.a.trim()).map((f) => ({ q: f.q, a: f.a })),
      seo_title: seoTitle,
      seo_description: seoDescription,
      status,
      sort_order: sortOrder === '' ? 0 : Number(sortOrder),
    });
    setPending(false);
    if (!res.ok) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
      setErrors(next);
      toast.error(res.error);
      return;
    }
    setSlug(res.data.slug);
    setSavedSlug(res.data.slug);
    setSavedStatus(status);
    setSnapshot(JSON.stringify([name, res.data.slug, cityId, districtId, neighborhoodId, intro, body, faqs.map((f) => [f.q, f.a]), seoTitle, seoDescription, status, sortOrder]));
    toast.success('Bölge sayfası kaydedildi.');
    if (!initial) router.replace(`/admin/bolgeler/${res.data.id}`);
    else router.refresh();
  }

  const path = `/bolgeler/${slug || slugify(name) || 'bolge'}`;
  const faqError = Object.entries(errors).find(([k]) => k.startsWith('faqs'))?.[1];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <TextField
            label="Bölge adı"
            name="name"
            required
            value={name}
            onChange={(v) => {
              setName(v);
              if (!slugTouched) setSlug(slugify(v, 80));
            }}
            maxLength={80}
            errors={errors}
            placeholder="ör. Elvankent"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="İl" htmlFor="region-city" required error={errors.city_id}>
              <Select
                id="region-city"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value ? Number(e.target.value) : '');
                  setDistrictId('');
                  setNeighborhoodId('');
                }}
              >
                <option value="">Seçin</option>
                {locations.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="İlçe" htmlFor="region-district" optional error={errors.district_id}>
              <Select
                id="region-district"
                value={districtId}
                disabled={cityId === ''}
                onChange={(e) => {
                  setDistrictId(e.target.value ? Number(e.target.value) : '');
                  setNeighborhoodId('');
                }}
              >
                <option value="">Tüm il</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mahalle" htmlFor="region-neighborhood" optional error={errors.neighborhood_id}>
              <Select id="region-neighborhood" value={neighborhoodId} disabled={districtId === ''} onChange={(e) => setNeighborhoodId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Tüm ilçe</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="-mt-2 text-[12.5px] text-muted-foreground">Sayfada bu konumdaki yayında ilanlar ve ilanlardan hesaplanan fiyat aralıkları otomatik gösterilir.</p>
          <TextAreaField
            label="Giriş metni"
            name="intro"
            value={intro}
            onChange={setIntro}
            maxLength={600}
            rows={3}
            errors={errors}
            hint="Sayfanın başında görünür. Doğrulanmamış iddia (en iyi, en ucuz vb.) kullanmayın."
          />
          <MarkdownEditor
            label="Bölge rehberi"
            value={body}
            onChange={setBody}
            maxLength={20000}
            rows={14}
            error={errors.body}
            hint="Ulaşım, sosyal olanaklar, konut dokusu gibi bilgiler. İlan yoksa ve metin 400 karakterden kısaysa sayfa arama motorlarına kapatılır."
          />
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <StepSection title="Sık sorulan sorular" description="En fazla 20 soru. Yanıtlar sade metin olarak gösterilir; doğrulayamadığınız bilgi yazmayın.">
            {faqs.length === 0 && <p className="rounded-xl border border-dashed border-border-strong p-5 text-center text-sm text-muted-foreground">Henüz soru eklenmedi.</p>}
            <ol className="space-y-4">
              {faqs.map((f, i) => (
                <li key={f.key} className="rounded-xl border border-border p-4">
                  <div className="flex items-start gap-2">
                    <span className="numeric mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-bold">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <label className="sr-only" htmlFor={`faq-q-${f.key}`}>
                        Soru {i + 1}
                      </label>
                      <Input id={`faq-q-${f.key}`} value={f.q} maxLength={300} onChange={(e) => updateFaq(f.key, { q: e.target.value })} placeholder="Soru" className="h-10" />
                      <label className="sr-only" htmlFor={`faq-a-${f.key}`}>
                        Yanıt {i + 1}
                      </label>
                      <Textarea id={`faq-a-${f.key}`} value={f.a} maxLength={2000} rows={3} onChange={(e) => updateFaq(f.key, { a: e.target.value })} placeholder="Yanıt" className="min-h-20" />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button size="icon-xs" variant="ghost" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => moveFaq(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Aşağı taşı" disabled={i === faqs.length - 1} onClick={() => moveFaq(i, 1)}>
                        <ArrowDown />
                      </Button>
                      <Button size="icon-xs" variant="danger-ghost" aria-label="Soruyu sil" onClick={() => setFaqs((list) => list.filter((x) => x.key !== f.key))}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {faqError && (
              <p role="alert" className="mt-3 text-[13px] font-medium text-danger">
                {faqError}
              </p>
            )}
            <Button variant="outline" className="mt-4" disabled={faqs.length >= 20} onClick={() => setFaqs((list) => [...list, { key: ++faqKey, q: '', a: '' }])}>
              <Plus /> Soru ekle
            </Button>
          </StepSection>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <StepSection title="Arama motoru (SEO)" description="Boş bırakılırsa bölge adı ve giriş metninden oluşturulur.">
            <div className="space-y-5">
              <SerpPreview host={siteHost} path={path} title={seoTitle || `${name || 'Bölge'} satılık ve kiralık gayrimenkuller`} description={seoDescription || intro} />
              <TextField label="SEO başlığı" name="seo_title" value={seoTitle} onChange={setSeoTitle} maxLength={70} counter errors={errors} />
              <TextAreaField label="Meta açıklama" name="seo_description" value={seoDescription} onChange={setSeoDescription} maxLength={200} rows={3} errors={errors} />
              <Field
                label="Sayfa adresi (URL)"
                htmlFor="region-slug"
                error={errors.slug}
                hint={savedStatus === 'published' ? 'Yayındaki sayfanın adresi değişirse eski adres yeni adrese otomatik yönlendirilir.' : 'Boş bırakılırsa bölge adından oluşturulur.'}
              >
                <div className="flex min-w-0 items-center rounded-xl border border-border bg-surface-muted pl-3.5 text-sm text-muted-foreground">
                  <span className="shrink-0">/bolgeler/</span>
                  <Input
                    id="region-slug"
                    value={slug}
                    maxLength={80}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase());
                    }}
                    onBlur={() => setSlug(slugify(slug, 80))}
                    className="min-w-0 rounded-l-none border-0 bg-surface pl-1 focus:ring-0"
                  />
                </div>
              </Field>
            </div>
          </StepSection>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <h2 className="text-[15.5px] font-bold">Yayın</h2>
          <SegmentedControl<'draft' | 'published'>
            label="Yayın durumu"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: 'draft', label: 'Taslak' },
              { value: 'published', label: 'Yayında' },
            ]}
            className="w-full [&>button]:flex-1"
          />
          <Field label="Sıralama" htmlFor="region-sort" hint="Küçük sayı önce listelenir.">
            <Input id="region-sort" type="number" inputMode="numeric" min={0} max={100000} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-10" />
          </Field>
          {dirty && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning" role="status">
              Kaydedilmemiş değişiklikler var.
            </p>
          )}
          <div className="grid gap-2">
            <Button onClick={() => void save()} loading={pending}>
              {!pending && <Save />} Kaydet
            </Button>
            {savedStatus === 'published' && savedSlug && (
              <Button asChild variant="ghost">
                <a href={`${siteBase}/bolgeler/${savedSlug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Sitede görüntüle
                </a>
              </Button>
            )}
          </div>
        </section>
        {initial && (
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Bölge sayfasını sil
            </Button>
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Bölge sayfası silinsin mi?"
              description="Sayfa kalıcı olarak silinir. Yayındaysa adresi bölgeler sayfasına yönlendirilir."
              confirmLabel="Sil"
              destructive
              onConfirm={async () => {
                const res = await deleteRegionPage(initial.id);
                if (!res.ok) {
                  toast.error(res.error);
                  return false;
                }
                toast.success(res.message ?? 'Bölge sayfası silindi.');
                setSnapshot(current);
                router.push('/admin/bolgeler');
              }}
            />
          </section>
        )}
      </aside>
    </div>
  );
}
