import "server-only";

/*
  Minimal structured logging. One JSON line per event so Vercel's log drains
  (and any downstream collector) can parse it without a heavy SDK. Keep it
  dependency-free — this is the floor of observability, not an APM.
*/

type Level = "info" | "warn" | "error";

export function logEvent(
  level: Level,
  event: string,
  data: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...redact(data) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Never log secrets or full tokens, even if a caller passes them by mistake. */
function redact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/key|secret|token|password|authorization/i.test(k)) {
      out[k] = typeof v === "string" && v.length > 6 ? `${v.slice(0, 3)}…${v.slice(-2)}` : "***";
    } else {
      out[k] = v;
    }
  }
  return out;
}
