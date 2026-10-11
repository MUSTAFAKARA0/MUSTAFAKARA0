import { requirePageContext } from '@/platform/auth/session';

/** Yazdırma sayfaları: yönetim menüsü olmadan, yalnızca oturum ve yetki kontrolüyle */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requirePageContext();
  return <div className="min-h-dvh bg-[#e9e7e2] print:bg-white">{children}</div>;
}
