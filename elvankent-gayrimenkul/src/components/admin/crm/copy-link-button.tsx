'use client';

import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyLinkButton({ url, label = 'Bağlantıyı kopyala' }: { url: string; label?: string }) {
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Bağlantı kopyalandı.');
        } catch {
          toast.error('Bağlantı kopyalanamadı.');
        }
      }}
    >
      <Copy /> {label}
    </Button>
  );
}
