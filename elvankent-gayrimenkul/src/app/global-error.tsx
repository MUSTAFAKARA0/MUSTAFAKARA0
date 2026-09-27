'use client';

import './globals.css';

/** Kök düzeyde (yerleşim dahil) çöken durumlar için son savunma hattı */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
        <div className="max-w-md text-center">
          <p className="font-display text-6xl text-primary/20" aria-hidden>
            500
          </p>
          <h1 className="mt-4 text-2xl font-bold">Site şu anda yanıt veremiyor</h1>
          <p className="mt-3 text-muted-foreground">Kısa süre içinde tekrar deneyin. Anlayışınız için teşekkür ederiz.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
