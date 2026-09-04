/*
  Managed deliverables — the review gate.

  A deliverable is a piece of work MIDO drafted for a paying client: a session
  plan, a tactical board, a report. It is a WRAPPER, not a copy — it points at
  the thing that already exists, the same way `lib/tactics/links.ts` points at
  a board, so the work has one home and cannot drift from its own delivery
  record.

  WHY THE GATE EXISTS. Managed is sold as work we did, in the client's
  colours. If model output reaches a paying club unread, the tier is selling
  a subscription to unreviewed generation at ten times the self-serve price,
  and the first bad session plan is the client's to discover. The gate is not
  overhead on the product — the human judgment it forces is the product.

  It follows that the gate must be a state a document is IN, not a checkbox
  someone remembers. `canClientSee` is the single answer to "may this be
  shown", and everything client-facing is expected to route through it.

  Pure and client-safe: the queue UI, the server actions and the tests all
  read the same state machine.
*/

export type DeliverableStatus =
  /** Being written. Exists, incomplete, nobody has claimed it is done. */
  | "draft"
  /** Submitted. Waiting on a person. */
  | "in_review"
  /** A reviewer read it and sent it back, with a reason. */
  | "changes_requested"
  /** A person read it and put their name to it. Not yet sent. */
  | "approved"
  /** In the client's hands. */
  | "delivered";

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "delivered",
];

export type DeliverableKind = "session_plan" | "tactical_board" | "report" | "analysis";

export interface Deliverable {
  id: string;
  orgId: string;
  title: string;
  kind: DeliverableKind;
  /** What this delivers. Reference, never a copy. */
  entityType: string | null;
  entityId: string | null;
  status: DeliverableStatus;
  /** The reviewer's words when sending it back, kept so the fix is specific. */
  reviewNote: string;
  /** True when MIDO's AI drafted it rather than a person writing it. */
  aiDrafted: boolean;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  deliveredAt: string | null;

  /*
    The client's link. Minted by the same move that sets `delivered`, so
    "delivered" and "the client can actually read it" cannot disagree.
  */
  shareToken: string | null;
  shareExpiresAt: string | null;
  shareRevokedAt: string | null;
}

export interface DeliverableInput {
  title: string;
  kind: DeliverableKind;
  entityType?: string | null;
  entityId?: string | null;
  aiDrafted?: boolean;
}

/*
  THE ONE RULE. A client sees delivered work and nothing else.

  Written as a set rather than `=== "delivered"` so that adding a state later
  is a decision made here, in front of this comment, rather than by a stray
  comparison somewhere in a component.
*/
const VISIBLE_TO_CLIENT: ReadonlySet<DeliverableStatus> = new Set<DeliverableStatus>(["delivered"]);

export function canClientSee(status: DeliverableStatus): boolean {
  return VISIBLE_TO_CLIENT.has(status);
}

/** Approved is not delivered. Someone still has to send it. */
export function isAwaitingSend(status: DeliverableStatus): boolean {
  return status === "approved";
}

/** Everything a person still has to act on, for the queue's count. */
export function needsAttention(status: DeliverableStatus): boolean {
  return status === "in_review" || status === "changes_requested" || status === "approved";
}

/*
  Legal moves.

  Two properties this table is built to guarantee, and both are asserted in
  the tests:

  1. There is NO edge from draft, in_review or changes_requested straight to
     `delivered`. Reaching a client is only possible through `approved`, so
     "send it quickly" cannot become a way around the reviewer.

  2. `delivered` is terminal. A document in the client's hands cannot be
     quietly walked back to draft and rewritten under the same identity —
     if it was wrong, the honest act is a new deliverable that supersedes it.
*/
const TRANSITIONS: Record<DeliverableStatus, DeliverableStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "changes_requested"],
  changes_requested: ["in_review"],
  approved: ["delivered", "changes_requested"],
  delivered: [],
};

export function nextStates(from: DeliverableStatus): DeliverableStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: DeliverableStatus, to: DeliverableStatus): boolean {
  return nextStates(from).includes(to);
}

/** Why a move is refused, in words a person can act on. */
export function transitionIssue(from: DeliverableStatus, to: DeliverableStatus): string | null {
  if (from === to) return null;
  if (from === "delivered") {
    return "This is already with the client. Supersede it with a new version rather than editing it.";
  }
  if (to === "delivered" && from !== "approved") {
    return "It has to be approved by a person before it can go to the client.";
  }
  if (!canTransition(from, to)) return `A deliverable cannot go from ${label(from)} to ${label(to)}.`;
  return null;
}

export function label(status: DeliverableStatus): string {
  if (status === "in_review") return "In review";
  if (status === "changes_requested") return "Changes requested";
  if (status === "draft") return "Draft";
  if (status === "approved") return "Approved";
  return "Delivered";
}

/** What the operator should do next, said as an instruction rather than a noun. */
export function nextAction(status: DeliverableStatus): string {
  if (status === "draft") return "Finish it, then send it for review";
  if (status === "in_review") return "Read it and approve or send it back";
  if (status === "changes_requested") return "Make the changes, then resubmit";
  if (status === "approved") return "Send it to the client";
  return "With the client";
}

export function kindLabel(kind: DeliverableKind): string {
  if (kind === "session_plan") return "Session plan";
  if (kind === "tactical_board") return "Tactical board";
  if (kind === "analysis") return "Analysis";
  return "Report";
}
