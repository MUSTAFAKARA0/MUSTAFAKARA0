import Link from '@/components/common/intent-link';
import { SearchX } from 'lucide-react';
import { EmptyPanel } from '@/components/panel/ui';
import { Button } from '@/components/ui/button';

/** Filtre/arama sonucu boş: temizleme bağlantısı sunar (liste hiç boş değilse bu durum kullanılır) */
export function EmptyFiltered({ clearHref, title = 'Bu filtrelere uyan kayıt yok', description = 'Filtreleri değiştirmeyi veya temizlemeyi deneyin.' }: { clearHref: string; title?: string; description?: string }) {
  return (
    <EmptyPanel
      icon={SearchX}
      title={title}
      description={description}
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={clearHref}>Filtreleri temizle</Link>
        </Button>
      }
    />
  );
}
