import { describe, it, expect } from "vitest";
import {
  INK,
  MIDO_BRAND,
  MIN_CONTRAST,
  attribution,
  contrast,
  hexIssue,
  luminance,
  normalizeHex,
  readableOn,
  toBrand,
} from "../../lib/brand/identity";
import {
  DELIVERABLE_STATUSES,
  canClientSee,
  canTransition,
  isAwaitingSend,
  needsAttention,
  nextStates,
  transitionIssue,
  type DeliverableStatus,
} from "../../lib/data/deliverable-types";

/*
  The two halves of the Managed promise: work goes out looking like the
  client's, and nothing goes out unread.

  Both are enforced in more than one layer, so these tests are aimed at the
  pure definitions the other layers read — if the state machine here is wrong,
  the database constraint and the server action are wrong in the same way.
*/

describe("the review gate", () => {
  /*
    THE RULE THE TIER RESTS ON. Managed is sold as work a person checked. If
    anything can reach a client without passing through `approved`, the tier is
    selling unreviewed model output at ten times the self-serve price.
  */
  it("has no path to the client that skips a human", () => {
    for (const from of DELIVERABLE_STATUSES) {
      if (from === "approved") continue;
      expect(canTransition(from, "delivered"), `${from} → delivered`).toBe(false);
    }
    expect(canTransition("approved", "delivered")).toBe(true);
  });

  it("shows the client delivered work and nothing else", () => {
    for (const s of DELIVERABLE_STATUSES) {
      expect(canClientSee(s), s).toBe(s === "delivered");
    }
  });

  /*
    A document in someone's hands cannot be quietly rewritten under the same
    identity — the honest correction is a new deliverable that supersedes it.
  */
  it("makes delivery terminal", () => {
    expect(nextStates("delivered")).toEqual([]);
    for (const to of DELIVERABLE_STATUSES) {
      if (to === "delivered") continue;
      expect(canTransition("delivered", to), `delivered → ${to}`).toBe(false);
    }
  });

  it("can always be sent back, right up to the moment it is sent", () => {
    // Approving is not a commitment — a second look must still be able to stop it.
    expect(canTransition("approved", "changes_requested")).toBe(true);
    expect(canTransition("in_review", "changes_requested")).toBe(true);
  });

  it("lets a returned draft go round again", () => {
    expect(canTransition("changes_requested", "in_review")).toBe(true);
  });

  it("explains a refusal in words the operator can act on", () => {
    expect(transitionIssue("draft", "delivered")).toMatch(/approved by a person/i);
    expect(transitionIssue("delivered", "draft")).toMatch(/supersede/i);
    expect(transitionIssue("approved", "delivered")).toBeNull();
    // A no-op is not an error.
    expect(transitionIssue("draft", "draft")).toBeNull();
  });

  it("counts the right things as waiting on a person", () => {
    expect(needsAttention("in_review")).toBe(true);
    expect(needsAttention("changes_requested")).toBe(true);
    // Approved still needs sending — it is not finished.
    expect(needsAttention("approved")).toBe(true);
    expect(isAwaitingSend("approved")).toBe(true);
    expect(needsAttention("delivered")).toBe(false);
    // A draft is the operator's own work in progress, not a queue item.
    expect(needsAttention("draft")).toBe(false);
  });

  it("never strands a deliverable with nowhere to go", () => {
    for (const s of DELIVERABLE_STATUSES) {
      if (s === "delivered") continue;
      expect(nextStates(s).length, s).toBeGreaterThan(0);
    }
  });

  it("only ever names real statuses", () => {
    for (const s of DELIVERABLE_STATUSES) {
      for (const to of nextStates(s)) {
        expect(DELIVERABLE_STATUSES, `${s} → ${to}`).toContain(to);
      }
    }
  });

  /* Every status is reachable from draft, or it is dead code in the UI. */
  it("can reach every state from a draft", () => {
    const seen = new Set<DeliverableStatus>(["draft"]);
    const queue: DeliverableStatus[] = ["draft"];
    while (queue.length) {
      for (const next of nextStates(queue.shift()!)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...DELIVERABLE_STATUSES].sort());
  });
});

describe("the client's identity", () => {
  it("reads the hex a person actually types", () => {
    expect(normalizeHex("#1B3A6B")).toBe("#1b3a6b");
    expect(normalizeHex("1b3a6b")).toBe("#1b3a6b");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("  #ABC  ")).toBe("#aabbcc");
    expect(normalizeHex("navy")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });

  it("says nothing about an empty field, and something about a wrong one", () => {
    expect(hexIssue("")).toBeNull();
    expect(hexIssue("#1b3a6b")).toBeNull();
    expect(hexIssue("navy")).toMatch(/hex/i);
  });

  it("computes contrast the way the accessibility rule does", () => {
    // Black on white is the maximum, 21:1.
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#ffffff")).toBeCloseTo(1, 3);
    expect(luminance("#000000")).toBeCloseTo(0, 3);
  });

  /*
    THE PROBLEM THE MODULE EXISTS FOR. Plenty of real club colours are
    unreadable on the product's ink. Rejecting them tells a club its identity
    is invalid; using them raw ships a document nobody can read.
  */
  it("lifts a colour that cannot be read, and only as far as it must", () => {
    const navy = "#1b3a6b";
    expect(contrast(navy, INK)).toBeLessThan(MIN_CONTRAST);

    const lifted = readableOn(navy);
    expect(contrast(lifted, INK)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    // Still recognisably navy — blue is still the dominant channel.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(lifted.slice(i, i + 2), 16));
    expect(b, lifted).toBeGreaterThan(r);
    expect(b, lifted).toBeGreaterThan(g);
    // And it did not give up and go white.
    expect(lifted).not.toBe("#ffffff");
  });

  it("leaves a colour that is already readable completely alone", () => {
    const bright = "#57d996";
    expect(contrast(bright, INK)).toBeGreaterThan(MIN_CONTRAST);
    expect(readableOn(bright)).toBe(bright);
  });

  it("makes every club colour readable, however dark", () => {
    for (const hex of ["#000000", "#1b3a6b", "#0f5132", "#4a0e0e", "#2d1b4e"]) {
      expect(contrast(readableOn(hex), INK), hex).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("falls back to MIDO rather than rendering a half-brand", () => {
    expect(toBrand(null).isDefault).toBe(true);
    expect(toBrand({ name: "  " }).isDefault).toBe(true);
    expect(toBrand(null)).toEqual(MIDO_BRAND);
    // MIDO's own accent has to survive its own rule.
    expect(contrast(MIDO_BRAND.primaryReadable, INK)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it("keeps an unusable colour out of the client's documents", () => {
    // "navy" does not parse; the brand still renders, in MIDO's accent.
    const b = toBrand({ name: "Northgate FC", primary: "navy" });
    expect(b.isDefault).toBe(false);
    expect(b.name).toBe("Northgate FC");
    expect(normalizeHex(b.primary)).toBe(b.primary);
  });

  it("uses the full name when no short name is given", () => {
    expect(toBrand({ name: "Northgate FC" }).shortName).toBe("Northgate FC");
    expect(toBrand({ name: "Northgate FC", shortName: "Northgate" }).shortName).toBe("Northgate");
  });

  /*
    The document looks like the club's, which is what the tier sells. What it
    must never do is let generated work pass as the club's own authorship.
  */
  it("never hides who prepared the document", () => {
    const club = attribution(toBrand({ name: "Northgate FC" }));
    expect(club.title).toBe("Northgate FC");
    expect(club.byline).toMatch(/MIDO XI/);

    const mine = attribution(MIDO_BRAND);
    expect(mine.byline).toMatch(/MIDO XI/);
  });
});
