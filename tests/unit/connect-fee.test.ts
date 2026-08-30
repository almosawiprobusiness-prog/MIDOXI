import { describe, it, expect } from "vitest";
import {
  connectFeeBps,
  applicationFeeCents,
  processingEstimateCents,
  totalApplicationFeeCents,
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

describe("totalApplicationFeeCents — the margin-preserving fee Stripe actually charges", () => {
  it("is the platform tier PLUS the processing pass-through", () => {
    // $300, up to 5 athletes: 2% ($6.00) + 2.9%+30¢ ($9.00) = $15.00
    expect(totalApplicationFeeCents(30000, 0)).toBe(1500);
    // $300 at 16+: 1% ($3.00) + $9.00 = $12.00
    expect(totalApplicationFeeCents(30000, 16)).toBe(1200);
    // $60 session at 2%: $1.20 + ($1.74 + $0.30) = $3.24
    expect(totalApplicationFeeCents(6000, 0)).toBe(324);
  });

  it("keeps the platform's margin non-negative — the fee never sits below processing", () => {
    for (const [amount, athletes] of [
      [30000, 0],
      [6000, 16],
      [100, 5],
    ] as const) {
      const total = totalApplicationFeeCents(amount, athletes);
      const processing = processingEstimateCents(amount);
      const platformNet = total - processing;
      // Either the full margin survives, or the amount is so small the
      // never-eat-the-whole-charge cap bites — never a hidden subsidy
      // beyond that cap.
      expect(platformNet).toBeGreaterThanOrEqual(
        Math.min(applicationFeeCents(amount, athletes), amount - 1 - processing),
      );
    }
  });

  it("never charges the whole amount, even when processing would exceed it", () => {
    expect(totalApplicationFeeCents(100, 0)).toBeLessThan(100);
    expect(totalApplicationFeeCents(0, 0)).toBe(0);
  });
});

describe("processingEstimateCents", () => {
  it("estimates the standard card rate", () => {
    expect(processingEstimateCents(30000)).toBe(900); // 2.9% + 30¢ on $300
    expect(processingEstimateCents(10000)).toBe(320);
    expect(processingEstimateCents(0)).toBe(0);
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
