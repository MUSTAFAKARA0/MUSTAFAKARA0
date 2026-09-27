import { showsDemoNotice } from '@/lib/site-env';

/**
 * Demo / önizleme ortamı şeridi. Ziyaretçinin ve test edenin, sitedeki
 * ilanların ve kişilerin gerçek olmadığını her sayfada görmesini sağlar.
 * Production'da hiç render edilmez.
 */
export function DemoNotice() {
  if (!showsDemoNotice()) return null;
  return (
    <div role="note" className="bg-warning-soft px-4 py-1.5 text-center text-[13px] leading-snug font-semibold text-warning">
      DEMO ORTAMI · Bu sitedeki ilanlar, kişiler ve bilgiler örnektir; gerçek değildir.
    </div>
  );
}
