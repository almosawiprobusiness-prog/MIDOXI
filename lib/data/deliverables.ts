import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { currentOrgId } from "./club";
import { deliverableStore } from "./deliverable-store";
import {
  canClientSee,
  canTransition,
  type Deliverable,
  type DeliverableInput,
  type DeliverableStatus,
} from "./deliverable-types";

/*
  Managed deliverables — data access.

  One branch on isDemoMode per function, identical shapes both sides, and
  everything hangs off the caller's organization exactly as `club.ts` does — so
  one client's queue can never be read by another.

  THE GATE IS ENFORCED IN THREE PLACES, ON PURPOSE.

    1. `deliverable-types.ts`   the state machine says which moves exist
    2. here                     `moveDeliverable` refuses an illegal move
       and `listForClient` filters on `canClientSee`
    3. the database             a CHECK constraint on status, and RLS

  That is deliberate duplication. A gate that lives only in a component is a
  suggestion; the reason to write it three times is that the two outer layers
  are the ones a future caller can forget.
*/

function rowToDeliverable(r: Record<string, unknown>): Deliverable {
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    title: String(r.title ?? ""),
    kind: (r.kind as Deliverable["kind"]) ?? "report",
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    status: (r.status as DeliverableStatus) ?? "draft",
    reviewNote: String(r.review_note ?? ""),
    aiDrafted: Boolean(r.ai_drafted),
    createdAt: String(r.created_at),
    submittedAt: (r.submitted_at as string | null) ?? null,
    reviewedAt: (r.reviewed_at as string | null) ?? null,
    deliveredAt: (r.delivered_at as string | null) ?? null,
  };
}

/** Everything in the queue, newest first. The operator's view. */
export async function listDeliverables(): Promise<Deliverable[]> {
  if (isDemoMode) return deliverableStore.list();

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return [];

  const { data } = await supabase
    .from("client_deliverables")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToDeliverable);
}

/**
 * What the client is allowed to see.
 *
 * The single function anything client-facing should call. It filters on
 * `canClientSee` rather than on a literal so the rule stays in one place —
 * and it is a separate function from `listDeliverables` precisely so that
 * reaching for the wrong one is a visible choice in a diff.
 */
export async function listForClient(): Promise<Deliverable[]> {
  const all = await listDeliverables();
  return all.filter((d) => canClientSee(d.status));
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  if (isDemoMode) return deliverableStore.get(id);

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return null;

  const { data } = await supabase
    .from("client_deliverables")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ? rowToDeliverable(data as Record<string, unknown>) : null;
}

export async function createDeliverable(input: DeliverableInput): Promise<string | null> {
  const title = input.title.trim();
  if (!title) return null;

  if (isDemoMode) return deliverableStore.create({ ...input, title });

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return null;

  const { data } = await supabase
    .from("client_deliverables")
    .insert({
      org_id: orgId,
      title,
      kind: input.kind,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      ai_drafted: input.aiDrafted ?? false,
      // `status` is left to the column default. Nothing may be created
      // already-approved, which would be a way in around the reviewer.
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Move a deliverable through the gate.
 *
 * Reads the current status first and checks the move against the state
 * machine, rather than writing whatever was asked for. The read costs a
 * round trip and buys the guarantee that "deliver" cannot skip "approve" —
 * which is the entire point of the feature.
 */
export async function moveDeliverable(
  id: string,
  to: DeliverableStatus,
  note?: string,
): Promise<boolean> {
  if (isDemoMode) return deliverableStore.move(id, to, note);

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return false;

  const current = await getDeliverable(id);
  if (!current || !canTransition(current.status, to)) return false;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to };
  if (to === "in_review") {
    patch.submitted_at = now;
    patch.review_note = "";
  }
  if (to === "approved" || to === "changes_requested") patch.reviewed_at = now;
  if (to === "changes_requested") patch.review_note = note?.trim() ?? "";
  if (to === "delivered") patch.delivered_at = now;

  const { error } = await supabase
    .from("client_deliverables")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId);
  return !error;
}
