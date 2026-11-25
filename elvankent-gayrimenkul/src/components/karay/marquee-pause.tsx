'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';

/** Tasarım şeridi için görünür Duraklat / Oynat düğmesi (WCAG 2.2.2): üst kaptaki data-paused özniteliği animasyonu durdurur. Yalnızca şerit hareket ediyorsa (fare + hareket serbest) görünür. */
export function MarqueePause() {
  const [paused, setPaused] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={(e) => {
        const next = !paused;
        setPaused(next);
        const wrap = e.currentTarget.closest('.ky-marquee-wrap');
        if (next) wrap?.setAttribute('data-paused', '');
        else wrap?.removeAttribute('data-paused');
      }}
      className="ky-pause"
    >
      {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
      Şeridi duraklat
    </button>
  );
}
