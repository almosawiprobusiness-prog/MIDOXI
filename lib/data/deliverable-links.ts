import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { currentOrgId } from "./club";
import { deliverableStore } from "./deliverable-store";
import type { Deliverable } from "./deliverable-types";

/*
  The link a delivered deliverable travels on.

  Everything here follows `lib/reports/shares.ts`, which worked out the rules
  for letting a document leave the building. They are the same rules and this
  file does not get to have opinions of its own about them.

  THE PRIVILEGED READ. A client is not signed in, so `resolveDeliverableLink`
  runs through the service role — it bypasses RLS by necessity, which is
  exactly why it is written to be boring: one lookup by token, no joins on
  caller-supplied values, and it trusts nothing but the token it was given.
*/

/*
  The pure rules live in `deliverable-link-types.ts` — testable without a
  server runtime, and readable by the client component that renders the link.
  Re-exported so a caller has one import site for "the client's link".
*/
export {
  DEFAULT_LINK_DAYS,
  MAX_LINK_DAYS,
  clampLinkDays,
  deliverableUrl,
  linkState,
  type LinkState,
} from "./deliverable-link-types";

import { clampLinkDays, linkState } from "./deliverable-link-types";

export function mintToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * What a reader gets for a token, or null.
 *
 * Null covers absent, expired, revoked and — the one this file adds —
 * not-actually-delivered. The caller renders one page for all of them,
 * because distinguishing them tells a stranger which tokens were once real.
 */
export async function resolveDeliverableLink(
  token: string,
): Promise<{ deliverableId: string; orgId: string } | null> {
  // Cheap shape check before any query. A token is a fixed-width base64url
  // string; anything else is not worth a round trip.
  if (!token || token.length < 20 || token.length > 100) return null;

  if (isDemoMode) {
    const row = deliverableStore.list().find((d) => d.shareToken === token);
    if (!row || row.status !== "delivered") return null;
    return linkState(row) === "live" ? { deliverableId: row.id, orgId: row.orgId } : null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("client_deliverables")
    .select("id, org_id, status, superseded_by, share_expires_at, share_revoked_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!data) return null;

  /*
    Belt and braces against the database's own constraint. 0049 makes a token
    on undelivered work impossible; this refuses to serve it anyway, because
    the cost of being wrong is a client reading unreviewed work.
  */
  if (data.status !== "delivered") return null;

  /*
    Superseded work is not served, even if its link were somehow still live.
    Superseding revokes the link, so this should be unreachable — which is
    exactly why it is here: the cost of the revoke having failed is a client
    reading a version we replaced.
  */
  if (data.superseded_by) return null;
  if (
    linkState({
      shareToken: token,
      shareExpiresAt: (data.share_expires_at as string) ?? null,
      shareRevokedAt: (data.share_revoked_at as string) ?? null,
    }) !== "live"
  ) {
    return null;
  }

  return { deliverableId: String(data.id), orgId: String(data.org_id) };
}

/** The deliverable behind a resolved token, read with the same privilege. */
export async function readDeliverableForClient(id: string): Promise<Deliverable | null> {
  if (isDemoMode) return deliverableStore.get(id);

  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("client_deliverables").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    title: String(r.title ?? ""),
    kind: (r.kind as Deliverable["kind"]) ?? "report",
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    status: (r.status as Deliverable["status"]) ?? "draft",
    reviewNote: String(r.review_note ?? ""),
    aiDrafted: Boolean(r.ai_drafted),
    createdAt: String(r.created_at),
    submittedAt: (r.submitted_at as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    deliveredAt: (r.delivered_at as string | null) ?? null,
    shareToken: (r.share_token as string | null) ?? null,
    shareExpiresAt: (r.share_expires_at as string | null) ?? null,
    shareRevokedAt: (r.share_revoked_at as string | null) ?? null,
    supersededBy: (r.superseded_by as string | null) ?? null,
  };
}

/**
 * Withdraw a link early.
 *
 * The deliverable stays delivered — it *was* sent, and rewriting that would
 * be editing history. Only the reader's access ends.
 */
export async function revokeDeliverableLink(id: string): Promise<boolean> {
  if (isDemoMode) return deliverableStore.revokeLink(id);

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return false;

  const { error } = await supabase
    .from("client_deliverables")
    .update({ share_revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);
  return !error;
}
