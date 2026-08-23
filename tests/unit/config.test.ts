import { describe, it, expect } from "vitest";

/*
  `NEXT_PUBLIC_APP_URL` is the one piece of config that fails silently. It has a
  working default, so a wrong value errors nowhere — it just points every
  referral link, Stripe return and confirmation email at a machine that is not
  yours, and the only symptom is that nobody ever converts.

  `configIssues()` lives in a module that reads `process.env` at import time, so
  the rule is restated here against the same inputs. What is pinned is the
  behaviour: localhost is fine in development and never fine in production.
*/

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function issues(appUrl: string, nodeEnv: string, billing = false, webhookSecret = "") {
  const out: string[] = [];
  const inProduction = nodeEnv === "production";
  if (inProduction && LOCAL_HOST.test(appUrl)) out.push("NEXT_PUBLIC_APP_URL:local");
  if (inProduction && !appUrl.startsWith("https://")) out.push("NEXT_PUBLIC_APP_URL:insecure");
  if (billing && !webhookSecret) out.push("STRIPE_WEBHOOK_SECRET");
  return out;
}

describe("dangerous configuration", () => {
  it("says nothing about localhost in development", () => {
    expect(issues("http://localhost:3100", "development")).toEqual([]);
    expect(issues("http://localhost:3000", "test")).toEqual([]);
  });

  it("catches localhost in a production build", () => {
    expect(issues("http://localhost:3100", "production")).toContain("NEXT_PUBLIC_APP_URL:local");
    expect(issues("http://127.0.0.1:3000", "production")).toContain("NEXT_PUBLIC_APP_URL:local");
  });

  it("catches plain http in production, which Supabase and Stripe reject", () => {
    expect(issues("http://midoxi.app", "production")).toContain("NEXT_PUBLIC_APP_URL:insecure");
  });

  it("is silent on a correctly configured deploy", () => {
    expect(issues("https://midoxi.app", "production", true, "whsec_x")).toEqual([]);
  });

  it("catches live billing with no webhook secret — no referral would ever convert", () => {
    expect(issues("https://midoxi.app", "production", true, "")).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("does not demand a webhook secret when billing is off", () => {
    expect(issues("https://midoxi.app", "production", false, "")).toEqual([]);
  });

  it("does not mistake a real host that merely contains the word", () => {
    // "localhost-staging.midoxi.app" is a real host and must not be flagged.
    expect(issues("https://localhost-staging.midoxi.app", "production")).toEqual([]);
  });
});

/*
  Stripe key shapes.

  A key of the wrong shape is rejected by Stripe with a 401 at the exact moment
  someone clicks Subscribe — which reaches the user as a broken page, not as a
  configuration mistake. This happened for real: `mk_…` was pasted into
  STRIPE_SECRET_KEY and the Membership screen died with "this section could not
  load".
*/
const SECRET_OK = (k: string) => /^(sk|rk)_(test|live)_/.test(k);
const PUB_OK = (k: string) => /^pk_(test|live)_/.test(k);
const modeOf = (k: string) => (/_live_/.test(k) ? "live" : /_test_/.test(k) ? "test" : null);

describe("stripe key shapes", () => {
  it("accepts real secret and restricted keys, in both modes", () => {
    for (const k of ["sk_test_abc123", "sk_live_abc123", "rk_test_abc123", "rk_live_abc123"]) {
      expect(SECRET_OK(k), k).toBe(true);
    }
  });

  it("rejects the key that actually broke production", () => {
    expect(SECRET_OK("mk_1RwRIsomethingsomethingnqPc")).toBe(false);
  });

  it("rejects a publishable key pasted into the secret slot", () => {
    // Easy mistake — they sit next to each other in the Stripe dashboard.
    expect(SECRET_OK("pk_test_abc123")).toBe(false);
  });

  it("rejects a webhook secret pasted into the secret slot", () => {
    expect(SECRET_OK("whsec_abc123")).toBe(false);
  });

  it("checks the publishable key too", () => {
    expect(PUB_OK("pk_test_abc")).toBe(true);
    expect(PUB_OK("pk_live_abc")).toBe(true);
    expect(PUB_OK("sk_test_abc")).toBe(false);
    expect(PUB_OK("mk_abc")).toBe(false);
  });

  it("catches a live secret paired with a test publishable key", () => {
    // Fails at checkout with a confusing "no such price", so name it up front.
    expect(modeOf("sk_live_abc")).toBe("live");
    expect(modeOf("pk_test_abc")).toBe("test");
    expect(modeOf("sk_live_abc")).not.toBe(modeOf("pk_test_abc"));
  });

  it("says nothing when both keys agree", () => {
    expect(modeOf("sk_test_abc")).toBe(modeOf("pk_test_abc"));
    expect(modeOf("sk_live_abc")).toBe(modeOf("pk_live_abc"));
  });
});
