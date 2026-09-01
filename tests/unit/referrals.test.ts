import { describe, it, expect } from "vitest";
import {
  PAYOUT_GAP,
  REFERRAL_ATTRIBUTION_MESSAGE,
  REWARD,
  REWARD_LADDER,
  funnel,
  generateReferralCode,
  isPlausibleReferralCode,
  isReferralAttributionReason,
  nextRung,
  normaliseReferralCode,
  referralUrl,
  statsFrom,
  type Referral,
  type ReferralAttributionReason,
  type Reward,
} from "../../lib/data/referral-types";

/*
  The referral programme pays people. Everything that decides *how much* is
  pinned here, along with the two claims the product makes about itself: that a
  conversion is held before it earns, and that the reward is months rather than
  money.
*/

const ref = (status: Referral["status"], id: string = status): Referral => ({
  id,
  status,
  joinedAt: "2026-01-01T00:00:00Z",
  convertedAt: status === "converted" ? "2026-01-04T00:00:00Z" : null,
  tier: status === "converted" ? "pro" : null,
});

const reward = (status: Reward["status"], months = 1, id: string = status): Reward => ({
  id,
  status,
  months,
  earnedAt: "2026-01-18T00:00:00Z",
  appliedAt: status === "applied" ? "2026-01-20T00:00:00Z" : null,
});

describe("referral codes", () => {
  it("avoids characters that are ambiguous spoken or typed", () => {
    for (let i = 0; i < 400; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(6);
      expect(code, code).not.toMatch(/[O0I1]/);
      expect(isPlausibleReferralCode(code)).toBe(true);
    }
  });

  it("accepts a code however someone types it", () => {
    expect(normaliseReferralCode(" mdx7kp ")).toBe("MDX7KP");
    expect(normaliseReferralCode("mdx-7kp")).toBe("MDX7KP");
    expect(isPlausibleReferralCode("mdx7kp")).toBe(true);
  });

  it("rejects anything the generator could not have made, before hitting the database", () => {
    expect(isPlausibleReferralCode("MID0O1")).toBe(false); // banned characters
    expect(isPlausibleReferralCode("MIDO7")).toBe(false); // too short
    expect(isPlausibleReferralCode("MDX7KPX")).toBe(false); // too long
    expect(isPlausibleReferralCode("")).toBe(false);
  });

  it("builds a link that survives a trailing slash on the app url", () => {
    expect(referralUrl("MDX7KP", "https://midoxi.app/")).toBe("https://midoxi.app/join/MDX7KP");
    expect(referralUrl("MDX7KP", "https://midoxi.app")).toBe("https://midoxi.app/join/MDX7KP");
  });
});

describe("the ledger", () => {
  it("counts signups and conversions, not clicks, as referrals", () => {
    const stats = statsFrom([ref("pending"), ref("converted"), ref("pending", "p2")], [], 50);
    expect(stats.visits).toBe(50);
    expect(stats.signups).toBe(3);
    expect(stats.conversions).toBe(1);
  });

  it("excludes reversed referrals from every count", () => {
    const stats = statsFrom([ref("converted"), ref("void")], [], 10);
    expect(stats.signups).toBe(1);
    expect(stats.conversions).toBe(1);
  });

  it("separates months earned from months still unspent", () => {
    const stats = statsFrom([], [reward("applied"), reward("earned"), reward("earned", 1, "e2")], 0);
    expect(stats.monthsEarned).toBe(3);
    expect(stats.monthsAvailable).toBe(2);
  });

  it("reports the funnel as counts, never as rates", () => {
    const steps = funnel(statsFrom([ref("converted")], [], 4));
    expect(steps.map((s) => s.value)).toEqual([4, 1, 1]);
    for (const s of steps) {
      expect(typeof s.value).toBe("number");
      expect(JSON.stringify(s)).not.toMatch(/%|rate/i);
    }
  });

  it("tells someone what the hold period is, in the funnel itself", () => {
    expect(funnel(statsFrom([], [], 0))[2].hint).toContain(String(REWARD.holdDays));
  });
});

describe("the ladder", () => {
  it("always points at a rung above where you are", () => {
    expect(nextRung(0)?.at).toBe(1);
    expect(nextRung(1)?.at).toBe(3);
    expect(nextRung(5)?.at).toBe(6);
  });

  it("runs out rather than inventing a rung", () => {
    expect(nextRung(12)).toBeNull();
    expect(nextRung(500)).toBeNull();
  });

  it("is ordered, so 'next' is always the nearest one", () => {
    const ats = REWARD_LADDER.map((r) => r.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
  });
});

describe("honesty", () => {
  it("holds a conversion long enough for a refund to reverse it", () => {
    expect(REWARD.holdDays).toBeGreaterThanOrEqual(14);
  });

  /*
    This assertion used to be the whole of the joiner's guarantee, and it
    passed for months while `ripen_referral_rewards` minted a reward for the
    referrer and nobody else — the constant was pinned, the delivery was not.
    Migration 0042 pays it as a Stripe credit in the webhook; what can be held
    still here is that the promise and the sentence describing it agree.
  */
  it("rewards the person who joins too, not only the referrer", () => {
    expect(REWARD.monthsForJoiner).toBeGreaterThan(0);
  });

  it("tells the joiner where their month actually arrives", () => {
    const applied = REFERRAL_ATTRIBUTION_MESSAGE.applied;
    expect(applied.tone).toBe("positive");
    expect(applied.text.toLowerCase()).toContain("invoice");
    // Both halves of the deal, in the one sentence they are shown.
    expect(applied.text.toLowerCase()).toContain("free month");
    expect(applied.text.toLowerCase()).toContain("sent you");
  });
});

describe("attribution outcomes", () => {
  it("recognises exactly the reasons the database can return", () => {
    for (const reason of [
      "applied",
      "signed_out",
      "unknown_code",
      "own_code",
      "already_credited",
      "already_subscribed",
      "failed",
    ]) {
      expect(isReferralAttributionReason(reason), reason).toBe(true);
      expect(REFERRAL_ATTRIBUTION_MESSAGE[reason as ReferralAttributionReason]).toBeDefined();
    }
  });

  it("refuses anything else, so a URL cannot put words on the page", () => {
    expect(isReferralAttributionReason("applied; drop table")).toBe(false);
    expect(isReferralAttributionReason("")).toBe(false);
    expect(isReferralAttributionReason(null)).toBe(false);
    expect(isReferralAttributionReason(7)).toBe(false);
  });

  it("says the code applies before the first subscription, not before signup", () => {
    // The seven-day rule is gone; the copy must not resurrect it.
    const text = REFERRAL_ATTRIBUTION_MESSAGE.already_subscribed.text.toLowerCase();
    expect(text).toContain("first subscription");
    for (const m of Object.values(REFERRAL_ATTRIBUTION_MESSAGE)) {
      expect(m.text.toLowerCase(), m.text).not.toContain("new accounts only");
    }
  });

  it("keeps every refusal quiet in tone — only success celebrates", () => {
    for (const [reason, m] of Object.entries(REFERRAL_ATTRIBUTION_MESSAGE)) {
      expect(m.tone, reason).toBe(reason === "applied" ? "positive" : "dim");
    }
  });

  it("states that the reward is months and not money", () => {
    expect(PAYOUT_GAP.describes.toLowerCase()).toContain("not money");
    expect(PAYOUT_GAP.needs.toLowerCase()).toContain("stripe connect");
  });

  it("never describes a rung as anything but product time", () => {
    for (const rung of REWARD_LADDER) {
      expect(`${rung.label} ${rung.detail}`, rung.label).not.toMatch(/\$|cash|payout|commission/i);
    }
  });
});
