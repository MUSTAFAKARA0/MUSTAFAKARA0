import { PlatformWordmark } from '@/components/brand/platform-wordmark';
import { PLATFORM_SCOPE, platformThemeCss } from '@/platform/branding/platform-brand';
import { platformFont } from '@/platform/branding/platform-font';

/**
 * KARAY platform girişi / şifre / doğrulama sayfalarının çerçevesi: KARAY markası ve
 * yazı tipi; ofis markası kullanılmaz. (Ofis paneli için AuthCard.)
 */
export function PlatformAuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className={`${PLATFORM_SCOPE} ${platformFont.className} min-h-dvh bg-background`}>
      <style href="platform-theme" precedence="high">
        {platformThemeCss(platformFont.style.fontFamily)}
      </style>
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 flex flex-col items-center text-center">
            <PlatformWordmark height={64} />
            <h1 className="mt-7 text-[1.5rem] leading-tight font-semibold text-foreground">{title}</h1>
            {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
