/*
  Does a confirmation email's link actually land on production?

  This exists because the failure is silent. When `redirect_to` is not in the
  project's allow-list, Supabase does **not** error — it quietly substitutes the
  project's Site URL and sends the email anyway. Signup appears to work; the
  visitor just lands somewhere that is not your app.

  `generate_link` returns the exact URL Supabase would send, without sending
  anything, so reading it back is the only reliable check. It also tells you the
  Site URL for free: whatever gets substituted IS the Site URL.

  Probe users are created by generate_link and deleted again here.

  Usage: node scripts/verify-redirect.mjs [https://your-app.example]
*/
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const l of raw.split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.argv[2] || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const H = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };

console.log(`project : ${url}`);
console.log(`expect  : ${APP}\n`);

// Every redirect the app actually asks for.
const WANTED = [
  ["signup confirmation", `${APP}/auth/callback?next=/onboarding`],
  ["oauth callback", `${APP}/auth/callback`],
  ["password reset", `${APP}/reset-password`],
];

let bad = 0;
let siteUrl = null;

for (const [label, want] of WANTED) {
  const email = `redirect-probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ type: "signup", email, password: "Probe!12345678", redirect_to: want }),
  });
  const j = await res.json();
  if (!res.ok) {
    console.log(`  ?  ${label} — could not probe (${res.status})`);
    continue;
  }
  const got = new URL(j.properties?.action_link ?? j.action_link).searchParams.get("redirect_to");
  if (got === want) {
    console.log(`  ok     ${label}`);
  } else {
    bad++;
    siteUrl = got;
    console.log(`  WRONG  ${label}\n           asked for ${want}\n           got       ${got}`);
  }
  /*
    Clean up the probe account. `generate_link` does not always return the user
    object — when it does not, this used to leak an account into the auth table
    silently, and seventeen of them accumulated before anyone noticed. Look the
    address up rather than trusting the response, and say so if it fails.
  */
  let probeId = j.user?.id;
  if (!probeId) {
    const found = await fetch(
      `${url}/auth/v1/admin/users?per_page=200`,
      { headers: { apikey: key, authorization: `Bearer ${key}` } },
    );
    const { users = [] } = await found.json();
    probeId = users.find((u) => u.email === email)?.id;
  }
  if (probeId) {
    const del = await fetch(`${url}/auth/v1/admin/users/${probeId}`, {
      method: "DELETE",
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!del.ok) console.log(`  !  could not remove probe account ${email}`);
  } else {
    console.log(`  !  probe account ${email} could not be found to remove`);
  }
}

if (bad === 0) {
  console.log("\nEvery auth link resolves to the app. Signup email confirmation will land correctly.");
} else {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
  console.log(`\n${bad} link type(s) not allow-listed.`);
  if (siteUrl) console.log(`The substituted value is the project's Site URL, so Site URL is currently: ${siteUrl}`);
  console.log(`\nFix at: https://supabase.com/dashboard/project/${ref}/auth/url-configuration`);
  console.log(`  Site URL       ${APP}`);
  console.log(`  Redirect URLs  ${APP}/**`);
}
process.exit(bad === 0 ? 0 : 1);
