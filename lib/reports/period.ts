/*
  Report periods.

  A period is a calendar month, written `YYYY-MM`. It is in the URL, so it has
  to be stable, sortable and impossible to misread — `2026-08` is all three, and
  it means the same thing to a person as it does to a sort.

  Client-safe: pure functions, no data access.
*/

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPeriod(value: string): boolean {
  return PERIOD_RE.test(value);
}

/** The month we are in now, in the machine's local reckoning. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The window a period covers, as ISO instants.
 *
 * The end is the first moment of the next month, and the timeline query uses
 * `<=`, so an event at exactly midnight on the 1st would fall in both months.
 * `to` is therefore pulled back by a millisecond — a boundary event belongs to
 * one report, and it should be the earlier one.
 */
export function periodRange(period: string): { from: string; to: string } {
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0, 0);
  return { from: from.toISOString(), to: new Date(to.getTime() - 1).toISOString() };
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/** Short form for a header — "August 2026" becomes "Aug 2026". */
export function periodShort(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function shift(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 1 + months, 1);
  return currentPeriod(d);
}

export function prevPeriod(period: string): string {
  return shift(period, -1);
}

export function nextPeriod(period: string): string {
  return shift(period, 1);
}

/** Whether a period is in the future — there is nothing to report on yet. */
export function isFuture(period: string, now: Date = new Date()): boolean {
  return period > currentPeriod(now);
}

/** The last `count` periods, newest first, ending with the current month. */
export function recentPeriods(count: number, now: Date = new Date()): string[] {
  const current = currentPeriod(now);
  return Array.from({ length: count }, (_, i) => shift(current, -i));
}
