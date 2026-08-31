/*
  Extension → server telemetry, sanitized.

  The extension's rule stands: Free Mode phones home for NOTHING, so
  this path only ever runs for a signed-in, connected user — and even
  then it may carry exactly what the closed vocabulary below allows.
  Three funnel events, two prop keys, enum-or-boolean values. A body
  that tries to say anything else — free text, an observation, a URL,
  an invented event — sanitizes to null and is refused.

  Pure and dependency-free so the contract sits under unit test the
  same way capture-types.ts does.
*/

/** The only events the extension may report. */
export const EXTENSION_TELEMETRY_EVENTS = [
  "capture_training_cta_shown",
  "capture_training_cta_clicked",
  "capture_training_upgrade_viewed",
] as const;

export type ExtensionTelemetryEvent = (typeof EXTENSION_TELEMETRY_EVENTS)[number];

/** saved = post-save CTA · library = per-moment action · intent = the
 *  returning-lesson banner after auth/purchase. */
const SURFACES = ["saved", "library", "intent"] as const;

export interface ExtensionTelemetry {
  event: ExtensionTelemetryEvent;
  props: { surface?: "saved" | "library" | "intent"; entitled?: boolean };
}

/** Keep the request body small enough that nothing hides in it. */
export const TELEMETRY_MAX_BYTES = 500;

export function sanitizeExtensionTelemetry(raw: unknown): ExtensionTelemetry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as { event?: unknown; props?: unknown };
  if (!(EXTENSION_TELEMETRY_EVENTS as readonly unknown[]).includes(body.event)) return null;

  const props: ExtensionTelemetry["props"] = {};
  if (body.props && typeof body.props === "object" && !Array.isArray(body.props)) {
    const p = body.props as { surface?: unknown; entitled?: unknown };
    if ((SURFACES as readonly unknown[]).includes(p.surface)) {
      props.surface = p.surface as "saved" | "library" | "intent";
    }
    if (typeof p.entitled === "boolean") props.entitled = p.entitled;
  }

  return { event: body.event as ExtensionTelemetryEvent, props };
}
