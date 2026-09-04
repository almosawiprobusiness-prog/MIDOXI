import "server-only";
import { canTransition, type Deliverable, type DeliverableInput, type DeliverableStatus } from "./deliverable-types";

/*
  Demo-mode deliverables, in memory.

  Same contract as the other demo stores: the whole review gate works without
  a database, so the queue can be shown and the state machine exercised without
  an account. Held on globalThis to survive Next's module reloading in dev,
  exactly as `coach-store` and `board-store` do.

  The seed is a queue mid-flight rather than an empty list — one waiting on a
  reviewer, one sent back with a real reason, one already with the client — so
  the surface shows what it is for on first look. Nothing here claims work the
  demo user did not do: every row is attributed to MIDO's drafting.
*/

interface DeliverableDB {
  rows: Deliverable[];
  seq: number;
}

const g = globalThis as unknown as { __midoDeliverableDB?: DeliverableDB };

function iso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

const DEMO_ORG = "org-demo";

function seed(): DeliverableDB {
  return {
    seq: 4,
    rows: [
      {
        id: "dlv-1",
        orgId: DEMO_ORG,
        title: "MD-3 · Defending transitions",
        kind: "session_plan",
        entityType: "session_plan",
        entityId: "pl1",
        status: "in_review",
        reviewNote: "",
        aiDrafted: true,
        createdAt: iso(30),
        submittedAt: iso(6),
        reviewedAt: null,
        deliveredAt: null,
      },
      {
        id: "dlv-2",
        orgId: DEMO_ORG,
        title: "Build-up vs a 4-4-2 press",
        kind: "tactical_board",
        entityType: "tactical_board",
        entityId: "tb1",
        status: "changes_requested",
        reviewNote:
          "The pivot drops too deep — as drawn the centre-backs have nobody between the lines. Redraw with the 6 staying inside the circle.",
        aiDrafted: true,
        createdAt: iso(50),
        submittedAt: iso(28),
        reviewedAt: iso(24),
        deliveredAt: null,
      },
      {
        id: "dlv-3",
        orgId: DEMO_ORG,
        title: "August · squad development",
        kind: "report",
        entityType: null,
        entityId: null,
        status: "delivered",
        reviewNote: "",
        aiDrafted: false,
        createdAt: iso(200),
        submittedAt: iso(180),
        reviewedAt: iso(170),
        deliveredAt: iso(168),
      },
    ],
  };
}

const db: DeliverableDB = (g.__midoDeliverableDB ??= seed());

export const deliverableStore = {
  orgId(): string {
    return DEMO_ORG;
  },

  list(): Deliverable[] {
    return [...db.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get(id: string): Deliverable | null {
    return db.rows.find((r) => r.id === id) ?? null;
  },

  create(input: DeliverableInput): string {
    const id = `dlv-${++db.seq}`;
    db.rows.push({
      id,
      orgId: DEMO_ORG,
      title: input.title,
      kind: input.kind,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      status: "draft",
      reviewNote: "",
      aiDrafted: input.aiDrafted ?? false,
      createdAt: new Date().toISOString(),
      submittedAt: null,
      reviewedAt: null,
      deliveredAt: null,
    });
    return id;
  },

  /*
    The store enforces the state machine too, rather than trusting the caller.
    Demo mode is the surface a reviewer pokes at hardest, and a gate that only
    holds in real mode is not a gate.
  */
  move(id: string, to: DeliverableStatus, note?: string): boolean {
    const row = db.rows.find((r) => r.id === id);
    if (!row || !canTransition(row.status, to)) return false;
    const now = new Date().toISOString();
    row.status = to;
    if (to === "in_review") {
      row.submittedAt = now;
      row.reviewNote = "";
    }
    if (to === "approved" || to === "changes_requested") row.reviewedAt = now;
    if (to === "changes_requested") row.reviewNote = note?.trim() || "";
    if (to === "delivered") row.deliveredAt = now;
    return true;
  },
};
