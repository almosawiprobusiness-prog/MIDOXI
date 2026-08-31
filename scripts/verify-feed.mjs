#!/usr/bin/env node
/*
  Verify 0023 — the community feed — from the outside.

  Three things here are worth proving rather than assuming, and each one is a
  bug this codebase has already had in another form:

    · THE GRANT. Every migration since 0011 has at some point revoked from
      PUBLIC while a named role kept its grant, or the reverse. So the anon key
      is pointed at all three new tables and must be refused by every one.

    · THE REVERSE BLOCK. `user_blocks` is deliberately unreadable by the person
      who was blocked — a list of who has blocked you is an invitation to go and
      ask why. That is also exactly why the feed reads the reverse direction
      through the service role instead. If this probe ever starts PASSING where
      it expects a refusal, the RLS policy has loosened and the feed is leaking
      "who blocked me" to the client. So it is checked as an account, not by
      reading the policy text.

    · THE BUCKET. Posts write media to a `posts` bucket. `storage.objects` is
      owned by `supabase_storage_admin`, so this cannot be done in a migration —
      it has to happen through the storage API, which means it is the one part
      of 0023 that no amount of SQL will have created. Missing, and every upload
      fails at the moment a player tries to post. Created here if absent.

  The account probe writes: two obviously-synthetic users, a follow, a block, a
  read, then deletion — and it RE-LISTS afterwards rather than trusting the
  delete's own response. Pass --no-probe to skip it, at the cost of skipping the
  only part that proves anything about blocking.

  Usage: node scripts/verify-feed.mjs [--no-probe]
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
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and");
  console.error("SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.");
  process.exit(1);
}

const PROBE = !process.argv.includes("--no-probe");

let pass = 0;
const failures = [];
const ok = (label, detail = "") => {
  pass++;
  console.log(`  ok       ${label}${detail ? `  ${detail}` : ""}`);
};
const bad = (label, detail = "") => {
  failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`  BAD      ${label}${detail ? `\n           ${detail}` : ""}`);
};

const svc = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
const rest = (path, headers = svc, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

// ── 1 · the shape ────────────────────────────────────────────
console.log("\ncolumns and tables 0023 adds\n");

for (const [table, columns] of [
  // 0003's, which had never actually been run — the community worked in demo
  // mode and nowhere else. Pinned here so that cannot happen quietly again.
  ["community_posts", "id, user_id, author_name, author_handle, author_position, author_avatar, title, body, clip_title, clip_start, clip_tags, clip_sentiment, video_source, video_external_id, tags, created_at"],
  ["post_comments", "id, post_id, user_id, author_name, author_handle, body, created_at"],
  ["post_reactions", "post_id, user_id, created_at"],
  // `handle` is the one the feed cannot work without: it is how
  // /app/community/[handle] resolves a profile.
  ["player_profiles", "user_id, handle, play_style, favorite_players, strengths, achievements, socials"],
  // 0023's own.
  ["community_posts", "id, user_id, caption, media_url, media_kind, media_width, media_height, visibility, created_at"],
  ["follows", "follower_id, following_id, created_at"],
  ["user_blocks", "blocker_id, blocked_id, created_at"],
  ["post_reports", "id, post_id, reporter_id, reason, detail, reviewed_at, created_at"],
  // 0040's — private saves, and posts that know their kind.
  ["post_saves", "post_id, user_id, created_at"],
  ["community_posts", "id, kind"],
]) {
  const res = await rest(`${table}?select=${encodeURIComponent(columns)}&limit=0`);
  if (res.ok) ok(table, `(${columns.split(",").length} columns)`);
  else bad(table, (await res.text()).slice(0, 200));
}

/*
  `title` was NOT NULL and a caption-only post cannot satisfy that. Proven by
  inserting one rather than reading the catalogue: the constraint that matters
  is the one the INSERT hits.
*/
if (PROBE) {
  /*
    Needs a real user id to hang a post off. The obvious source is an existing
    post — and the first version of this stopped there, which meant that on a
    database with no posts yet (that is, every database on the day 0023 lands)
    both checks below quietly did not run and the script still printed a pass.
    That is the failure this whole file exists to catch, reproduced inside the
    file itself. So: fall back to any account, and if there is genuinely no
    account at all, SAY so rather than skipping in silence.
  */
  let uid = null;
  const anyPost = await rest("community_posts?select=user_id&limit=1");
  if (anyPost.ok) uid = (await anyPost.json())[0]?.user_id ?? null;
  if (!uid) {
    const users = await fetch(`${url}/auth/v1/admin/users?per_page=1`, { headers: svc });
    if (users.ok) uid = ((await users.json()).users ?? [])[0]?.id ?? null;
  }
  if (!uid) bad("the post constraints", "no account exists to test with — checks SKIPPED, not passed");

  if (uid) {
    const res = await rest("community_posts", svc, {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ user_id: uid, caption: "verify-feed probe", visibility: "public" }),
    });
    if (res.ok) {
      const [made] = await res.json();
      ok("a post with a caption and no title inserts");
      await rest(`community_posts?id=eq.${made.id}`, svc, { method: "DELETE" });
    } else {
      bad("a post with a caption and no title inserts", (await res.text()).slice(0, 200));
    }

    // And the floor under it: a row that is nothing at all must be refused.
    const empty = await rest("community_posts", svc, {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ user_id: uid, caption: "   " }),
    });
    if (empty.ok) {
      const made = await empty.json();
      bad("an empty post is refused", "it was accepted");
      if (Array.isArray(made) && made[0]?.id)
        await rest(`community_posts?id=eq.${made[0].id}`, svc, { method: "DELETE" });
    } else ok("an empty post is refused", "community_posts_not_empty");
  }
}

// ── 2 · the grant ────────────────────────────────────────────
console.log("\nthe anon key must be refused by all three\n");

/*
  Six, not three. 0003's tables were never granted or revoked at all, so they
  inherited Supabase's default grant to anon and were held back only by RLS
  having no policy that matched an anonymous request — one policy edit away
  from a leak. 0023 closes them at the grant, and this is where that is proven.
*/
const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
for (const table of ["community_posts", "post_comments", "post_reactions", "follows", "user_blocks", "post_reports"]) {
  const res = await rest(`${table}?select=*&limit=1`, anon);
  if (res.ok) {
    const rows = await res.json();
    bad(`anon reads ${table}`, `HTTP 200, ${rows.length} row(s) — the grant is open`);
  } else ok(`anon refused on ${table}`, `HTTP ${res.status}`);
}

// ── 3 · the bucket ───────────────────────────────────────────
console.log("\nthe posts bucket\n");

const buckets = await fetch(`${url}/storage/v1/bucket`, { headers: svc });
const list = buckets.ok ? await buckets.json() : [];
const posts = Array.isArray(list) ? list.find((b) => b.id === "posts" || b.name === "posts") : null;

if (posts) {
  ok("posts bucket exists", posts.public ? "public" : "PRIVATE — feed media will 404");
  if (!posts.public) bad("posts bucket is public", "media_url points straight at it");
} else {
  const made = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({
      id: "posts",
      name: "posts",
      // Public: `media_url` is stored on the row and rendered by <Image>. A
      // signed URL would expire while a post does not.
      public: true,
      file_size_limit: 26_214_400, // 25MB — the video ceiling in feed-types.ts
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"],
    }),
  });
  if (made.ok) ok("posts bucket created", "public, 25MB, photo+video only");
  else bad("posts bucket could not be created", (await made.text()).slice(0, 200));
}

// ── 4 · blocking, as two real accounts ───────────────────────
if (PROBE) {
  console.log("\nblocking, as two accounts\n");

  const made = [];
  const mkUser = async (tag) => {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...svc, "content-type": "application/json" },
      body: JSON.stringify({
        email: `midoxi-feed-${tag}@example.invalid`,
        password: `probe-${tag}-${"x".repeat(12)}`,
        email_confirm: true,
      }),
    });
    if (!res.ok) throw new Error(`${tag}: ${(await res.text()).slice(0, 160)}`);
    const u = await res.json();
    made.push(u.id);
    const tok = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({
        email: `midoxi-feed-${tag}@example.invalid`,
        password: `probe-${tag}-${"x".repeat(12)}`,
      }),
    });
    if (!tok.ok) throw new Error(`${tag} sign-in: ${(await tok.text()).slice(0, 160)}`);
    const { access_token } = await tok.json();
    return { id: u.id, h: { apikey: anonKey, authorization: `Bearer ${access_token}` } };
  };

  try {
    const [a, b] = [await mkUser("a"), await mkUser("b")];

    // A follows B.
    const follow = await rest("follows", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ follower_id: a.id, following_id: b.id }),
    });
    follow.ok
      ? ok("a signed-in account can follow another")
      : bad("a signed-in account can follow another", (await follow.text()).slice(0, 200));

    // B must not be able to follow on A's behalf.
    const forged = await rest("follows", b.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ follower_id: a.id, following_id: b.id }),
    });
    forged.ok
      ? bad("one account cannot follow on another's behalf", "the insert was accepted")
      : ok("one account cannot follow on another's behalf", `HTTP ${forged.status}`);

    // A blocks B.
    const block = await rest("user_blocks", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocker_id: a.id, blocked_id: b.id }),
    });
    block.ok ? ok("an account can block another") : bad("an account can block another", (await block.text()).slice(0, 200));

    // A sees the block. B must not.
    const mine = await rest(`user_blocks?select=blocked_id&blocker_id=eq.${a.id}`, a.h);
    const seen = mine.ok ? await mine.json() : [];
    seen.length === 1 && seen[0].blocked_id === b.id
      ? ok("the blocker reads their own block")
      : bad("the blocker reads their own block", `got ${JSON.stringify(seen).slice(0, 120)}`);

    /*
      The one that justifies the admin client in `blockedEitherWay`. B asking
      "who has blocked me" must come back empty — not because there is no row,
      but because RLS will not show it. Which is why the feed cannot compute
      the reverse direction client-side and reads it server-side instead.
    */
    const reverse = await rest(`user_blocks?select=blocker_id&blocked_id=eq.${b.id}`, b.h);
    const rows = reverse.ok ? await reverse.json() : null;
    rows && rows.length === 0
      ? ok("the blocked account cannot see who blocked it", "so the feed reads it server-side")
      : bad(
          "the blocked account cannot see who blocked it",
          rows ? `it saw ${rows.length} row(s) — RLS has loosened` : `HTTP ${reverse.status}`,
        );

    // Follows are public — that is what makes a follower count possible.
    const counted = await rest(`follows?select=follower_id&following_id=eq.${b.id}`, b.h);
    const cnt = counted.ok ? (await counted.json()).length : -1;
    cnt >= 1 ? ok("follower counts are readable", `${cnt}`) : bad("follower counts are readable", `saw ${cnt}`);
  } catch (e) {
    bad("account probe", String(e.message ?? e).slice(0, 200));
  } finally {
    for (const id of made) {
      await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
    }
    // Re-list rather than trusting the delete's own response.
    const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
    const all = left.ok ? ((await left.json()).users ?? []) : [];
    const stragglers = all.filter((u) => String(u.email ?? "").startsWith("midoxi-feed-"));
    stragglers.length === 0
      ? ok("probe accounts removed")
      : bad("probe accounts removed", `${stragglers.length} left: ${stragglers.map((u) => u.email).join(", ")}`);
  }
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. 0023 is live and blocking holds from both sides.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
