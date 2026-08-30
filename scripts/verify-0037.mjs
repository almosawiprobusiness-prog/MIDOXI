#!/usr/bin/env node
/*
  Verify migration 0037 — trainer Connect tables — from outside.

    1. All three tables exist and are selectable with the service role.
    2. The fee columns' constraints hold: a purchase row with fee_bps
       above the 1000 cap, or a product priced above $5,000, must be
       REJECTED. (Probes insert with the service role against a real
       user id, and anything that lands is deleted and re-checked gone.)
    3. anon reads nothing from any of the three — money tables have no
       anonymous surface at all.

  Usage: node scripts/verify-0037.mjs
*/
import { readFileSync } from "node:fs";

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
} = env();
if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase keys in .env.local.");
  process.exit(1);
}

const service = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const anon = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function req(method, path, headers, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

// 1 — the tables exist.
for (const t of ["trainer_accounts", "trainer_products", "trainer_purchases"]) {
  const r = await req("GET", `${t}?select=*&limit=1`, service);
  check(`${t} exists`, r.status === 200, r.status === 200 ? "" : `${r.status} ${r.text.slice(0, 120)}`);
}

const who = await req("GET", "profiles?select=id&limit=1", service);
const userId = who.json?.[0]?.id;
if (!userId) {
  check("a profile row exists to probe with", false, `${who.status}`);
} else {
  // 2a — overpriced product rejected.
  const badProduct = await req("POST", "trainer_products", service, {
    user_id: userId,
    title: "VERIFY-0037 bad probe",
    amount_cents: 600000,
  });
  check("product above $5,000 rejected", badProduct.status !== 201, `${badProduct.status}`);
  if (badProduct.status === 201 && badProduct.json?.[0]?.id) {
    await req("DELETE", `trainer_products?id=eq.${badProduct.json[0].id}`, service);
  }

  // 2b — fee_bps above the cap rejected.
  const badFee = await req("POST", "trainer_purchases", service, {
    trainer_id: userId,
    amount_cents: 10000,
    fee_cents: 2000,
    fee_bps: 2000,
  });
  check("fee_bps above 1000 rejected", badFee.status !== 201, `${badFee.status}`);
  if (badFee.status === 201 && badFee.json?.[0]?.id) {
    await req("DELETE", `trainer_purchases?id=eq.${badFee.json[0].id}`, service);
  }

  // 2c — a legal purchase row lands, then is removed and confirmed gone.
  const good = await req("POST", "trainer_purchases", service, {
    trainer_id: userId,
    amount_cents: 30000,
    fee_cents: 600,
    fee_bps: 200,
  });
  const goodId = good.json?.[0]?.id;
  check("a legal purchase row (2% of $300) accepted", good.status === 201 && Boolean(goodId), `${good.status}`);
  if (goodId) {
    await req("DELETE", `trainer_purchases?id=eq.${goodId}`, service);
    const still = await req("GET", `trainer_purchases?id=eq.${goodId}&select=id`, service);
    check("probe purchase deleted and confirmed gone", still.status === 200 && still.json?.length === 0);
  }
}

// 3 — anon reads nothing.
for (const t of ["trainer_accounts", "trainer_products", "trainer_purchases"]) {
  const r = await req("GET", `${t}?select=*&limit=1`, anon);
  const blocked = r.status === 401 || r.status === 403 || (r.status === 200 && r.json?.length === 0);
  check(`anon cannot read ${t}`, blocked, `${r.status}`);
}

console.log(`\n${pass} ok, ${fail} failing`);
process.exit(fail ? 1 : 0);
