import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { track } from "@/lib/analytics/track";
import { extensionJson, preflight, readJsonBody, refuseBadOrigin } from "@/lib/extension/api";
import {
  sanitizeExtensionTelemetry,
  TELEMETRY_MAX_BYTES,
} from "@/lib/extension/telemetry";

export const dynamic = "force-dynamic";

/*
  The Capture → Training funnel's extension-side legs (CTA shown /
  clicked / upgrade viewed), which only the popup can observe.

  Same auth model as every extension route: cookie session, Origin
  allowlist, no token. A Free Mode popup never calls this — the
  extension only sends telemetry in connected mode, and this route
  additionally refuses unauthenticated senders — so "free mode phones
  home for nothing" (docs/extension/METRICS.md) still holds. The body
  is sanitized against a closed vocabulary: behaviour enums only,
  never observation text.
*/

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const refused = refuseBadOrigin(request);
  if (refused) return refused;

  const body = await readJsonBody(request, TELEMETRY_MAX_BYTES);
  const telemetry = sanitizeExtensionTelemetry(body);
  if (!telemetry) {
    return extensionJson(request, { ok: false, error: "Not a recognised event." }, 422);
  }

  // Demo sessions render the flows but learn nothing from themselves;
  // track() would no-op anyway, so answer honestly and cheaply here.
  if (isDemoMode) return extensionJson(request, { ok: true });

  const supabase = await createClient();
  if (!supabase) {
    return extensionJson(request, { ok: false, error: "Service unavailable." }, 503);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return extensionJson(request, { ok: false }, 401);

  await track(telemetry.event, telemetry.props);
  return extensionJson(request, { ok: true });
}
