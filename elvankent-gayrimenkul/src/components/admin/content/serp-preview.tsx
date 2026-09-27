/** Arama sonucu önizlemesi (yaklaşık görünüm; kesin görünümü arama motoru belirler) */
export function SerpPreview({ host, path, title, description }: { host: string; path: string; title: string; description: string }) {
  const crumbs = path.split('/').filter(Boolean).join(' › ');
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="truncate text-[12.5px] text-[#4d5156]">
        {host}
        {crumbs && ` › ${crumbs}`}
      </p>
      <p className="mt-1 line-clamp-2 text-[17px] leading-snug text-[#1a0dab]">{title || 'Başlık'}</p>
      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-[#4d5156]">{description || 'Açıklama eklendiğinde burada görünür.'}</p>
    </div>
  );
}
