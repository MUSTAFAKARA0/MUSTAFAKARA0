import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Gerçek veriden küçük çizgi grafiği. 2'den az nokta varsa çizilmez ve dürüstçe "Henüz yeterli veri yok" denir.
 * Erişilebilirlik: <title>/<desc> ve ekran okuyucu için değer özeti.
 */
export function Sparkline({ values, label, className, width = 120, height = 32 }: { values: readonly number[]; label: string; className?: string; width?: number; height?: number }) {
  const uid = useId();
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2 || clean.filter((v) => v > 0).length < 2) {
    return <p className={cn('text-[12px] text-muted-foreground', className)}>Henüz yeterli veri yok</p>;
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pad = 2;
  const points = clean.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / (clean.length - 1);
    const y = height - pad - ((v - min) * (height - pad * 2)) / span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const nf = new Intl.NumberFormat('tr-TR');
  const desc = `${clean.length} nokta; en düşük ${nf.format(min)}, en yüksek ${nf.format(max)}, son değer ${nf.format(clean[clean.length - 1])}`;
  return (
    <svg role="img" aria-labelledby={`${uid}-t ${uid}-d`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn('text-primary', className)}>
      <title id={`${uid}-t`}>{label}</title>
      <desc id={`${uid}-d`}>{desc}</desc>
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
