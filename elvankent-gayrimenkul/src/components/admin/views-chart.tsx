'use client';

import { useState } from 'react';

interface Point {
  day: string;
  views: number;
}

const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Son 30 günün günlük görüntülenme çubuk grafiği (tek seri, tek eksen).
 * Üzerine gelince/odaklanınca günün değeri gösterilir; ekran okuyucular için tablo sunulur.
 */
export function ViewsChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.views));
  const niceMax = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const W = 600;
  const H = 180;
  const padL = 28;
  const padB = 22;
  const plotW = W - padL;
  const plotH = H - padB - 8;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(14, slot - 2));
  const ticks = [0, niceMax / 2, niceMax];
  const current = active !== null ? data[active] : null;

  if (!data.length) return <p className="text-sm text-sand-500">Henüz veri yok.</p>;

  return (
    <div>
      <div className="mb-2 flex h-6 items-baseline justify-between text-sm">
        <span className="text-sand-600">Günlük ilan görüntülenmesi</span>
        {current && (
          <span className="font-semibold text-ink tabular-nums" aria-live="polite">
            {dayFmt.format(new Date(current.day))}: {current.views}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Son 30 günlük görüntülenme grafiği">
        {ticks.map((t) => {
          const y = 8 + plotH - (t / niceMax) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W} y1={y} y2={y} stroke="var(--sand-200)" strokeWidth="1" />
              <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--sand-500)">
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.views / niceMax) * plotH;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = 8 + plotH - h;
          return (
            <g key={d.day}>
              {h > 0 && (
                <path
                  d={`M${x},${8 + plotH} V${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, barW / 2)},${y} H${x + barW - Math.min(4, barW / 2)} Q${x + barW},${y} ${x + barW},${y + Math.min(4, h)} V${8 + plotH} Z`}
                  fill={active === i ? 'var(--brand-800)' : 'var(--brand-600)'}
                />
              )}
              {/* Geniş, görünmez isabet alanı */}
              <rect
                x={padL + i * slot}
                y={0}
                width={slot}
                height={H - padB}
                fill="transparent"
                tabIndex={0}
                aria-label={`${dayFmt.format(new Date(d.day))}: ${d.views} görüntülenme`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--sand-500)">
                  {dayFmt.format(new Date(d.day))}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Günlük görüntülenme</caption>
        <thead>
          <tr>
            <th>Gün</th>
            <th>Görüntülenme</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
