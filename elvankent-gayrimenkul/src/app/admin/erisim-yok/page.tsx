import type { Metadata } from 'next';
import { LogOut } from 'lucide-react';
import { AuthCard } from '@/components/panel/auth-card';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/actions/auth';

export const metadata: Metadata = { title: 'Erişim yok' };

export default function NoAccessPage() {
  return (
    <AuthCard
      title="Aktif ofis üyeliğiniz yok"
      description="Hesabınız herhangi bir ofise bağlı değil veya üyeliğiniz devre dışı bırakılmış. Ofis yöneticinizden sizi yeniden eklemesini isteyin."
    >
      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut /> Çıkış yap
        </Button>
      </form>
    </AuthCard>
  );
}
