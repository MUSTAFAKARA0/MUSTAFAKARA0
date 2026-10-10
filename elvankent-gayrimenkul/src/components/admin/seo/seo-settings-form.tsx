'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { TextAreaField, TextField } from '@/components/admin/editor/fields';
import { SerpPreview } from '@/components/admin/content/serp-preview';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { saveSeoSettings } from '@/app/actions/admin-content';

type SeoValues = { seoTitle: string | null; seoDescription: string | null; googleSiteVerification: string | null };

/** Yayındaki değer taslaktan farklıysa alanın altında gösterilir */
function LiveHint({ draft, live }: { draft: string; live: string | null }) {
  if ((live ?? '') === draft) return null;
  return (
    <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-900" data-testid="seo-live-value">
      <span className="font-semibold">Taslakta.</span> Yayındaki: {live ? `“${live}”` : 'boş (otomatik)'}
    </p>
  );
}

/**
 * Site geneli SEO (P0.3): kayıt TASLAĞA gider; yayın /admin/site › "Yayınla" ile (marka ve ana
 * sayfa ile birlikte). Taslak eşzamanlılık belirteci sayfa yüklendiğindeki taslak zamanıdır; her
 * başarılı kayıt yeni belirteci döndürür ve sonraki kayıt onu kullanır (art arda kayıtlar kendi
 * yazımına takılmaz; araya başkası girdiyse sunucu reddeder).
 */
export function SeoSettingsForm({
  initial,
  live,
  draftToken = null,
  siteHost,
  fallbackTitle,
  fallbackDescription,
}: {
  initial: SeoValues;
  live: SeoValues;
  draftToken?: string | null;
  siteHost: string;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const router = useRouter();
  const token = useRef(draftToken);
  useEffect(() => {
    token.current = draftToken;
  }, [draftToken]);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? '');
  const [verification, setVerification] = useState(initial.googleSiteVerification ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setErrors({});
        const res = await saveSeoSettings({ seo_title: seoTitle, seo_description: seoDescription, google_site_verification: verification }, token.current);
        setPending(false);
        if (!res.ok) {
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
          setErrors(next);
          toast.error(res.error);
          return;
        }
        if (res.data?.draftToken) token.current = res.data.draftToken;
        toast.success(res.message ?? 'Kaydedildi — taslak.');
        router.refresh();
      }}
    >
      <SerpPreview host={siteHost} path="/" title={seoTitle || fallbackTitle} description={seoDescription || fallbackDescription} />
      <TextField
        label="Ana sayfa başlığı"
        name="seo_title"
        value={seoTitle}
        onChange={setSeoTitle}
        maxLength={70}
        counter
        errors={errors}
        placeholder={fallbackTitle}
        hint="Arama sonuçlarında ana sayfanız için gösterilir. Önerilen 30–65 karakter."
      />
      <LiveHint draft={seoTitle} live={live.seoTitle} />
      <TextAreaField
        label="Ana sayfa açıklaması"
        name="seo_description"
        value={seoDescription}
        onChange={setSeoDescription}
        maxLength={200}
        rows={3}
        errors={errors}
        hint="Önerilen 110–160 karakter. Doğrulanamayan iddialar (en iyi, 1 numara vb.) kullanmayın."
      />
      <LiveHint draft={seoDescription} live={live.seoDescription} />
      <Field
        label="Google Search Console doğrulama kodu"
        htmlFor="seo-verification"
        optional
        error={errors.google_site_verification}
        hint={'Search Console › "HTML etiketi" yönteminde verilen kodu veya etiketin tamamını yapıştırabilirsiniz.'}
      >
        <Input id="seo-verification" value={verification} onChange={(e) => setVerification(e.target.value)} maxLength={500} autoComplete="off" spellCheck={false} placeholder='<meta name="google-site-verification" content="…" />' />
      </Field>
      <LiveHint draft={verification} live={live.googleSiteVerification} />
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {!pending && <Save />} Taslağa kaydet
        </Button>
      </div>
    </form>
  );
}
