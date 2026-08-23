/*
  Pure duration helpers — no server/client dependencies, so they're safe to
  import anywhere (including unit tests).
*/

/** ISO 8601 duration (e.g. "PT4M30S") → seconds, or undefined if unparseable. */
export function parseIsoDuration(iso: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const [, d, h, min, s] = m;
  const total = (+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(min ?? 0)) * 60 + (+(s ?? 0));
  return total;
}

/** Seconds → "m:ss" (or "h:mm:ss" past an hour). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
