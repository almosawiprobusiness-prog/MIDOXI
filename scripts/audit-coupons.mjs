#!/usr/bin/env node
/*
  Audit every coupon and promotion code in Stripe.

  Read-only — it makes no writes of any kind, so it is safe against live.

  The thing it is really checking: whether a discount applies to products you
  did not intend. `applies_to` is set once at creation and cannot be edited
  afterwards, so a coupon scoped to "every product" is a permanent discount on
  Club as well — $149 → $74.50 for as long as that customer stays.

      STRIPE_SECRET_KEY=sk_live_... node scripts/audit-coupons.mjs
*/

const KEY = process.env.STRIPE_SECRET_KEY;
/** What a discount is expected to cover. Anything wider is flagged. */
const EXPECTED = ["MIDO XI Player", "MIDO XI Touchline"];

if (!KEY) {
  console.error("STRIPE_SECRET_KEY is not set.\n");
  console.error("  STRIPE_SECRET_KEY=sk_live_... node scripts/audit-coupons.mjs");
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error(`That does not look like a Stripe secret key (starts "${KEY.slice(0, 3)}").`);
  process.exit(1);
}

const api = async (path) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { authorization: `Bearer ${KEY}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${path}: ${j.error?.message ?? res.status}`);
  return j;
};

console.log(`mode: ${KEY.includes("_live_") ? "LIVE" : "TEST"}\n`);

const products = await api("products?active=true&limit=100");
const nameOf = (id) => products.data.find((p) => p.id === id)?.name ?? id;
const expectedIds = EXPECTED.map((n) => products.data.find((p) => p.name === n)?.id).filter(Boolean);

const coupons = await api("coupons?limit=100");
if (!coupons.data.length) {
  console.log("No coupons exist in this environment.");
  process.exit(0);
}

const promos = await api("promotion_codes?limit=100");
let problems = 0;

for (const c of coupons.data) {
  const scoped = c.applies_to?.products ?? null;
  const codes = promos.data.filter((p) => p.coupon?.id === c.id).map((p) => p.code);

  console.log(`coupon  ${c.id}${c.name ? `  "${c.name}"` : ""}`);
  console.log(`  discount   ${c.percent_off ? `${c.percent_off}% off` : `${(c.amount_off ?? 0) / 100} off`}, ${c.duration}`);
  console.log(`  redeemed   ${c.times_redeemed ?? 0}${c.max_redemptions ? ` of ${c.max_redemptions}` : " (uncapped)"}`);
  console.log(`  codes      ${codes.length ? codes.join(", ") : "(none — cannot be entered at checkout)"}`);

  if (!scoped) {
    problems++;
    console.log(`  applies to EVERY PRODUCT  ⚠`);
    console.log(`             including Club — ${c.percent_off ?? "?"}% off $149, ${c.duration}`);
  } else {
    console.log(`  applies to ${scoped.map(nameOf).join(", ")}`);
    const extra = scoped.filter((id) => !expectedIds.includes(id));
    const missing = expectedIds.filter((id) => !scoped.includes(id));
    if (extra.length) {
      problems++;
      console.log(`             ⚠ also covers ${extra.map(nameOf).join(", ")}`);
    }
    if (missing.length) {
      console.log(`             note: does not cover ${missing.map(nameOf).join(", ")}`);
    }
  }

  if (c.max_redemptions == null) {
    problems++;
    console.log(`  ⚠ no redemption cap — this is not a "first 100" offer`);
  }
  console.log();
}

if (problems === 0) {
  console.log("Every coupon is scoped as intended.");
} else {
  console.log(`${problems} thing(s) to look at above.`);
  console.log("\n`applies_to` cannot be edited after creation. To change a coupon's scope,");
  console.log("delete it and create a new one — anyone who already redeemed keeps the old terms.");
  console.log("`npm run founding50` creates it correctly scoped.");
}
