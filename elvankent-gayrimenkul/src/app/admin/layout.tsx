import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Yönetim Paneli', template: '%s | Yönetim Paneli' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-sand-100">{children}</div>;
}
