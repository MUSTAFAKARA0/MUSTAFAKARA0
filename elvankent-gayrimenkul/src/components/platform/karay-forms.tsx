'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { SaveBar } from '@/components/platform/site/site-actions';
import { updateKarayLead, updateKarayProfile, type KarayProfileInput } from '@/app/actions/karay-admin';

export const LEAD_STATUS: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'Yeni', tone: 'info' },
  contacted: { label: 'İletişime geçildi', tone: 'warning' },
  qualified: { label: 'Görüşme / teklif', tone: 'success' },
  closed: { label: 'Kapandı', tone: 'neutral' },
};

/** KARAY talebi: durum ve iç not (yalnızca süper admin) */
export function KarayLeadEditor({ id, status, note }: { id: string; status: string; note: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [text, setText] = useState(note ?? '');
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = value !== status || text !== (note ?? '');
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await updateKarayLead(id, value, text);
        setPending(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(res.message ?? 'Kaydedildi.');
        startTransition(() => router.refresh());
      }}
    >
      <Field label="Durum" htmlFor={`st-${id}`}>
        <Select id={`st-${id}`} value={value} onChange={(e) => setValue(e.target.value)}>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="İç not" htmlFor={`nt-${id}`} optional>
        <Input id={`nt-${id}`} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Yalnızca KARAY ekibi görür" />
      </Field>
      <Button type="submit" size="md" loading={pending} disabled={!dirty}>
        Kaydet
      </Button>
    </form>
  );
}

type Values = { [K in keyof Omit<KarayProfileInput, 'indexable'>]: string } & { indexable: boolean };

const GROUPS: { title: string; description: string; fields: { key: keyof Omit<Values, 'indexable'>; label: string; type?: string; textarea?: boolean; hint?: string; max: number }[] }[] = [
  {
    title: 'Şirket',
    description: 'KARAY şirket sayfasında (/karay) ve alt bilgide gösterilir.',
    fields: [
      { key: 'company_name', label: 'Şirket adı', max: 80 },
      { key: 'tagline', label: 'Kısa tanım', max: 160, hint: 'Ör. Gayrimenkul Teknolojileri ve SaaS Platformu' },
    ],
  },
  {
    title: 'İletişim',
    description: 'Boş bırakılan bilgi sayfada hiç gösterilmez. Uydurma bilgi girmeyin.',
    fields: [
      { key: 'contact_email', label: 'E-posta', type: 'email', max: 160 },
      { key: 'contact_phone', label: 'Telefon', type: 'tel', max: 30 },
      { key: 'whatsapp', label: 'WhatsApp', type: 'tel', max: 30 },
      { key: 'address', label: 'Adres', max: 240 },
      { key: 'city', label: 'Şehir', max: 80 },
      { key: 'website_url', label: 'Web sitesi', type: 'url', max: 300 },
    ],
  },
  {
    title: 'Sosyal medya',
    description: 'Yalnızca https:// bağlantıları. Boş olan hesap gösterilmez.',
    fields: [
      { key: 'linkedin_url', label: 'LinkedIn', type: 'url', max: 300 },
      { key: 'instagram_url', label: 'Instagram', type: 'url', max: 300 },
      { key: 'x_url', label: 'X', type: 'url', max: 300 },
      { key: 'youtube_url', label: 'YouTube', type: 'url', max: 300 },
    ],
  },
  {
    title: 'SEO (KARAY sayfası)',
    description: 'Kiracı (emlak ofisi) sitelerinin SEO ayarlarından tamamen ayrıdır.',
    fields: [
      { key: 'seo_title', label: 'Sayfa başlığı', max: 70 },
      { key: 'seo_description', label: 'Meta açıklama', textarea: true, max: 200 },
    ],
  },
  {
    title: 'Talep bildirimleri',
    description: 'KARAY formuna gelen taleplerin e-posta ile bildirileceği adresler (en fazla 5, virgülle ayırın). E-posta sağlayıcısı yapılandırılmamışsa talepler yine de Talepler ekranında görünür.',
    fields: [{ key: 'lead_notify_emails', label: 'Bildirim adresleri', textarea: true, max: 900 }],
  },
];

export function KarayProfileForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  return (
    <div className="max-w-4xl space-y-6">
      {GROUPS.map((g) => (
        <section key={g.title} className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold">{g.title}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{g.description}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`kp-${f.key}`} hint={f.hint} optional={f.key !== 'company_name'} className={f.textarea ? 'sm:col-span-2' : undefined}>
                {f.textarea ? (
                  <Textarea id={`kp-${f.key}`} rows={3} maxLength={f.max} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={`kp-${f.key}`} type={f.type ?? 'text'} maxLength={f.max} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                )}
              </Field>
            ))}
          </div>
          {g.title.startsWith('SEO') && (
            <div className="mt-4">
              <Checkbox
                checked={values.indexable}
                onChange={(e) => setValues((v) => ({ ...v, indexable: e.target.checked }))}
                label="KARAY sayfası arama motorlarına açık"
                description="Kapalıyken sayfa noindex etiketi taşır ve site haritası boş döner."
              />
            </div>
          )}
        </section>
      ))}
      <SaveBar
        pending={pending}
        dirty={dirty}
        saveLabel="Kaydet"
        note="Kaydedilince KARAY sayfasında (5 dk önbellek yenilenerek) hemen görünür."
        onReset={() => setValues(initial)}
        onSave={async () => {
          setPending(true);
          const res = await updateKarayProfile(values);
          setPending(false);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? 'Kaydedildi.');
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
