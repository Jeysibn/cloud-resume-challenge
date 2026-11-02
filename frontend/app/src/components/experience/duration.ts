const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseMonth(value: string, today: Date): { year: number; month: number } | null {
  if (/^present$/i.test(value.trim())) return { year: today.getFullYear(), month: today.getMonth() };
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  return month < 0 ? null : { year: Number(match[2]), month };
}

/**
 * Length of a period like "August 2025 – February 2026", counting both end
 * months (the convention LinkedIn uses). "Present" means the current month.
 * Returns null when the period cannot be read, so callers can omit it.
 */
export function periodLength(period: string, today = new Date()): string | null {
  const [from, to] = period.split(/\s*[–-]\s*/);
  if (!from || !to) return null;
  const start = parseMonth(from, today);
  const end = parseMonth(to, today);
  if (!start || !end) return null;
  const months = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  if (months < 1) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years ? `${years} yr${years > 1 ? "s" : ""}` : "",
    rest ? `${rest} mo${rest > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export const isCurrent = (period: string) => /[–-]\s*present\s*$/i.test(period);
