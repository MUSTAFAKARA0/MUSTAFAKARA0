import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireAdminPage } from '@/lib/auth';
import type { SiteSettings } from '@/types/database';

export const metadata: Metadata = { title: 'Ayarlar' };

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  // Önbelleksiz, güncel ayarlar
  const [{ data: settings, error }, { count: demoCount }] = await Promise.all([
    supabase.from('site_settings').select('*').eq('id', 1).single(),
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ]);
  if (error || !settings) throw new Error('Ayarlar yüklenemedi.');
  return (
    <>
      <AdminPageHeader title="Ayarlar" description="İşletme bilgileri, logo ve site içeriği." />
      <SettingsForm settings={settings as SiteSettings} demoCount={demoCount ?? 0} />
    </>
  );
}
