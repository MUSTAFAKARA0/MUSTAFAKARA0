import { Logo } from '@/components/brand/logo';
import { telHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { brandingUrl } from '@/modules/media/variants';
import type { SiteStatus } from '@/site-config/schema';
import type { Tenant } from '@/platform/tenant/tenant';

/** Bakım modu / henüz yayında olmayan site: ziyaretçiye sade bilgi sayfası (arama motorlarına kapalı) */
export function MaintenancePage({ tenant, status, message }: { tenant: Tenant; status: SiteStatus; message: string | null }) {
  const s = tenant.settings;
  const phone = telHref(s.phone);
  return (
    <main id="icerik" className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      {/* Alt sayfanın kendi robots etiketi olsa bile bakım sayfası dizine eklenmez (en kısıtlayıcı kural geçerlidir) */}
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center">
          <Logo name={s.display_name} logoUrl={brandingUrl(s.logo_url)} />
        </div>
        <h1 className="mt-10 font-display text-display-lg text-foreground">{status === 'draft' ? 'Sitemiz çok yakında yayında' : 'Sitemiz kısa bir bakımda'}</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
          {message ?? (status === 'draft' ? 'Yeni web sitemiz hazırlanıyor.' : 'Kısa süre içinde tekrar hizmetinizdeyiz. Anlayışınız için teşekkür ederiz.')}
        </p>
        {(phone || s.email) && (
          <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px] font-semibold">
            {phone && s.phone && (
              <a href={phone} className="text-primary-ink hover:underline">
                {formatPhoneDisplay(s.phone)}
              </a>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="text-primary-ink hover:underline">
                {s.email}
              </a>
            )}
          </p>
        )}
      </div>
    </main>
  );
}

/** Taslak önizlemesi açıkken sayfanın üstünde görünen şerit (yalnızca önizleyen tarayıcıda) */
export function PreviewBar() {
  return (
    <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#0b1b3a] px-4 py-2 text-center text-[13px] font-semibold text-white">
      <span>ÖNİZLEME · Yayınlanmamış değişiklikler gösteriliyor; canlı site etkilenmez.</span>
      <a href="/api/site-preview?cikis=1" className="underline underline-offset-2">
        Önizlemeden çık
      </a>
    </div>
  );
}
