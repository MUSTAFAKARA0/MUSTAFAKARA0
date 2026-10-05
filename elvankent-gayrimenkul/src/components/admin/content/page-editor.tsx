'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, RotateCcw, Save, Scale } from 'lucide-react';
import { StepSection, TextAreaField, TextField } from '@/components/admin/editor/fields';
import { MarkdownEditor } from '@/components/admin/content/markdown-editor';
import { SerpPreview } from '@/components/admin/content/serp-preview';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/form-controls';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { resetPage, savePage } from '@/app/actions/admin-content';
import { formatDateTime } from '@/lib/format';
import { fillPlaceholders, markdownToPlainText } from '@/modules/content/markdown';

const PLACEHOLDER_LABELS: Record<string, string> = {
  sirket: 'Şirket adı',
  unvan: 'Ticari unvan',
  adres: 'Adres',
  eposta: 'E-posta',
  telefon: 'Telefon',
  hizmet_bolgesi: 'Hizmet bölgesi',
};

export function PageEditor({
  pageKey,
  path,
  legal,
  initial,
  previewValues,
  siteBase,
  siteHost,
}: {
  pageKey: string;
  path: string;
  legal: boolean;
  initial: { title: string; body: string; seoTitle: string | null; seoDescription: string | null; legalReviewed: boolean; updatedAt: string | null; saved: boolean };
  previewValues: Record<string, string | null>;
  siteBase: string;
  siteHost: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? '');
  const [reviewed, setReviewed] = useState(initial.legalReviewed);
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify([initial.title, initial.body, initial.seoTitle ?? '', initial.seoDescription ?? '', initial.legalReviewed]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = useMemo(() => JSON.stringify([title, body, seoTitle, seoDescription, reviewed]) !== snapshot, [title, body, seoTitle, seoDescription, reviewed, snapshot]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Hukuki metin değiştiğinde önceki inceleme onayı geçerliliğini yitirir
  function changeBody(value: string) {
    setBody(value);
    if (legal && reviewed) setReviewed(false);
  }

  async function save() {
    setPending(true);
    setErrors({});
    const res = await savePage(pageKey, { title, body, seo_title: seoTitle, seo_description: seoDescription, legal_reviewed: reviewed });
    setPending(false);
    if (!res.ok) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
      setErrors(next);
      toast.error(res.error);
      return;
    }
    setSavedAt(res.data.updatedAt);
    setSnapshot(JSON.stringify([title, body, seoTitle, seoDescription, reviewed]));
    toast.success('Sayfa kaydedildi ve sitede yayına alındı.');
    router.refresh();
  }

  const description = seoDescription || markdownToPlainText(fillPlaceholders(body, previewValues), 160);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {legal && (
          <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-[13.5px] leading-relaxed text-warning sm:p-5">
            <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Bu bir hukuki metin taslağıdır</p>
              <p className="mt-1 text-foreground/80">
                Buradaki içerik kesin hukuki tavsiye değildir ve şirketinizin gerçek veri işleme süreçlerini yansıtacak şekilde bir hukuk danışmanı tarafından
                doğrulanmalıdır. İnceleme onayı verilene kadar sitede “hukuki danışman tarafından doğrulanmalıdır” uyarısı gösterilir.
              </p>
            </div>
          </div>
        )}
        <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <TextField label="Sayfa başlığı" name="title" required value={title} onChange={setTitle} maxLength={120} errors={errors} />
          <MarkdownEditor
            label="İçerik"
            required
            value={body}
            onChange={changeBody}
            maxLength={60000}
            rows={24}
            error={errors.body}
            previewValues={previewValues}
            hint="Önizleme, {{sirket}} gibi alanları şirket bilgilerinizle doldurur."
          />
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <StepSection title="Arama motoru (SEO)" description="Boş bırakılırsa sayfa başlığı ve içerikten oluşturulur.">
            <div className="space-y-5">
              <SerpPreview host={siteHost} path={path} title={seoTitle || title} description={description} />
              <TextField label="SEO başlığı" name="seo_title" value={seoTitle} onChange={setSeoTitle} maxLength={70} counter errors={errors} placeholder={title} />
              <TextAreaField label="Meta açıklama" name="seo_description" value={seoDescription} onChange={setSeoDescription} maxLength={200} rows={3} errors={errors} />
            </div>
          </StepSection>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <h2 className="text-[15.5px] font-bold">Kaydet ve yayınla</h2>
          <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning" data-testid="page-live-notice">
            Bu sayfanın metni taslak akışında değildir: kaydettiğinizde sitede hemen görünür. Sayfanın başlığı, görünürlüğü ve
            paylaşım ayarları Site yönetimi › Sayfalar ekranında taslağa kaydedilir.
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {initial.saved || savedAt ? `Son kayıt: ${savedAt ? formatDateTime(savedAt) : '—'}` : 'Bu sayfa henüz özelleştirilmedi; sitede varsayılan şablon gösteriliyor.'}
          </p>
          {legal && (
            <div className="mt-4 rounded-xl border border-border p-3.5">
              <Checkbox
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                label="Metin bir hukuk danışmanı tarafından incelendi ve onaylandı"
                description="İşaretlendiğinde sitedeki uyarı kalkar. Metni değiştirirseniz onayı yeniden vermeniz gerekir."
              />
            </div>
          )}
          {dirty && (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning" role="status">
              Kaydedilmemiş değişiklikler var.
            </p>
          )}
          <div className="mt-4 grid gap-2">
            <Button onClick={() => void save()} loading={pending}>
              {!pending && <Save />} Kaydet ve yayınla
            </Button>
            <Button asChild variant="ghost">
              <a href={`${siteBase}${path}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Sitede görüntüle
              </a>
            </Button>
            {(initial.saved || savedAt) && (
              <Button variant="danger-ghost" onClick={() => setConfirmReset(true)}>
                <RotateCcw /> Varsayılan şablona dön
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <h2 className="text-[15.5px] font-bold">Otomatik alanlar</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Metinde kullanıldığında şirket ayarlarındaki bilgiyle doldurulur. Boş olanlar sitede [KÖŞELİ PARANTEZ] ile görünür.</p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {Object.entries(PLACEHOLDER_LABELS).map(([key, label]) => (
              <li key={key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px]">{`{{${key}}}`}</code>
                <span className={previewValues[key] ? 'text-foreground/80' : 'text-warning'}>{previewValues[key] || `${label} girilmemiş`}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Varsayılan şablona dönülsün mü?"
        description="Bu sayfada yaptığınız değişiklikler silinir ve sitede varsayılan şablon gösterilir."
        confirmLabel="Şablona dön"
        destructive
        onConfirm={async () => {
          const res = await resetPage(pageKey);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(res.message ?? 'Sayfa sıfırlandı.');
          setSnapshot(JSON.stringify([title, body, seoTitle, seoDescription, reviewed]));
          window.location.reload();
        }}
      />
    </div>
  );
}
