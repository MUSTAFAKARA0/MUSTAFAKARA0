import { KaroMascot } from '@/components/brand/karo-mascot';
import { PlatformWordmark } from '@/components/brand/platform-wordmark';
import { PLATFORM_SCOPE, platformThemeCss } from '@/platform/branding/platform-brand';
import { platformFont } from '@/platform/branding/platform-font';

/**
 * KARAY platform girişi / şifre / doğrulama sayfalarının çerçevesi: KARAYS markası ve
 * yazı tipi; ofis markası kullanılmaz. (Ofis paneli için AuthCard.)
 * Geniş ekranda KARO kartın solunda karşılar; dar ekranda gösterilmez ve indirilmez (form öncelikli).
 */
export function PlatformAuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className={`${PLATFORM_SCOPE} ${platformFont.className} min-h-dvh bg-background`}>
      <style href="platform-theme" precedence="high">
        {platformThemeCss(platformFont.style.fontFamily)}
      </style>
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-[26rem]">
          <KaroMascot width={176} className="absolute right-full bottom-0 mr-10 hidden h-auto w-[176px] lg:block" />
          <div className="mb-8 flex flex-col items-center text-center">
            <PlatformWordmark height={56} />
            <h1 className="mt-7 text-[1.5rem] leading-tight font-semibold text-foreground">{title}</h1>
            {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
