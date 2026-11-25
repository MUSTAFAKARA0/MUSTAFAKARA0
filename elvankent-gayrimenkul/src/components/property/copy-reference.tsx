'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** İlan numarasını panoya kopyalar; sonuç (başarı veya pano yok) ekran okuyucuya da duyurulur. */
export function CopyReference({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    window.clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('failed');
    }
    timer.current = window.setTimeout(() => setState('idle'), 2500);
  };
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label="İlan numarasını kopyala"
        className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-primary-ink hover:bg-primary-soft sm:-my-2"
      >
        {state === 'done' ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        <span aria-hidden>{state === 'done' ? 'Kopyalandı' : state === 'failed' ? 'Kopyalanamadı' : 'Kopyala'}</span>
      </button>
      <span className="sr-only" role="status">
        {state === 'done' ? 'İlan numarası kopyalandı' : state === 'failed' ? 'Kopyalanamadı; numarayı elle seçip kopyalayabilirsiniz' : ''}
      </span>
    </>
  );
}
