import { describe, it, expect } from "vitest";
import {
  connectFeeBps,
  applicationFeeCents,
  feePercentLabel,
  nextTierHint,
} from "@/lib/billing/connect-fee";

/*
  The fee schedule is a promise made in the UI and charged by Stripe —
  Option B, stepping DOWN as the roster grows. These tests pin the
  tiers, the rounding, and the never-eat-the-whole-charge guard, so a
  future edit to the schedule breaks loudly here first.
*/

describe("connectFeeBps", () => {
  it("steps down with roster size: 2% → 1.5% → 1%", () => {
    expect(connectFeeBps(0)).toBe(200);
    expect(connectFeeBps(5)).toBe(200);
    expect(connectFeeBps(6)).toBe(150);
    expect(connectFeeBps(15)).toBe(150);
    expect(connectFeeBps(16)).toBe(100);
    expect(connectFeeBps(400)).toBe(100);
  });

  it("treats garbage as an empty roster, never a discount", () => {
    expect(connectFeeBps(-3)).toBe(200);
    expect(connectFeeBps(NaN)).toBe(200);
    expect(connectFeeBps(5.9)).toBe(200);
  });
});

describe("applicationFeeCents", () => {
  it("computes the tier fee, rounded half-up", () => {
    expect(applicationFeeCents(30000, 0)).toBe(600); // $300 at 2%
    expect(applicationFeeCents(30000, 6)).toBe(450); // $300 at 1.5%
    expect(applicationFeeCents(30000, 16)).toBe(300); // $300 at 1%
    expect(applicationFeeCents(101, 0)).toBe(2); // 2.02 rounds to 2
  });

  it("is never the whole charge and never negative", () => {
    expect(applicationFeeCents(1, 0)).toBe(0);
    expect(applicationFeeCents(0, 0)).toBe(0);
    expect(applicationFeeCents(-500, 0)).toBe(0);
  });
});

describe("labels", () => {
  it("renders whole and fractional percents cleanly", () => {
    expect(feePercentLabel(0)).toBe("2%");
    expect(feePercentLabel(6)).toBe("1.5%");
    expect(feePercentLabel(20)).toBe("1%");
  });

  it("tells the trainer what drops the fee, and stops at the floor", () => {
    expect(nextTierHint(4)).toContain("2 more active athletes");
    expect(nextTierHint(4)).toContain("1.5%");
    expect(nextTierHint(15)).toContain("1 more active athlete ");
    expect(nextTierHint(16)).toBeNull();
  });
});
