'use client';

import './globals.css';

/** Kök düzeyde (layout dahil) çöken durumlar için son savunma hattı */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body className="flex min-h-dvh items-center justify-center bg-canvas p-6 font-sans">
        <div className="max-w-md text-center">
          <p className="text-6xl font-bold text-brand-200">500</p>
          <h1 className="mt-4 text-2xl font-bold text-ink">Site şu anda yanıt veremiyor</h1>
          <p className="mt-3 text-sand-600">Kısa süre içinde tekrar deneyin. Anlayışınız için teşekkür ederiz.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
