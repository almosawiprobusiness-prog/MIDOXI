#!/usr/bin/env node
/*
  Verify that deleting an account actually removes what the Privacy
  Policy claims it removes — including storage objects, which is the
  part that was missing until this was checked.

  `deleteAccount` is a Next.js server action bound to a request's
  cookies; it cannot be invoked standalone from a script. What is
  provable from here is the STRATEGY it depends on: that every bucket
  this product writes to is either a fixed `<userId>/...` prefix (list
  the folder, remove what's listed) or has its exact path recorded in a
  database row (`videos.storage_path`) that survives long enough to be
  read before the cascade takes it. This probes that strategy directly
  against the real buckets and the real Storage REST API — upload to
  each bucket the same way the app does, confirm the sweep's own
  list/lookup logic finds every object, remove them, and confirm they
  are actually gone.

  Usage: node scripts/verify-account-deletion.mjs
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

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = env();
if (!url || !serviceKey) {
  console.error("Supabase URL and service role key must be set in .env.local.");
  process.exit(1);
}

const svc = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
let pass = 0;
const failures = [];
const ok = (l, d = "") => { pass++; console.log(`  ok       ${l}${d ? `  ${d}` : ""}`); };
const bad = (l, d = "") => { failures.push(`${l}${d ? ` — ${d}` : ""}`); console.log(`  BAD      ${l}${d ? `\n           ${d}` : ""}`); };

const rest = (p, init = {}) => fetch(`${url}/rest/v1/${p}`, { ...init, headers: { ...svc, ...(init.headers ?? {}) } });

async function bucketExists(bucket) {
  const r = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers: svc });
  return r.ok;
}

async function upload(bucket, path, bytes, contentType) {
  return fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { ...svc, "content-type": contentType },
    body: bytes,
  });
}

async function list(bucket, prefix) {
  const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100 }),
  });
  return r.ok ? r.json() : [];
}

async function remove(bucket, paths) {
  return fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}

const made = [];
const uploaded = [];

try {
  const cr = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({
      email: "midoxi-purge-a@example.invalid",
      password: "purge-a-Qv93!ztr",
      email_confirm: true,
    }),
  });
  const user = await cr.json();
  made.push(user.id);
  const uid = user.id;

  console.log("\nwhich buckets exist\n");
  const present = {};
  for (const b of ["avatars", "posts", "videos"]) {
    present[b] = await bucketExists(b);
    present[b] ? ok(`${b} bucket exists`) : console.log(`  n/a      ${b} bucket does not exist on this project — its sweep is untestable here`);
  }

  // -- avatars: fixed <uid>/avatar.webp -------------------------
  if (present.avatars) {
    const path = `${uid}/avatar.webp`;
    const up = await upload("avatars", path, Buffer.from("fake-webp-bytes"), "image/webp");
    if (up.ok) { uploaded.push(["avatars", path]); ok("uploaded a probe avatar", path); }
    else bad("uploaded a probe avatar", (await up.text()).slice(0, 160));
  }

  // -- posts: fixed <uid>/, but can hold several files -----------
  if (present.posts) {
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const up = await upload("posts", path, Buffer.from("fake-jpeg-bytes"), "image/jpeg");
    if (up.ok) { uploaded.push(["posts", path]); ok("uploaded a probe post image", path); }
    else bad("uploaded a probe post image", (await up.text()).slice(0, 160));
  }

  // -- videos: path is whatever the row says, not a fixed prefix -
  let videoPath = null;
  if (present.videos) {
    videoPath = `${uid}/${crypto.randomUUID()}.mp4`;
    const up = await upload("videos", videoPath, Buffer.from("fake-mp4-bytes"), "video/mp4");
    if (up.ok) {
      uploaded.push(["videos", videoPath]);
      const row = await rest("videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: uid, title: "probe", source: "upload", storage_path: videoPath }),
      });
      row.ok ? ok("uploaded a probe video and recorded its row") : bad("recorded the video row", (await row.text()).slice(0, 160));
    } else {
      bad("uploaded a probe video", (await up.text()).slice(0, 160));
    }
  }

  console.log("\nrunning the same sweep deleteAccount runs\n");

  // avatars + posts: list the <uid>/ prefix, remove everything found
  for (const bucket of ["avatars", "posts"]) {
    if (!present[bucket]) continue;
    const files = await list(bucket, uid);
    const paths = files.map((f) => `${uid}/${f.name}`);
    if (paths.length === 0) { bad(`${bucket}: the sweep's own list() found nothing`, "the probe upload should be there"); continue; }
    const del = await remove(bucket, paths);
    del.ok ? ok(`${bucket}: swept ${paths.length} file(s) via list+remove`) : bad(`${bucket} sweep`, (await del.text()).slice(0, 160));
  }

  // videos: the row is the only reliable list of what to remove
  if (present.videos && videoPath) {
    const rows = await rest(`videos?select=storage_path&user_id=eq.${uid}&source=eq.upload&storage_path=not.is.null`);
    const paths = rows.ok ? (await rows.json()).map((r) => r.storage_path) : [];
    if (paths.length === 0) { bad("videos: the row lookup found nothing", "the probe row should be there"); }
    else {
      const del = await remove("videos", paths);
      del.ok ? ok(`videos: swept ${paths.length} file(s) via the recorded storage_path`) : bad("videos sweep", (await del.text()).slice(0, 160));
    }
  }

  console.log("\nconfirming from the other side\n");
  for (const [bucket, path] of uploaded) {
    const r = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { headers: svc });
    r.status === 404 || r.status === 400
      ? ok(`${bucket}/${path} is actually gone`)
      : bad(`${bucket}/${path} is actually gone`, `still fetchable — HTTP ${r.status}`);
  }
} catch (e) {
  bad("probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. The same list-and-remove strategy deleteAccount uses actually empties every bucket it touches.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
