import { AdminMobileBar, AdminSidebar } from '@/components/admin/admin-nav';
import { requireAdminPage } from '@/lib/auth';
import { getNewContactCount } from '@/lib/data/admin';
import { getSiteSettings } from '@/lib/data/settings';

export const dynamic = 'force-dynamic';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAdminPage();
  const [settings, newMessages] = await Promise.all([getSiteSettings(), getNewContactCount(supabase)]);
  return (
    <>
      <AdminSidebar businessName={settings.business_name} email={user.email ?? ''} newMessages={newMessages} />
      <AdminMobileBar businessName={settings.business_name} newMessages={newMessages} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </>
  );
}
