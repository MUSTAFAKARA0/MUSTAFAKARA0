/**
 * İlan kartı iskeleti. Boyutları gerçek kartla aynıdır (CLS yok); düzen varyantları
 * (standart, görsel üstü, editoryal, yatay, kompakt) ızgaranın `data-sk-layout` / `data-sk-image`
 * özniteliklerine göre src/styles/site-ui.css içinde seçilir. Düzen sunucuda sitenin seçili stilinden verilir;
 * genel CSS `data-site-*` varyant seçicisi KULLANMAZ (Site Factory izolasyonu: varsayılan sitede hiçbir
 * tema/varyant kuralı yazılmaz — SURF-11, SF-03). Düzen verilmezse standart kart iskeleti çizilir. Bu işaretleme BİLİNÇLİ OLARAK
 * `.property-card` / `.listing-grid` sınıflarını kullanmaz (E2E sayaçları ve imza CSS'i
 * yalnızca gerçek kartı görsün diye).
 */
export function PropertyCardSkeleton() {
  return (
    <div className="pcs" aria-hidden>
      <div className="pcs-media su-skel" />
      <div className="pcs-lines">
        <i className="su-skel" />
        <i className="su-skel" />
        <i className="su-skel" />
        <i className="su-skel" />
      </div>
    </div>
  );
}

export type SkeletonLayout = { layout?: string; image?: string };

export function SkeletonGrid({ count = 6, cols = 3, layout, image }: { count?: number; cols?: 3 | 4 } & SkeletonLayout) {
  return (
    <div className="pcs-grid" data-cols={cols} data-sk-layout={layout} data-sk-image={image}>
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
