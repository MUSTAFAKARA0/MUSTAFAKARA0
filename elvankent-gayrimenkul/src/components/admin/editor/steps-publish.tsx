'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Copy, ExternalLink, Eye, FileText, Heart, Phone, QrCode, Star, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { MediaImage } from '@/components/gallery/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch } from '@/components/ui/form-controls';
import { formatDateTime, formatListingPrice, formatNumber } from '@/lib/format';
import { slugify } from '@/lib/slug';
import { cn } from '@/lib/utils';
import { PUBLISH_CHECKS, publishChecklist, seoChecklist } from '@/modules/properties/admin';
import { STATUS_LABELS, allowedTransitions, type ListingStatus } from '@/modules/properties/constants';
import { useEditor } from './editor-context';
import { StepSection, TextAreaField, TextField } from './fields';

export function StepSeo({ siteHost }: { siteHost: string }) {
  const { values, set, errors, media, readOnly } = useEditor();
  const ready = media.filter((m) => m.status === 'ready');
  const checks = seoChecklist({
    title: values.title,
    seo_title: values.seo_title,
    seo_description: values.seo_description,
    description: values.description,
    slug: values.slug,
    readyPhotos: ready.length,
    missingAlt: ready.filter((m) => !m.alt_text).length,
    hasLocation: Boolean(values.city_id && values.district_id),
  });
  const shownTitle = values.seo_title || values.title;
  const shownDescription = values.seo_description || (values.description ?? '').replace(/\s+/g, ' ').slice(0, 155);
  const [slugDraft, setSlugDraft] = useState(values.slug);

  return (
    <div className="space-y-8">
      <StepSection title="Arama sonucu önizlemesi" description="Google gibi arama motorlarında yaklaşık bu şekilde görünür (kesin görünümü arama motoru belirler).">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="truncate text-[13px] text-[#4d5156]">
            {siteHost} › ilan › {values.slug}
          </p>
          <p className="mt-1 line-clamp-1 text-[19px] leading-snug text-[#1a0dab]">{shownTitle}</p>
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[#4d5156]">{shownDescription || 'Açıklama eklendiğinde burada görünür.'}</p>
        </div>
      </StepSection>

      <StepSection title="Arama motoru bilgileri" description="Boş bırakılan alanlar ilan başlığı ve açıklamasından otomatik oluşturulur.">
        <div className="space-y-5">
          <TextField
            label="SEO başlığı"
            name="seo_title"
            value={values.seo_title}
            onChange={(v) => set('seo_title', v || null)}
            maxLength={70}
            counter
            errors={errors}
            disabled={readOnly}
            hint="Önerilen 30–65 karakter."
            placeholder={values.title}
          />
          <TextAreaField
            label="Meta açıklama"
            name="seo_description"
            value={values.seo_description}
            onChange={(v) => set('seo_description', v || null)}
            maxLength={200}
            rows={3}
            errors={errors}
            disabled={readOnly}
            hint="Önerilen 110–160 karakter; ilanın en önemli bilgilerini içersin."
          />
          <Field
            label="İlan adresi (URL)"
            htmlFor="slug"
            error={errors.slug}
            hint="Yayındaki bir ilanın adresi değişirse eski adres otomatik olarak yeni adrese yönlendirilir."
          >
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-surface-muted pl-3.5 text-sm text-muted-foreground">
                <span className="shrink-0">/ilan/</span>
                <Input
                  id="slug"
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                  onBlur={() => {
                    const clean = slugify(slugDraft);
                    setSlugDraft(clean || values.slug);
                    if (clean && clean !== values.slug) set('slug', clean);
                  }}
                  disabled={readOnly}
                  className="min-w-0 rounded-l-none border-0 bg-surface pl-1 focus:ring-0"
                />
              </div>
              <Button
                variant="outline"
                disabled={readOnly}
                onClick={() => {
                  const next = slugify(values.title);
                  setSlugDraft(next);
                  if (next !== values.slug) set('slug', next);
                }}
              >
                Başlıktan üret
              </Button>
            </div>
          </Field>
        </div>
      </StepSection>

      {ready.length > 0 && (
        <StepSection title="Paylaşım görseli" description="WhatsApp, Facebook ve X paylaşımlarında gösterilecek fotoğraf. Seçilmezse kapak fotoğrafı kullanılır.">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ready.map((m) => {
              const selected = values.og_media_id === m.id || (!values.og_media_id && m.is_cover);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-pressed={selected}
                    aria-label={selected ? 'Seçili paylaşım görseli' : 'Paylaşım görseli olarak seç'}
                    onClick={() => set('og_media_id', m.is_cover ? null : m.id)}
                    className={cn('relative block aspect-[1.91/1] w-full overflow-hidden rounded-xl border-2 transition', selected ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100')}
                  >
                    <MediaImage media={m} alt="" fill sizes="160px" className="object-cover" />
                    {selected && <CheckCircle2 className="absolute top-1.5 right-1.5 size-5 rounded-full bg-white text-primary" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </StepSection>
      )}

      <StepSection title="SEO kontrol listesi" description="Öneri niteliğindedir; yayını engellemez.">
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 text-[14px]">
              {c.ok ? <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-[18px] shrink-0 text-muted-foreground/60" aria-hidden />}
              <span>
                <span className={c.ok ? 'text-foreground' : 'text-foreground/80'}>{c.label}</span>
                {c.hint && <span className="ml-1.5 text-[12.5px] text-muted-foreground">({c.hint})</span>}
                <span className="sr-only">{c.ok ? ' — tamam' : ' — eksik'}</span>
              </span>
            </li>
          ))}
        </ul>
      </StepSection>
    </div>
  );
}

const TRANSITION_LABELS: Partial<Record<ListingStatus, string>> = {
  published: 'Yayınla',
  pending: 'Onaya gönder',
  draft: 'Taslağa al',
  sold: 'Satıldı olarak işaretle',
  rented: 'Kiralandı olarak işaretle',
  archived: 'Arşivle',
};

export function StepPublish({
  onStatus,
  statusPending,
  stats,
  priceHistory,
  history,
}: {
  onStatus: (status: ListingStatus) => void;
  statusPending: ListingStatus | null;
  stats: { views: number; favorites: number; whatsapp: number; phone: number };
  priceHistory: { old_price: number | null; new_price: number; currency: string; changed_at: string }[];
  history: { id: number; action: string; actor_label: string | null; created_at: string }[];
}) {
  const { values, set, media, perms, readOnly } = useEditor();
  const ready = media.filter((m) => m.status === 'ready').length;
  const checks = publishChecklist({ ...values, readyPhotos: ready });
  const allOk = Object.values(checks).every(Boolean);
  const transitions = allowedTransitions(values.status, values.listing_type).filter((s) => {
    const visibility = ['published', 'sold', 'rented'].includes(s) || ['published', 'sold', 'rented'].includes(values.status);
    return visibility ? perms.publish : perms.update;
  });
  const isPublic = ['published', 'sold', 'rented'].includes(values.status);
  const publicPath = `/ilan/${values.slug}`;

  return (
    <div className="space-y-8">
      <StepSection title="Yayın durumu">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={values.status === 'published' ? 'success' : values.status === 'pending' ? 'warning' : 'neutral'} className="px-3 py-1 text-[13px]">
            {STATUS_LABELS[values.status]}
          </Badge>
          {values.published_at && <span className="text-[13px] text-muted-foreground">İlk yayın: {formatDateTime(values.published_at)}</span>}
        </div>

        <ul className="mt-5 space-y-2">
          {PUBLISH_CHECKS.map((c) => (
            <li key={c.key} className="flex items-center gap-2.5 text-[14px]">
              {checks[c.key] ? <CheckCircle2 className="size-[18px] text-success" aria-hidden /> : <Circle className="size-[18px] text-danger/70" aria-hidden />}
              <span className={checks[c.key] ? '' : 'font-medium text-danger'}>{c.label}</span>
              <span className="sr-only">{checks[c.key] ? '— tamam' : '— eksik'}</span>
            </li>
          ))}
        </ul>

        {!readOnly && transitions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {transitions.map((s) => (
              <Button
                key={s}
                variant={s === 'published' ? 'primary' : s === 'archived' ? 'outline' : 'soft'}
                loading={statusPending === s}
                disabled={Boolean(statusPending) || (s === 'published' && !allOk)}
                onClick={() => onStatus(s)}
              >
                {TRANSITION_LABELS[s] ?? STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        )}
        {!perms.publish && !readOnly && (
          <p className="mt-3 text-[13px] text-muted-foreground">Yayınlama yetkiniz yok; ilanı “Onaya gönder” ile yetkili bir kullanıcıya iletebilirsiniz.</p>
        )}
        {!allOk && perms.publish && <p className="mt-3 text-[13px] text-muted-foreground">Yayınlamak için yukarıdaki eksikleri tamamlayın.</p>}
      </StepSection>

      {perms.publish && (
        <StepSection title="Vitrin">
          <div className="space-y-4">
            <Switch
              label="Öne çıkan ilan"
              description="İlan listelerinde “Öne çıkan” rozetiyle gösterilir."
              checked={values.is_featured}
              onCheckedChange={(v) => set('is_featured', v)}
              disabled={readOnly}
            />
            <Switch
              label="Ana sayfa vitrininde göster"
              description="Ana sayfadaki “Öne çıkan gayrimenkuller” bölümünde yer alır."
              checked={values.show_on_homepage}
              onCheckedChange={(v) => set('show_on_homepage', v)}
              disabled={readOnly}
            />
          </div>
        </StepSection>
      )}

      <StepSection title="Paylaş ve yazdır">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={isPublic ? publicPath : `/onizleme/ilan/${values.id}`} target="_blank" rel="noopener noreferrer">
              {isPublic ? <ExternalLink /> : <Eye />} {isPublic ? 'Sitede görüntüle' : 'Önizle'}
            </a>
          </Button>
          {isPublic && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
                  toast.success('İlan bağlantısı kopyalandı.');
                } catch {
                  toast.error('Bağlantı kopyalanamadı.');
                }
              }}
            >
              <Copy /> Bağlantıyı kopyala
            </Button>
          )}
          <Button asChild variant="outline">
            <a href={`/api/admin/properties/${values.id}/qr?format=png`} download={`${values.reference_no}-qr.png`}>
              <QrCode /> QR kod (PNG)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/admin/properties/${values.id}/qr?format=svg`} download={`${values.reference_no}-qr.svg`}>
              <QrCode /> QR kod (baskı, SVG)
            </a>
          </Button>
          {perms.pdf && (
            <Button asChild variant="outline">
              <a href={`/admin/ilanlar/${values.id}/brosur`} target="_blank" rel="noopener noreferrer">
                <FileText /> PDF broşür
              </a>
            </Button>
          )}
        </div>
        <p className="mt-3 text-[12.5px] text-muted-foreground">QR kod ilan sayfasını açar ve bu ziyaretler istatistiklerde “QR” kaynağıyla sayılır.</p>
      </StepSection>

      <StepSection title="Performans">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Görüntülenme', value: stats.views, icon: Eye },
            { label: 'Favori', value: stats.favorites, icon: Heart },
            { label: 'WhatsApp', value: stats.whatsapp, icon: WhatsAppIcon },
            { label: 'Telefon', value: stats.phone, icon: Phone },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-muted p-3.5">
              <dt className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                <s.icon className="size-3.5" aria-hidden /> {s.label}
              </dt>
              <dd className="numeric mt-1 text-xl font-bold">{formatNumber(s.value)}</dd>
            </div>
          ))}
        </dl>
      </StepSection>

      {priceHistory.length > 0 && (
        <StepSection title="Fiyat geçmişi">
          <ul className="space-y-2 text-[13.5px]">
            {priceHistory.map((p) => (
              <li key={p.changed_at} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground">{formatDateTime(p.changed_at)}</span>
                <span className="numeric">
                  {p.old_price !== null ? `${formatListingPrice(p.old_price, p.currency as 'TRY', values.listing_type)} → ` : ''}
                  <strong>{formatListingPrice(p.new_price, p.currency as 'TRY', values.listing_type)}</strong>
                </span>
                {p.old_price !== null && p.new_price < p.old_price && (
                  <Badge variant="success">
                    <TrendingDown /> Düştü
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </StepSection>
      )}

      {history.length > 0 && (
        <StepSection title="İşlem geçmişi">
          <ol className="space-y-2.5 border-l border-border pl-4 text-[13.5px]">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
                <span className="font-medium">{HISTORY_LABELS[h.action] ?? h.action}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {h.actor_label ?? 'Sistem'} · {formatDateTime(h.created_at)}
                </span>
              </li>
            ))}
          </ol>
        </StepSection>
      )}

      {values.is_featured && (
        <p className="flex items-center gap-2 text-[13px] text-accent-ink">
          <Star className="size-4" aria-hidden /> Bu ilan öne çıkan ilanlar arasında.
        </p>
      )}
    </div>
  );
}

const HISTORY_LABELS: Record<string, string> = {
  'property.created': 'İlan oluşturuldu',
  'property.updated': 'İlan güncellendi',
  'property.status_changed': 'Durum değişti',
  'property.price_changed': 'Fiyat değişti',
  'property.deleted': 'Çöp kutusuna taşındı',
  'property.restored': 'Geri yüklendi',
};
