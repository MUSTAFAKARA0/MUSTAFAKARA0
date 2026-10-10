import { ArrowDownRight, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PropertyCard } from '@/modules/properties/types';

/** İlan rozetleri: durum, yeni, fiyat düştü, öne çıkan, demo (en fazla 3) */
export function PropertyBadges({ property, className }: { property: PropertyCard; className?: string }) {
  const badges: React.ReactNode[] = [];
  if (property.status === 'sold') badges.push(<Badge key="sold" variant="inverse">Satıldı</Badge>);
  if (property.status === 'rented') badges.push(<Badge key="rented" variant="inverse">Kiralandı</Badge>);
  if (property.hasPriceDrop)
    badges.push(
      <Badge key="drop" variant="success" className="bg-white/95 shadow-xs">
        <ArrowDownRight aria-hidden /> Fiyat düştü
      </Badge>,
    );
  if (property.isNew)
    badges.push(
      <Badge key="new" variant="glass">
        <Sparkles aria-hidden className="text-accent-ink" /> Yeni
      </Badge>,
    );
  if (property.isFeatured && property.status === 'published')
    badges.push(
      <Badge key="featured" variant="glass">
        <Star aria-hidden className="fill-accent text-accent" /> Öne çıkan
      </Badge>,
    );
  if (property.isDemo) badges.push(<Badge key="demo" variant="inverse" className="tracking-wider">DEMO</Badge>);
  if (!badges.length) return null;
  return <div className={className}>{badges.slice(0, 3)}</div>;
}
