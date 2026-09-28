'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { SaveBar } from '@/components/platform/site/site-actions';
import { updateSiteBrand, type BrandInput } from '@/app/actions/site-builder';

type Values = { [K in keyof BrandInput]-?: string };

const GROUPS: { title: string; description?: string; fields: { key: keyof Values; label: string; type?: string; textarea?: boolean; hint?: string; required?: boolean; max: number }[] }[] = [
  {
    title: 'Kimlik',
    fields: [
      { key: 'display_name', label: 'Firma adı', required: true, max: 80 },
      { key: 'short_name', label: 'Kısa ad', hint: 'Dar ekranlarda ve sekme başlıklarında kullanılabilir.', max: 40 },
      { key: 'legal_name', label: 'Ticari unvan', hint: 'Footer telif satırında ve yasal sayfalarda gösterilir.', max: 160 },
      { key: 'tagline', label: 'Slogan', max: 160 },
      { key: 'description', label: 'Kısa açıklama', textarea: true, max: 2000 },
    ],
  },
  {
    title: 'İletişim',
    fields: [
      { key: 'phone', label: 'Telefon', type: 'tel', max: 30 },
      { key: 'whatsapp', label: 'WhatsApp', type: 'tel', hint: 'Boşsa telefon numarası kullanılır.', max: 30 },
      { key: 'email', label: 'E-posta', type: 'email', max: 160 },
      { key: 'address_line', label: 'Adres', max: 240 },
      { key: 'address_district', label: 'İlçe', max: 80 },
      { key: 'address_city', label: 'İl', max: 80 },
      { key: 'maps_url', label: 'Harita bağlantısı', type: 'url', hint: 'https:// ile başlayan Google Haritalar vb. bağlantısı.', max: 300 },
    ],
  },
  {
    title: 'Sosyal medya',
    description: 'Yalnızca https:// bağlantıları kabul edilir; boş bırakılan hesap sitede gösterilmez.',
    fields: [
      { key: 'instagram_url', label: 'Instagram', type: 'url', max: 300 },
      { key: 'facebook_url', label: 'Facebook', type: 'url', max: 300 },
      { key: 'x_url', label: 'X', type: 'url', max: 300 },
      { key: 'youtube_url', label: 'YouTube', type: 'url', max: 300 },
      { key: 'linkedin_url', label: 'LinkedIn', type: 'url', max: 300 },
      { key: 'tiktok_url', label: 'TikTok', type: 'url', max: 300 },
    ],
  },
];

/**
 * Marka ve iletişim bilgileri (ofisin kendi ayar kaydı). Taslak/yayın akışına girmez:
 * ofis de aynı alanları Şirket Ayarları'ndan düzenler, kayıt anında yayına girer.
 */
export function BrandForm({ orgId, initial }: { orgId: string; initial: Values }) {
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
          {g.description && <p className="mt-1 text-[13px] text-muted-foreground">{g.description}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`brand-${f.key}`} hint={f.hint} required={f.required} optional={!f.required} className={f.textarea ? 'sm:col-span-2' : undefined}>
                {f.textarea ? (
                  <Textarea id={`brand-${f.key}`} rows={4} maxLength={f.max} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                ) : (
                  <Input
                    id={`brand-${f.key}`}
                    type={f.type ?? 'text'}
                    maxLength={f.max}
                    value={values[f.key]}
                    spellCheck={f.type === 'url' || f.type === 'email' ? false : undefined}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        </section>
      ))}
      <SaveBar
        pending={pending}
        dirty={dirty}
        saveLabel="Kaydet ve yayınla"
        note="Marka ve iletişim bilgileri kaydedildiğinde anında yayına girer."
        onReset={() => setValues(initial)}
        onSave={async () => {
          setPending(true);
          const res = await updateSiteBrand(orgId, values);
          setPending(false);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? 'Kaydedildi.');
          startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
