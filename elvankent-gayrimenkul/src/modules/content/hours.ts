/**
 * Çalışma saatleri (şirket ayarlarında yapılandırılmış biçimde tutulur):
 *   [{ "days": ["mo","tu","we","th","fr","sa"], "opens": "09:00", "closes": "19:00" }]
 */
export const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mo: 'Pazartesi',
  tu: 'Salı',
  we: 'Çarşamba',
  th: 'Perşembe',
  fr: 'Cuma',
  sa: 'Cumartesi',
  su: 'Pazar',
};

const SHORT: Record<Weekday, string> = { mo: 'Pzt', tu: 'Sal', we: 'Çar', th: 'Per', fr: 'Cum', sa: 'Cmt', su: 'Paz' };
const SCHEMA_DAYS: Record<Weekday, string> = {
  mo: 'Monday',
  tu: 'Tuesday',
  we: 'Wednesday',
  th: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  su: 'Sunday',
};

export interface OpeningHours {
  days: Weekday[];
  opens: string;
  closes: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseOpeningHours(value: unknown): OpeningHours[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== 'object') return null;
      const o = v as Record<string, unknown>;
      const days = Array.isArray(o.days) ? o.days.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(String(d))) : [];
      const opens = String(o.opens ?? '');
      const closes = String(o.closes ?? '');
      if (!days.length || !TIME.test(opens) || !TIME.test(closes)) return null;
      return { days: WEEKDAYS.filter((d) => days.includes(d)), opens, closes };
    })
    .filter((x): x is OpeningHours => x !== null)
    .slice(0, 7);
}

function dayRange(days: Weekday[]): string {
  const idx = days.map((d) => WEEKDAYS.indexOf(d)).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && idx.length > 2) return `${SHORT[WEEKDAYS[idx[0]]]}–${SHORT[WEEKDAYS[idx[idx.length - 1]]]}`;
  return idx.map((i) => SHORT[WEEKDAYS[i]]).join(', ');
}

export function formatOpeningHours(hours: OpeningHours[]): string[] {
  return hours.map((h) => `${dayRange(h.days)} ${h.opens}–${h.closes}`);
}

export function openingHoursSchema(hours: OpeningHours[]) {
  return hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.days.map((d) => SCHEMA_DAYS[d]),
    opens: h.opens,
    closes: h.closes,
  }));
}
