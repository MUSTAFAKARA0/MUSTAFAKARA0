import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { AlertTriangle, HardDrive, ImageIcon, Images, Loader2, Star, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/admin/action-controls';
import { AdminPageHeader, EmptyPanel, StatCard } from '@/components/admin/ui';
import { Pagination } from '@/components/common/pagination';
import { MediaImage } from '@/components/gallery/media-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form-controls';
import { Progress } from '@/components/ui/progress';
import { deleteMedia } from '@/app/actions/media';
import { formatBytes, formatDate, formatNumber } from '@/lib/format';
import { firstParam, isUuid, parsePositiveInt } from '@/lib/utils';
import {
  LIBRARY_SIZES,
  LIBRARY_TYPES,
  libraryPropertyOptions,
  libraryUsage,
  listLibrary,
  type LibraryFilters,
  type LibrarySize,
  type LibraryType,
} from '@/modules/media/library';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Medya kütüphanesi' };

const DAYS = [7, 30, 90, 365];

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export default async function MediaLibraryPage({ searchParams }: PageProps<'/admin/medya'>) {
  const ctx = await requirePagePermission('media.manage');
  const sp = await searchParams;
  const filters: LibraryFilters = {
    kind: pick(firstParam(sp.tur), ['ilan', 'icerik'] as const),
    propertyId: isUuid(firstParam(sp.ilan)) ? firstParam(sp.ilan) : undefined,
    type: pick(firstParam(sp.tip), Object.keys(LIBRARY_TYPES) as LibraryType[]),
    size: pick(firstParam(sp.boyut), Object.keys(LIBRARY_SIZES) as LibrarySize[]),
    days: DAYS.includes(Number(firstParam(sp.tarih))) ? Number(firstParam(sp.tarih)) : undefined,
    status: pick(firstParam(sp.durum), ['ready', 'failed', 'pending'] as const),
    q: firstParam(sp.q),
    sort: pick(firstParam(sp.sirala), ['yeni', 'eski', 'buyuk'] as const) ?? 'yeni',
    page: Math.max(1, parsePositiveInt(firstParam(sp.sayfa), 10_000) ?? 1),
  };
  const [{ items, total, pageCount }, usage, properties] = await Promise.all([listLibrary(ctx, filters), libraryUsage(ctx), libraryPropertyOptions(ctx)]);
  const filtered = Object.entries(filters).some(([k, v]) => !['sort', 'page'].includes(k) && v !== undefined && v !== '');
  const limitBytes = usage.limitMb ? usage.limitMb * 1024 * 1024 : null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const value = firstParam(v);
      if (value && k !== 'sayfa') params.set(k, value);
    }
    if (page > 1) params.set('sayfa', String(page));
    const qs = params.toString();
    return qs ? `/admin/medya?${qs}` : '/admin/medya';
  };

  return (
    <>
      <AdminPageHeader
        title="Medya kütüphanesi"
        description="Organizasyonunuza ait tüm görseller. Orijinal dosyalar özel depoda saklanır; sitede yalnızca sunucuda üretilen WebP boyutları (320–2880 px) gösterilir."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Toplam görsel" value={formatNumber(total)} icon={Images} hint={filtered ? 'filtreye uyan' : 'tüm görseller'} />
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold text-muted-foreground">Depolama kullanımı</p>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground/70">
              <HardDrive className="size-[18px]" aria-hidden />
            </span>
          </div>
          <p className="numeric mt-2 text-[1.75rem] leading-none font-bold tracking-tight">{formatBytes(usage.usedBytes)}</p>
          {limitBytes ? (
            <>
              <Progress
                value={(usage.usedBytes / limitBytes) * 100}
                label="Depolama kullanım oranı"
                tone={usage.usedBytes / limitBytes > 0.9 ? 'danger' : 'primary'}
                className="mt-3"
              />
              <p className="mt-2 text-[12.5px] text-muted-foreground">Plan sınırı: {formatBytes(limitBytes)} (orijinaller + boyutlar)</p>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted-foreground">Orijinaller + üretilen boyutlar</p>
          )}
        </div>
        <StatCard
          label="Sorunlu yükleme"
          value={formatNumber(usage.failed + usage.pending)}
          icon={AlertTriangle}
          tone={usage.failed ? 'warning' : 'default'}
          hint={`${formatNumber(usage.failed)} başarısız · ${formatNumber(usage.pending)} tamamlanmamış`}
          href={usage.failed ? '/admin/medya?durum=failed' : undefined}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-xs">
        <form action="/admin/medya" className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 2xl:grid-cols-8" aria-label="Medya filtreleri">
          <div className="sm:col-span-2 lg:col-span-4 2xl:col-span-2">
            <label htmlFor="m-q" className="sr-only">
              Dosya adında ara
            </label>
            <Input id="m-q" name="q" defaultValue={filters.q} placeholder="Dosya adında ara" className="h-10" />
          </div>
          <FilterSelect id="m-ilan" name="ilan" label="İlan" value={filters.propertyId} options={properties.map((p) => ({ value: p.id, label: p.label }))} all="Tüm ilanlar" />
          <FilterSelect
            id="m-tur"
            name="tur"
            label="Kullanım"
            value={filters.kind}
            options={[
              { value: 'ilan', label: 'İlan fotoğrafları' },
              { value: 'icerik', label: 'İçerik görselleri' },
            ]}
            all="Tüm görseller"
          />
          <FilterSelect id="m-tip" name="tip" label="Dosya tipi" value={filters.type} options={Object.entries(LIBRARY_TYPES).map(([value, t]) => ({ value, label: t.label }))} all="Tüm tipler" />
          <FilterSelect id="m-boyut" name="boyut" label="Boyut" value={filters.size} options={Object.entries(LIBRARY_SIZES).map(([value, s]) => ({ value, label: s.label }))} all="Tüm boyutlar" />
          <FilterSelect id="m-tarih" name="tarih" label="Tarih" value={filters.days ? String(filters.days) : undefined} options={DAYS.map((d) => ({ value: String(d), label: d === 365 ? 'Son 1 yıl' : `Son ${d} gün` }))} all="Tüm zamanlar" />
          <FilterSelect
            id="m-sirala"
            name="sirala"
            label="Sıralama"
            value={filters.sort === 'yeni' ? undefined : filters.sort}
            options={[
              { value: 'eski', label: 'En eski' },
              { value: 'buyuk', label: 'En büyük dosya' },
            ]}
            all="En yeni"
          />
          {filters.status && <input type="hidden" name="durum" value={filters.status} />}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 2xl:col-span-8 2xl:justify-end">
            <Button type="submit" size="sm">
              Filtrele
            </Button>
            {filtered && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/admin/medya">Filtreleri temizle</Link>
              </Button>
            )}
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyPanel
            icon={ImageIcon}
            title={filtered ? 'Bu filtrelere uygun görsel yok' : 'Henüz görsel yüklenmemiş'}
            description={filtered ? 'Filtreleri değiştirerek tekrar deneyin.' : 'İlan düzenleyicisindeki Fotoğraflar adımından veya blog yazısı kapağından görsel yükleyebilirsiniz.'}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 p-4 min-[480px]:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.map((m) => (
              <li key={m.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
                <div className="relative aspect-[4/3] bg-surface-muted">
                  {m.status === 'ready' ? (
                    <MediaImage media={m.media} alt={m.media.alt_text ?? ''} fill sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 25vw, (min-width: 480px) 45vw, 90vw" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[12.5px] text-muted-foreground">
                      {m.status === 'failed' ? <AlertTriangle className="size-6 text-warning" aria-hidden /> : <Loader2 className="size-6" aria-hidden />}
                      <span>{m.status === 'failed' ? (m.error ?? 'İşleme başarısız') : 'Yükleme tamamlanmadı'}</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {m.status === 'failed' && <Badge variant="danger">Başarısız</Badge>}
                    {m.status === 'pending' && <Badge variant="warning">Bekliyor</Badge>}
                    {m.isCover && (
                      <Badge variant="glass">
                        <Star aria-hidden /> Kapak
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <p className="truncate text-[13.5px] font-semibold" title={m.fileName ?? undefined}>
                    {m.fileName ?? 'Adsız dosya'}
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12.5px]">
                    <dt className="text-muted-foreground">Çözünürlük</dt>
                    <dd className="numeric truncate text-right">{m.width && m.height ? `${m.width}×${m.height}` : '—'}</dd>
                    <dt className="text-muted-foreground">Boyut</dt>
                    <dd className="numeric truncate text-right" title={m.variantsByteSize ? `Üretilen boyutlar: ${formatBytes(m.variantsByteSize)}` : undefined}>
                      {m.byteSize ? formatBytes(m.byteSize) : '—'}
                      {m.mimeType && <span className="text-muted-foreground"> · {m.mimeType.replace('image/', '').toUpperCase()}</span>}
                    </dd>
                    <dt className="text-muted-foreground">Yüklendi</dt>
                    <dd className="truncate text-right">{formatDate(m.createdAt)}</dd>
                  </dl>
                  <p className="mt-2 truncate text-[12.5px]">
                    {m.property ? (
                      <Link href={`/admin/ilanlar/${m.property.id}?adim=fotograflar`} className="font-medium text-primary-ink hover:underline" title={m.property.title}>
                        {m.property.referenceNo} · {m.property.title}
                      </Link>
                    ) : m.usedBy.length ? (
                      <Link href={`/admin/icerikler/${m.usedBy[0].id}`} className="font-medium text-primary-ink hover:underline" title={m.usedBy[0].title}>
                        Blog kapağı · {m.usedBy[0].title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Hiçbir içerikte kullanılmıyor</span>
                    )}
                    {m.property?.deleted && <span className="text-warning"> (çöp kutusunda)</span>}
                  </p>
                  <div className="mt-auto flex justify-end pt-3">
                    <ActionButton
                      size="xs"
                      variant="danger-ghost"
                      confirm={{
                        title: 'Görsel kalıcı olarak silinsin mi?',
                        description: m.property
                          ? 'Fotoğraf ilandan da kaldırılır; orijinal dosya ve tüm boyutları silinir.'
                          : m.usedBy.length
                            ? 'Görsel, kullanıldığı yazının kapağından da kaldırılır; tüm dosyaları silinir.'
                            : 'Orijinal dosya ve tüm boyutları silinir.',
                        confirmLabel: 'Sil',
                        destructive: true,
                      }}
                      action={async () => {
                        'use server';
                        return deleteMedia(m.id);
                      }}
                    >
                      <Trash2 /> Sil
                    </ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination page={filters.page} pageCount={pageCount} hrefFor={hrefFor} />
    </>
  );
}

function FilterSelect({ id, name, label, value, options, all }: { id: string; name: string; label: string; value?: string; options: { value: string; label: string }[]; all: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? ''} className="h-10 truncate">
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
