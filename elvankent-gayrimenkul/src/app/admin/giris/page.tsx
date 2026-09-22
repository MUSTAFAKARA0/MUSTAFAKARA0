import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoMark } from '@/components/layout/logo';
import { LoginForm } from './login-form';
import { getAdminContext } from '@/lib/auth';
import { getSiteSettings } from '@/lib/data/settings';
import { firstParam } from '@/lib/utils';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage({ searchParams }: PageProps<'/admin/giris'>) {
  if (await getAdminContext()) redirect('/admin');
  const sp = await searchParams;
  const settings = await getSiteSettings();
  const next = firstParam(sp.next);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-4 font-display text-2xl text-ink">{settings.business_name}</h1>
          <p className="mt-1 text-sm text-sand-600">Yönetim paneline giriş</p>
        </div>
        <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-sand-600 hover:text-brand-700">
            ← Siteye dön
          </Link>
        </p>
      </div>
    </main>
  );
}
