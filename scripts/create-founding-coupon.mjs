#!/usr/bin/env node
/*
  Create the FOUNDING50 offer in Stripe.

  Two objects, and the difference matters:

    coupon          the discount itself — 50% off, forever, capped at 100 uses,
                    restricted to the Player and Touchline products
    promotion code  the string a customer types — "FOUNDING50" — pointing at it

  Club is excluded deliberately. 50% off forever on a $149 organisation tier is
  a permanent $74.50 giveaway per club, and a club buying ten seats is a
  conversation rather than an impulse that needs a discount.

  Products are looked up **by name**, not by hardcoded id, because ids differ
  between a sandbox and live mode — the same script has to work in both.

  `allow_promotion_codes: true` is already set on checkout, so the field is
  there waiting.

  Run it yourself so your secret key never leaves your machine:

      STRIPE_SECRET_KEY=sk_test_... node scripts/create-founding-coupon.mjs

  It refuses a live key unless you pass --live, because a 50%-off-forever coupon
  created by accident in live mode is a discount you cannot take back from
  anyone who redeems it.

  Safe to re-run: it looks for an existing coupon and promotion code first.
*/

const KEY = process.env.STRIPE_SECRET_KEY;
const LIVE_OK = process.argv.includes("--live");

const COUPON_ID = "founding50";
/** Products the discount may be used against. Names must match the catalogue. */
const APPLIES_TO = ["MIDO XI Player", "MIDO XI Touchline"];
const PROMO_CODE = "FOUNDING50";
const PERCENT_OFF = 50;
const MAX_REDEMPTIONS = 100;

if (!KEY) {
  console.error("STRIPE_SECRET_KEY is not set.\n");
  console.error("  STRIPE_SECRET_KEY=sk_test_... node scripts/create-founding-coupon.mjs");
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(KEY)) {
  console.error(`That does not look like a Stripe secret key (starts "${KEY.slice(0, 3)}").`);
  console.error("Secret keys start sk_test_ or sk_live_.");
  process.exit(1);
}
const isLive = KEY.startsWith("sk_live_") || KEY.startsWith("rk_live_");
if (isLive && !LIVE_OK) {
  console.error("That is a LIVE key.\n");
  console.error("This creates a 50%-off-forever coupon. Anyone who redeems it keeps that");
  console.error("price for as long as they stay subscribed, and you cannot take it back.");
  console.error("\nIf you mean it: re-run with --live");
  process.exit(1);
}

const api = async (path, body) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${KEY}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error?.message ?? res.status}`);
  return json;
};

console.log(`mode: ${isLive ? "LIVE" : "TEST"}\n`);

// ---- which products it may be used against --------------------------------
/*
  This is the part that actually restricts the discount, and it was missing:
  the script named APPLIES_TO in its documentation and then created the coupon
  without it, which is a coupon that discounts EVERY product — Club included,
  at 50% off $149 forever.

  `applies_to` cannot be changed after creation. So the ids are resolved first
  and the script refuses rather than creating an unrestricted coupon it cannot
  later narrow.
*/
const products = await api("products?active=true&limit=100");
const appliesTo = APPLIES_TO.map((name) => {
  const found = products.data.find((p) => p.name === name);
  if (!found) {
    console.error(`No active product named "${name}" in this environment.`);
    console.error("Products found:", products.data.map((p) => p.name).join(", ") || "(none)");
    console.error("");
    console.error("Refusing to create an unrestricted coupon — `applies_to` cannot be");
    console.error("edited later, so a coupon created without it discounts Club as well.");
    process.exit(1);
  }
  return found.id;
});

// ---- the coupon -----------------------------------------------------------
let coupon;
try {
  coupon = await api(`coupons/${COUPON_ID}`);
  const scoped = coupon.applies_to?.products ?? null;
  console.log(`coupon         already exists (${coupon.percent_off}% off, ${coupon.duration})`);
  if (!scoped) {
    console.log();
    console.log("  ⚠  IT APPLIES TO EVERY PRODUCT, including Club.");
    console.log("     `applies_to` cannot be edited. To fix it: delete this coupon in the");
    console.log("     Stripe dashboard and re-run this script. Anyone who already redeemed");
    console.log("     it keeps the old, unrestricted terms — check `npm run coupons` first.");
  } else {
    const names = scoped.map((id) => products.data.find((p) => p.id === id)?.name ?? id);
    console.log(`               scoped to ${names.join(", ")}`);
  }
} catch {
  coupon = await api("coupons", {
    id: COUPON_ID,
    name: "Founding 100",
    percent_off: String(PERCENT_OFF),
    // `forever` applies to every invoice for as long as the subscription runs.
    duration: "forever",
    max_redemptions: String(MAX_REDEMPTIONS),
    // The restriction. Without these the discount covers the whole catalogue.
    ...Object.fromEntries(appliesTo.map((id, i) => [`applies_to[products][${i}]`, id])),
  });
  console.log(`coupon         created — ${PERCENT_OFF}% off, forever, ${MAX_REDEMPTIONS} max`);
  console.log(`               scoped to ${APPLIES_TO.join(", ")}`);
}

// ---- the customer-facing code ---------------------------------------------
const existing = await api(`promotion_codes?code=${PROMO_CODE}&limit=1`);
let promo = existing.data?.[0];
if (promo) {
  console.log(`promotion code already exists — ${promo.code} (active: ${promo.active})`);
} else {
  promo = await api("promotion_codes", {
    coupon: COUPON_ID,
    code: PROMO_CODE,
    // Founding members are new customers. This stops an existing subscriber
    // applying it to a plan they are already paying full price for.
    "restrictions[first_time_transaction]": "true",
  });
  console.log(`promotion code created — ${promo.code}`);
}

// ---- where it stands ------------------------------------------------------
const fresh = await api(`coupons/${COUPON_ID}`);
const used = fresh.times_redeemed ?? 0;
console.log(`\n${used} of ${fresh.max_redemptions} redeemed · ${fresh.max_redemptions - used} left`);
console.log(`\nCustomers enter ${PROMO_CODE} in the promotion-code field at checkout.`);
console.log("Re-run this any time to see the count.");
