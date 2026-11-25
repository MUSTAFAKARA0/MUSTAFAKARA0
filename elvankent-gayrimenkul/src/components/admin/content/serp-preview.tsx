/** Arama sonucu önizlemesi (yaklaşık görünüm; kesin görünümü arama motoru belirler) */
export function SerpPreview({ host, path, title, description }: { host: string; path: string; title: string; description: string }) {
  const crumbs = path.split('/').filter(Boolean).join(' › ');
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="truncate text-[12.5px] text-serp-muted">
        {host}
        {crumbs && ` › ${crumbs}`}
      </p>
      <p className="mt-1 line-clamp-2 text-[17px] leading-snug text-serp-title">{title || 'Başlık'}</p>
      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-serp-muted">{description || 'Açıklama eklendiğinde burada görünür.'}</p>
    </div>
  );
}
