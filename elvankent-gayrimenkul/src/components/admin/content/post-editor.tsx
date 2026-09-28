'use client';

import Link from '@/components/common/intent-link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, ExternalLink, EyeOff, Save, Send, Trash2 } from 'lucide-react';
import { StepSection, TextAreaField, TextField } from '@/components/admin/editor/fields';
import { CoverUpload, type CoverMedia } from '@/components/admin/content/cover-upload';
import { MarkdownEditor } from '@/components/admin/content/markdown-editor';
import { SerpPreview } from '@/components/admin/content/serp-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input } from '@/components/ui/form-controls';
import { savePost, setPostDeleted } from '@/app/actions/admin-content';
import { formatDateTime } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { isFutureDate } from '@/lib/utils';
import { markdownToPlainText } from '@/modules/content/markdown';

export interface PostEditorInitial {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  cover: CoverMedia | null;
}

interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  coverId: string | null;
  publishedLocal: string;
}

const MIN_PUBLISH_BODY = 200;

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftOf(p: PostEditorInitial | null): Draft {
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    excerpt: p?.excerpt ?? '',
    body: p?.body ?? '',
    seoTitle: p?.seoTitle ?? '',
    seoDescription: p?.seoDescription ?? '',
    coverId: p?.cover?.id ?? null,
    publishedLocal: toLocalInput(p?.publishedAt ?? null),
  };
}

export function PostEditor({ initial, siteBase, siteHost, canUpload }: { initial: PostEditorInitial | null; siteBase: string; siteHost: string; canUpload: boolean }) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? null);
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [saved, setSaved] = useState<Draft>(() => draftOf(initial));
  const [cover, setCover] = useState<CoverMedia | null>(initial?.cover ?? null);
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(initial?.publishedAt ?? null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [dateTouched, setDateTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<null | 'draft' | 'published'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  // Kaydedilmemiş değişiklikle sayfadan ayrılma uyarısı
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const save = useCallback(
    async (nextStatus: 'draft' | 'published') => {
      if (pending) return;
      setPending(nextStatus);
      setErrors({});
      const res = await savePost(id, {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body: draft.body,
        cover_media_id: draft.coverId,
        status: nextStatus,
        published_at: dateTouched && draft.publishedLocal ? new Date(draft.publishedLocal).toISOString() : undefined,
        seo_title: draft.seoTitle,
        seo_description: draft.seoDescription,
        expected_updated_at: updatedAt,
      });
      setPending(null);
      if (!res.ok) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.fieldErrors ?? {})) next[k] = v[0];
        setErrors(next);
        toast.error(res.error);
        return;
      }
      const data = res.data;
      const nextDraft = { ...draft, slug: data.slug, publishedLocal: toLocalInput(data.publishedAt) };
      setDraft(nextDraft);
      setSaved(nextDraft);
      setStatus(data.status);
      setPublishedAt(data.publishedAt);
      setUpdatedAt(data.updatedAt);
      setDateTouched(false);
      toast.success(nextStatus === 'published' ? (status === 'published' ? 'Yazı güncellendi.' : 'Yazı yayınlandı.') : status === 'published' ? 'Yazı yayından kaldırıldı.' : 'Taslak kaydedildi.');
      if (!id) {
        setId(data.id);
        router.replace(`/admin/icerikler/${data.id}`);
      }
    },
    [dateTouched, draft, id, pending, router, status, updatedAt],
  );

  // Ctrl/Cmd+S: mevcut durumla kaydet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save(status);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, status]);

  const scheduled = status === 'published' && isFutureDate(publishedAt);
  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
  const path = `/blog/${draft.slug || slugify(draft.title) || 'yazi-adresi'}`;
  const description = draft.seoDescription || draft.excerpt || markdownToPlainText(draft.body, 160);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <TextField
            label="Başlık"
            name="title"
            required
            value={draft.title}
            onChange={(v) => {
              setDraft((d) => ({ ...d, title: v, slug: slugTouched ? d.slug : slugify(v) }));
            }}
            maxLength={140}
            counter
            errors={errors}
            placeholder="ör. Elvankent'te ev alırken nelere dikkat edilmeli?"
          />
          <TextAreaField
            label="Özet"
            name="excerpt"
            value={draft.excerpt}
            onChange={(v) => set('excerpt', v)}
            maxLength={300}
            rows={3}
            errors={errors}
            hint="Blog listesinde ve paylaşımlarda görünür. Boş bırakılırsa içerikten oluşturulur."
          />
          <MarkdownEditor
            label="İçerik"
            required
            value={draft.body}
            onChange={(v) => set('body', v)}
            maxLength={50000}
            minLength={MIN_PUBLISH_BODY}
            rows={20}
            error={errors.body}
            placeholder={'## Giriş\n\nYazınızı buraya yazın. Başlıklar için ##, listeler için - kullanın.'}
          />
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <StepSection title="Arama motoru (SEO)" description="Boş bırakılan alanlar başlık ve özetten otomatik oluşturulur.">
            <div className="space-y-5">
              <SerpPreview host={siteHost} path={path} title={draft.seoTitle || draft.title} description={description} />
              <TextField
                label="SEO başlığı"
                name="seo_title"
                value={draft.seoTitle}
                onChange={(v) => set('seoTitle', v)}
                maxLength={70}
                counter
                errors={errors}
                hint="Önerilen 30–65 karakter."
                placeholder={draft.title}
              />
              <TextAreaField
                label="Meta açıklama"
                name="seo_description"
                value={draft.seoDescription}
                onChange={(v) => set('seoDescription', v)}
                maxLength={200}
                rows={3}
                errors={errors}
                hint="Önerilen 110–160 karakter."
              />
              <Field
                label="Yazı adresi (URL)"
                htmlFor="post-slug"
                error={errors.slug}
                hint={status === 'published' ? 'Yayındaki yazının adresi değişirse eski adres yeni adrese otomatik yönlendirilir.' : 'Boş bırakılırsa başlıktan oluşturulur.'}
              >
                <div className="flex min-w-0 items-center rounded-xl border border-border bg-surface-muted pl-3.5 text-sm text-muted-foreground">
                  <span className="shrink-0">/blog/</span>
                  <Input
                    id="post-slug"
                    value={draft.slug}
                    maxLength={120}
                    onChange={(e) => {
                      setSlugTouched(true);
                      set('slug', e.target.value.toLowerCase());
                    }}
                    onBlur={() => set('slug', slugify(draft.slug))}
                    className="min-w-0 rounded-l-none border-0 bg-surface pl-1 focus:ring-0"
                  />
                </div>
              </Field>
            </div>
          </StepSection>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15.5px] font-bold">Yayın</h2>
            {status === 'draft' ? <Badge>Taslak</Badge> : scheduled ? <Badge variant="info">Zamanlandı</Badge> : <Badge variant="success">Yayında</Badge>}
          </div>
          <dl className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
            {publishedAt && (
              <div className="flex justify-between gap-3">
                <dt>{scheduled ? 'Yayına girecek' : 'Yayın tarihi'}</dt>
                <dd className="text-right text-foreground">{formatDateTime(publishedAt)}</dd>
              </div>
            )}
            {updatedAt && (
              <div className="flex justify-between gap-3">
                <dt>Son kayıt</dt>
                <dd className="text-right text-foreground">{formatDateTime(updatedAt)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt>Uzunluk</dt>
              <dd className="numeric text-right text-foreground">
                {words.toLocaleString('tr-TR')} kelime · ~{Math.max(1, Math.round(words / 200))} dk okuma
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <label htmlFor="post-date" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden /> Yayın tarihi (isteğe bağlı)
            </label>
            <Input
              id="post-date"
              type="datetime-local"
              value={draft.publishedLocal}
              onChange={(e) => {
                setDateTouched(true);
                set('publishedLocal', e.target.value);
              }}
              className="h-10"
              aria-describedby="post-date-hint"
            />
            <p id="post-date-hint" className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
              Boş bırakılırsa yayınlandığı an kullanılır. İleri bir tarih seçilirse yazı o tarihte sitede görünür.
            </p>
            {errors.published_at && <p className="mt-1 text-[13px] font-medium text-danger">{errors.published_at}</p>}
          </div>

          {dirty && (
            <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] font-medium text-warning" role="status">
              Kaydedilmemiş değişiklikler var.
            </p>
          )}

          <div className="mt-4 grid gap-2">
            {status === 'draft' ? (
              <>
                <Button onClick={() => void save('published')} loading={pending === 'published'} disabled={Boolean(pending)}>
                  {pending !== 'published' && <Send />} Yayınla
                </Button>
                <Button variant="outline" onClick={() => void save('draft')} loading={pending === 'draft'} disabled={Boolean(pending)}>
                  {pending !== 'draft' && <Save />} Taslağı kaydet
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => void save('published')} loading={pending === 'published'} disabled={Boolean(pending)}>
                  {pending !== 'published' && <Save />} Güncelle
                </Button>
                <Button variant="outline" onClick={() => void save('draft')} loading={pending === 'draft'} disabled={Boolean(pending)}>
                  {pending !== 'draft' && <EyeOff />} Yayından kaldır
                </Button>
              </>
            )}
            {status === 'published' && !scheduled && !dirty && (
              <Button asChild variant="ghost">
                <a href={`${siteBase}/blog/${saved.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Sitede görüntüle
                </a>
              </Button>
            )}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">Kısayol: Ctrl + S ile kaydedebilirsiniz.</p>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <h2 className="text-[15.5px] font-bold">Kapak görseli</h2>
          <p className="mt-0.5 mb-3 text-[13px] text-muted-foreground">Blog listesinde, yazının başında ve paylaşımlarda kullanılır.</p>
          {canUpload ? (
            <CoverUpload
              value={cover}
              onChange={(m) => {
                setCover(m);
                set('coverId', m?.id ?? null);
              }}
            />
          ) : (
            <p className="text-[13px] text-muted-foreground">Görsel yüklemek için medya yönetimi yetkisi gerekir.</p>
          )}
        </section>

        {id && (
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Çöp kutusuna taşı
            </Button>
            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Yazı çöp kutusuna taşınsın mı?"
              description="Yazı sitede görünmez; çöp kutusundan geri yükleyebilirsiniz."
              confirmLabel="Taşı"
              onConfirm={async () => {
                const res = await setPostDeleted(id, true);
                if (!res.ok) {
                  toast.error(res.error);
                  return false;
                }
                toast.success(res.message ?? 'Yazı çöp kutusuna taşındı.');
                setSaved(draft);
                router.push('/admin/icerikler');
              }}
            />
          </section>
        )}
        <p className="text-center text-[12.5px] text-muted-foreground">
          <Link href="/admin/icerikler" className="font-semibold hover:text-foreground">
            ← Tüm yazılar
          </Link>
        </p>
      </aside>
    </div>
  );
}
