'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { LazyMap } from '@/components/map/lazy-map';
import { LogoMark } from '@/components/layout/logo';
import { deleteDemoProperties, removeLogo, saveSettings, type SettingsInput } from '@/app/actions/admin-settings';
import type { FieldErrors } from '@/lib/validation/common';
import type { SiteSettings } from '@/types/database';
import { publicEnv } from '@/lib/env';

type Keys = keyof SettingsInput;

export function SettingsForm({ settings, demoCount }: { settings: SiteSettings; demoCount: number }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<Keys, string>>(() => ({
    business_name: settings.business_name,
    tagline: settings.tagline ?? '',
    phone: settings.phone ?? '',
    whatsapp: settings.whatsapp ?? '',
    email: settings.email ?? '',
    address: settings.address ?? '',
    working_hours: settings.working_hours ?? '',
    about_text: settings.about_text ?? '',
    office_latitude: settings.office_latitude !== null ? String(settings.office_latitude) : '',
    office_longitude: settings.office_longitude !== null ? String(settings.office_longitude) : '',
    instagram_url: settings.instagram_url ?? '',
    facebook_url: settings.facebook_url ?? '',
    x_url: settings.x_url ?? '',
    youtube_url: settings.youtube_url ?? '',
    linkedin_url: settings.linkedin_url ?? '',
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const [logoUrl, setLogoUrl] = useState(settings.logo_url);
  const [logoBusy, setLogoBusy] = useState(false);
  const [demoConfirm, setDemoConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: Keys, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const text = (k: Keys, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={`s-${k}`} error={errors[k]}>
      <Input id={`s-${k}`} name={k} value={form[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errors[k])} {...props} />
    </Field>
  );

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSettings(form);
      if (res.ok) {
        toast.success('Ayarlar kaydedildi');
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/branding', { method: 'POST', body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Logo yüklenemedi. Lütfen tekrar deneyin.');
      setLogoUrl(json.url);
      toast.success('Logo güncellendi');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo yüklenemedi.');
    } finally {
      setLogoBusy(false);
    }
  };

  const hasOffice = form.office_latitude && form.office_longitude;

  return (
    <div className="space-y-6">
      <form onSubmit={save} noValidate className="space-y-6">
        <Card title="İşletme bilgileri" description="Bu bilgiler sitenin üst/alt kısmında, iletişim sayfasında ve arama motorlarında gösterilir.">
          <div className="grid gap-5 sm:grid-cols-2">
            {text('business_name', 'İşletme adı *', { maxLength: 120 })}
            {text('tagline', 'Kısa tanıtım cümlesi', { maxLength: 200 })}
            {text('phone', 'Telefon', { type: 'tel', inputMode: 'tel', placeholder: '0532 123 45 67' })}
            {text('whatsapp', 'WhatsApp numarası', { type: 'tel', inputMode: 'tel', placeholder: 'Boşsa telefon kullanılır' })}
            {text('email', 'E-posta', { type: 'email', inputMode: 'email' })}
            <Field label="Çalışma saatleri" htmlFor="s-working_hours" error={errors.working_hours}>
              <Textarea id="s-working_hours" rows={2} value={form.working_hours} onChange={(e) => set('working_hours', e.target.value)} placeholder={'Hafta içi 09:00 – 19:00\nCumartesi 10:00 – 17:00'} />
            </Field>
            <Field label="Adres" htmlFor="s-address" error={errors.address} className="sm:col-span-2">
              <Textarea id="s-address" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Ofis konumu" description="İletişim sayfasındaki haritada gösterilir. Haritaya tıklayarak işaretleyin.">
          <LazyMap
            className="h-72 overflow-hidden rounded-xl ring-1 ring-line"
            center={hasOffice ? { lat: Number(form.office_latitude), lng: Number(form.office_longitude) } : { lat: 39.948, lng: 32.624 }}
            mode="pin"
            editable
            zoom={hasOffice ? 16 : 13}
            attribution={publicEnv.mapAttribution}
            ariaLabel="Ofis konumunu seçmek için harita"
            onChange={(p) => setForm((f) => ({ ...f, office_latitude: p.lat.toFixed(6), office_longitude: p.lng.toFixed(6) }))}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input aria-label="Enlem" value={form.office_latitude} onChange={(e) => set('office_latitude', e.target.value)} placeholder="Enlem" inputMode="decimal" />
            <Input aria-label="Boylam" value={form.office_longitude} onChange={(e) => set('office_longitude', e.target.value)} placeholder="Boylam" inputMode="decimal" />
            {hasOffice && (
              <Button type="button" variant="ghost" onClick={() => setForm((f) => ({ ...f, office_latitude: '', office_longitude: '' }))}>
                Haritadan kaldır
              </Button>
            )}
          </div>
        </Card>

        <Card title="Hakkımızda metni" description="Hakkımızda sayfasında ve ana sayfada kullanılır. Paragrafları boş satırla ayırın.">
          <Field label="Metin" htmlFor="s-about_text" error={errors.about_text}>
            <Textarea id="s-about_text" rows={8} value={form.about_text} maxLength={6000} onChange={(e) => set('about_text', e.target.value)} />
          </Field>
        </Card>

        <Card title="Sosyal medya" description="Boş bırakılan hesaplar sitede gösterilmez. https:// ile başlayan tam adres girin.">
          <div className="grid gap-5 sm:grid-cols-2">
            {text('instagram_url', 'Instagram', { type: 'url', placeholder: 'https://instagram.com/...' })}
            {text('facebook_url', 'Facebook', { type: 'url', placeholder: 'https://facebook.com/...' })}
            {text('x_url', 'X (Twitter)', { type: 'url', placeholder: 'https://x.com/...' })}
            {text('youtube_url', 'YouTube', { type: 'url', placeholder: 'https://youtube.com/...' })}
            {text('linkedin_url', 'LinkedIn', { type: 'url', placeholder: 'https://linkedin.com/...' })}
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={pending}>
            {!pending && <Save />} Ayarları kaydet
          </Button>
        </div>
      </form>

      <Card title="Logo" description="PNG (şeffaf arka planlı önerilir), WebP veya JPG · En fazla 2 MB. Logo yüklenmezse yazı logosu kullanılır.">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 min-w-40 items-center justify-center rounded-xl bg-sand-50 px-4 ring-1 ring-line">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Mevcut logo" className="max-h-14 w-auto max-w-[200px] object-contain" />
            ) : (
              <LogoMark className="size-12" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" loading={logoBusy} onClick={() => fileRef.current?.click()}>
              {!logoBusy && <ImagePlus />} {logoUrl ? 'Logoyu değiştir' : 'Logo yükle'}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  start(async () => {
                    const r = await removeLogo();
                    if (r.ok) {
                      setLogoUrl(null);
                      toast.success('Logo kaldırıldı');
                      router.refresh();
                    } else toast.error(r.error);
                  })
                }
              >
                Kaldır
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="sr-only"
            tabIndex={-1}
            aria-label="Logo dosyası seç"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLogo(f);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <div id="demo" className="scroll-mt-24">
        <Card title="Demo ilanlar" description="Kurulumda eklenen, “DEMO” olarak işaretli örnek ilanlar.">
          {demoCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-sand-700">
                Sitede <strong>{demoCount}</strong> demo ilan var. Kendi ilanlarınızı ekledikten sonra silmeniz önerilir.
              </p>
              <Button variant="danger" onClick={() => setDemoConfirm(true)}>
                <Trash2 /> Tüm demo ilanları sil
              </Button>
            </div>
          ) : (
            <p className="text-sm text-sand-600">Sitede demo ilan bulunmuyor.</p>
          )}
        </Card>
      </div>

      <Dialog open={demoConfirm} onOpenChange={setDemoConfirm}>
        <DialogContent title="Demo ilanlar silinsin mi?" description={`${demoCount} demo ilan ve fotoğrafları kalıcı olarak silinecek. Kendi ilanlarınız etkilenmez.`}>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Vazgeç</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteDemoProperties();
                  if (r.ok) {
                    toast.success(`${r.count ?? 0} demo ilan silindi`);
                    setDemoConfirm(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <Trash2 /> Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-7">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {description && <p className="mt-0.5 mb-5 text-sm text-sand-600">{description}</p>}
      {children}
    </section>
  );
}
