/*
  Fire-and-forget funnel telemetry — CONNECTED MODE ONLY.

  Free Mode phones home for nothing; that promise is enforced here by
  the callers (every call site checks the mode first) and again by the
  server, which refuses unauthenticated senders. What travels is the
  closed vocabulary in lib/extension/telemetry.ts: an event name and
  two enum/boolean props. Never the observation, never the page.

  Failures are swallowed: telemetry losing a data point must never
  cost the player a beat of the actual flow.
*/
import { apiBase } from "./config";

export type TrainFunnelEvent =
  | "capture_training_cta_shown"
  | "capture_training_cta_clicked"
  | "capture_training_upgrade_viewed";

export function sendTelemetry(
  event: TrainFunnelEvent,
  props: { surface?: "saved" | "library" | "intent"; entitled?: boolean } = {},
): void {
  void (async () => {
    try {
      const base = await apiBase();
      await fetch(`${base}/api/extension/telemetry`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, props }),
      });
    } catch {
      // A lost data point, accepted silently.
    }
  })();
}
