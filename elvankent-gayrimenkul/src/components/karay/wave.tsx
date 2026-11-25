import { cn } from '@/lib/utils';

/** Bölüm geçişi: dekoratif satır içi SVG dalga. `fill` bir sonraki (alttaysa) ya da önceki (üstteyse) bölümün zemin rengidir. */
export function Wave({ fill, position = 'bottom', className }: { fill: string; position?: 'top' | 'bottom'; className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={cn('ky-wave', position === 'top' ? 'ky-wave-top' : 'ky-wave-bottom', className)}
      style={{ color: fill }}
    >
      <path fill="currentColor" d="M0 80V44C150 8 310-6 500 14c210 22 330 56 560 40C1210 44 1330 22 1440 6V80Z" />
    </svg>
  );
}
