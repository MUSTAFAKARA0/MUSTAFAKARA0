import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { firstParam } from '@/lib/utils';
import { PERMISSION_LABELS, type Permission } from '@/platform/auth/permissions';

export const metadata: Metadata = { title: 'Yetkiniz yok' };

export default async function ForbiddenPage({ searchParams }: PageProps<'/admin/yetkisiz'>) {
  const permission = firstParam((await searchParams).izin);
  const label = permission === 'platform' ? 'Süper admin (platform yönetimi)' : PERMISSION_LABELS[permission as Permission];
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto size-12 text-warning" aria-hidden />
        <h1 className="mt-4 font-display text-2xl">Bu sayfa için yetkiniz yok</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {label ? (
            <>
              Gerekli yetki: <strong className="text-foreground">{label}</strong>. Rolünüzde bu yetki bulunmuyor; gerekiyorsa ofis
              yöneticinizle görüşün.
            </>
          ) : (
            'Rolünüz bu işlemi yapmaya izin vermiyor.'
          )}
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin">Panele dön</Link>
        </Button>
      </div>
    </main>
  );
}
