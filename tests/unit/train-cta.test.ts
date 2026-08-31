import { describe, expect, it } from "vitest";
import {
  LOCAL_MIN_SAVES,
  TRAIN_CTA_COOLDOWN_MS,
  TRAIN_INTENT_MAX_AGE_MS,
  asPricing,
  asTrainIntent,
  connectForTrainingUrl,
  formatPriceCents,
  membershipUpgradeUrl,
  shouldShowSavedCta,
  trainingHandoffUrl,
} from "@/extension/src/lib/train-cta";

/*
  The extension half of the Capture → Training path. Two promises are
  pinned here: restraint (the automatic offer obeys dismissal and
  meaningful-usage rules) and privacy (no URL this module can produce
  ever carries more than an id and a source enum).
*/

const NOW = Date.parse("2026-08-31T12:00:00.000Z");
const APP = "https://mido11.com";
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("shouldShowSavedCta", () => {
  it("always shows for an entitled connected player — a capability, not an ad", () => {
    expect(
      shouldShowSavedCta({ entitled: true, mode: "connected", savedCount: 1, dismissedAt: new Date(NOW).toISOString(), nowMs: NOW }),
    ).toBe(true);
  });

  it("shows for a connected free player, until dismissed", () => {
    expect(shouldShowSavedCta({ entitled: false, mode: "connected", savedCount: 1, dismissedAt: null, nowMs: NOW })).toBe(true);
    const justDismissed = new Date(NOW - 1000).toISOString();
    expect(shouldShowSavedCta({ entitled: false, mode: "connected", savedCount: 1, dismissedAt: justDismissed, nowMs: NOW })).toBe(false);
  });

  it("returns after the cooldown, not after every capture", () => {
    const within = new Date(NOW - TRAIN_CTA_COOLDOWN_MS + 60_000).toISOString();
    const past = new Date(NOW - TRAIN_CTA_COOLDOWN_MS - 60_000).toISOString();
    expect(shouldShowSavedCta({ entitled: false, mode: "connected", savedCount: 3, dismissedAt: within, nowMs: NOW })).toBe(false);
    expect(shouldShowSavedCta({ entitled: false, mode: "connected", savedCount: 3, dismissedAt: past, nowMs: NOW })).toBe(true);
  });

  it("lets Free Mode's first save stay a clean win", () => {
    expect(shouldShowSavedCta({ entitled: false, mode: "local", savedCount: 1, dismissedAt: null, nowMs: NOW })).toBe(false);
    expect(shouldShowSavedCta({ entitled: false, mode: "local", savedCount: LOCAL_MIN_SAVES, dismissedAt: null, nowMs: NOW })).toBe(true);
  });

  it("treats an unparseable dismissal as no dismissal", () => {
    expect(shouldShowSavedCta({ entitled: false, mode: "connected", savedCount: 1, dismissedAt: "garbage", nowMs: NOW })).toBe(true);
  });
});

describe("handoff and upgrade URLs — id and enum only, never content", () => {
  it("builds the Training handoff from the capture id alone", () => {
    expect(trainingHandoffUrl(APP, ID)).toBe(
      `https://mido11.com/app/training?focus=capture%3A${ID}&src=extension`,
    );
  });

  it("builds the upgrade URL with and without a capture breadcrumb", () => {
    expect(membershipUpgradeUrl(APP, ID)).toBe(
      `https://mido11.com/app/membership?src=capture_training&capture=${ID}`,
    );
    expect(membershipUpgradeUrl(APP)).toBe("https://mido11.com/app/membership?src=capture_training");
    expect(membershipUpgradeUrl(APP, null)).toBe("https://mido11.com/app/membership?src=capture_training");
  });

  it("routes Free Mode through login to the same upgrade page", () => {
    expect(connectForTrainingUrl(APP)).toBe(
      "https://mido11.com/login?next=%2Fapp%2Fmembership%3Fsrc%3Dcapture_training",
    );
  });
});

describe("the handoff intent — a local promise, locally kept", () => {
  const fresh = { localId: ID, savedAt: new Date(NOW - 3600_000).toISOString() };

  it("accepts a fresh, well-formed intent", () => {
    expect(asTrainIntent(fresh, NOW)).toEqual(fresh);
  });

  it("expires — an old ask is not resurrected weeks later", () => {
    const old = { localId: ID, savedAt: new Date(NOW - TRAIN_INTENT_MAX_AGE_MS - 1000).toISOString() };
    expect(asTrainIntent(old, NOW)).toBeNull();
    const justInside = { localId: ID, savedAt: new Date(NOW - TRAIN_INTENT_MAX_AGE_MS + 60_000).toISOString() };
    expect(asTrainIntent(justInside, NOW)).not.toBeNull();
  });

  it("refuses junk: bad shapes, oversized ids, unparseable or far-future dates", () => {
    expect(asTrainIntent(null, NOW)).toBeNull();
    expect(asTrainIntent("cap-1", NOW)).toBeNull();
    expect(asTrainIntent({ localId: "", savedAt: fresh.savedAt }, NOW)).toBeNull();
    expect(asTrainIntent({ localId: "x".repeat(65), savedAt: fresh.savedAt }, NOW)).toBeNull();
    expect(asTrainIntent({ localId: ID, savedAt: "yesterday-ish" }, NOW)).toBeNull();
    expect(asTrainIntent({ localId: ID, savedAt: new Date(NOW + 3600_000).toISOString() }, NOW)).toBeNull();
  });

  it("carries only the local id — never lesson content", () => {
    const smuggled = { localId: ID, savedAt: fresh.savedAt, observation: "his scanning note" };
    expect(asTrainIntent(smuggled, NOW)).toEqual({ localId: ID, savedAt: fresh.savedAt });
  });
});

describe("pricing display", () => {
  it("formats cents like the app does", () => {
    expect(formatPriceCents(999)).toBe("$9.99");
    expect(formatPriceCents(8900)).toBe("$89");
    expect(formatPriceCents(0)).toBe("");
    expect(formatPriceCents(Number.NaN)).toBe("");
  });

  it("accepts only a sane pricing block from the network", () => {
    expect(asPricing({ monthlyCents: 999, annualCents: 8900 })).toEqual({ monthlyCents: 999, annualCents: 8900 });
    expect(asPricing({ monthlyCents: "999", annualCents: 8900 })).toBeNull();
    expect(asPricing({ monthlyCents: -5, annualCents: 8900 })).toBeNull();
    expect(asPricing(null)).toBeNull();
    expect(asPricing(undefined)).toBeNull();
  });
});
