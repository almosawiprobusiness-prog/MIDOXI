import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { MediaKind, Post, ProfileSummary, Visibility } from "./feed-types";

/*
  Reading the feed.

  The interesting function here is `listFeed`, because it is where blocking and
  visibility stop being columns and start being rules. Everything else is
  ordinary.

  Blocking is applied in BOTH directions. If A blocks B, then A does not see
  B's posts and B does not see A's. A block that only hides one side is not a
  block — it is a mute, and the person who used it thinks they got a block.

  This is deliberately not one clever SQL statement. The feed reads posts, then
  filters them against two small sets the reader already needs anyway. At this
  size that is faster to reason about and impossible to get subtly wrong in a
  join, which matters more than a query plan nobody is measuring.
*/

function rowToPost(r: Record<string, unknown>, me: string | null, liked: Set<string>): Post {
  const mediaUrl = (r.media_url as string) ?? null;
  const kind = (r.media_kind as MediaKind) ?? null;

  return {
    id: String(r.id),
    author: {
      userId: String(r.user_id),
      name: (r.author_name as string) ?? "Player",
      handle: (r.author_handle as string) ?? null,
      position: (r.author_position as string) ?? null,
      avatar: (r.author_avatar as string) ?? null,
    },
    // New posts write `caption`; rows from the forum era have title + body, and
    // both still have to render.
    caption:
      (r.caption as string) ??
      [r.title, r.body].filter(Boolean).join("\n\n") ??
      "",
    media:
      mediaUrl && kind
        ? {
            kind,
            url: mediaUrl,
            width: (r.media_width as number) ?? null,
            height: (r.media_height as number) ?? null,
          }
        : null,
    clip: r.clip_title
      ? {
          title: String(r.clip_title),
          start: Number(r.clip_start ?? 0),
          tags: ((r.clip_tags as string[]) ?? []),
          sentiment: (r.clip_sentiment as string) ?? null,
          videoSource: (r.video_source as string) ?? null,
          videoExternalId: (r.video_external_id as string) ?? null,
        }
      : null,
    tags: ((r.tags as string[]) ?? []),
    visibility: ((r.visibility as Visibility) ?? "public"),
    createdAt: String(r.created_at),
    likes: Number((r.reaction_count as number) ?? 0),
    comments: Number((r.comment_count as number) ?? 0),
    likedByMe: liked.has(String(r.id)),
    mine: me === String(r.user_id),
  };
}

const SELECT =
  "id, user_id, author_name, author_handle, author_position, author_avatar, " +
  "title, body, caption, media_url, media_kind, media_width, media_height, " +
  "clip_title, clip_start, clip_tags, clip_sentiment, video_source, video_external_id, " +
  "tags, visibility, created_at";

/*
  Who this reader has blocked, and who has blocked them.

  The second half cannot be read as the user. `user_blocks` is deliberately
  owner-only — a browsable list of who has blocked you is an invitation to go
  and find out why — so a plain query for `blocked_id = me` returns nothing and
  the block silently works in one direction only.

  That was the first version of this function, and it was wrong in the way that
  matters: A blocks B, A stops seeing B, and B carries on seeing A.

  So the reverse direction is read with the admin client, HERE, in a
  `server-only` module. The reader never receives the list — they receive a
  feed with those authors already gone. They can of course infer that someone
  blocked them when the posts stop appearing; that is unavoidable in any feed.
  What they cannot do is enumerate it.
*/
async function blockedEitherWay(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  me: string,
): Promise<Set<string>> {
  const admin = createAdminClient();
  const [mine, theirs] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me),
    admin
      ? admin.from("user_blocks").select("blocker_id").eq("blocked_id", me)
      : Promise.resolve({ data: [] as { blocker_id: unknown }[] }),
  ]);
  const out = new Set<string>();
  for (const r of mine.data ?? []) out.add(String(r.blocked_id));
  for (const r of theirs.data ?? []) out.add(String(r.blocker_id));
  return out;
}

export interface FeedQuery {
  /** Only people this reader follows. The "Following" tab. */
  followingOnly?: boolean;
  /** One author's posts, for a profile grid. */
  authorId?: string;
  limit?: number;
}

export async function listFeed(q: FeedQuery = {}): Promise<Post[]> {
  if (isDemoMode) return demoFeed(q);

  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const me = user.id;

  const limit = Math.min(q.limit ?? 40, 100);

  let query = supabase
    .from("community_posts")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit * 2); // room to drop blocked authors without a short page

  if (q.authorId) query = query.eq("user_id", q.authorId);

  const [{ data: rows }, blocked, following, liked] = await Promise.all([
    query,
    blockedEitherWay(supabase, me),
    followingIds(supabase, me),
    likedPostIds(supabase, me),
  ]);

  // PostgREST types a failed select as an error object rather than rows; the
  // cast keeps that from becoming a runtime surprise in the mapper.
  let posts = ((rows ?? []) as unknown as Record<string, unknown>[]).map((r) =>
    rowToPost(r, me, liked),
  );

  // Blocking, both ways — see `blockedEitherWay`. Never their posts to me,
  // and never mine to them.
  posts = posts.filter((p) => !blocked.has(p.author.userId));

  // Followers-only posts reach followers and their author, nobody else. The
  // default is 'public', so today this drops nothing — it is here so that
  // changing the default is a one-line change rather than a migration.
  posts = posts.filter(
    (p) =>
      p.visibility === "public" || p.author.userId === me || following.has(p.author.userId),
  );

  if (q.followingOnly) {
    posts = posts.filter((p) => following.has(p.author.userId) || p.author.userId === me);
  }

  const ids = posts.slice(0, limit).map((p) => p.id);
  const counts = await countsFor(supabase, ids);
  return posts
    .slice(0, limit)
    .map((p) => ({ ...p, likes: counts.likes[p.id] ?? 0, comments: counts.comments[p.id] ?? 0 }));
}

async function followingIds(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  me: string,
): Promise<Set<string>> {
  const { data } = await supabase.from("follows").select("following_id").eq("follower_id", me);
  return new Set((data ?? []).map((r) => String(r.following_id)));
}

async function likedPostIds(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  me: string,
): Promise<Set<string>> {
  const { data } = await supabase.from("post_reactions").select("post_id").eq("user_id", me);
  return new Set((data ?? []).map((r) => String(r.post_id)));
}

/*
  Likes and comments per post, in two queries rather than two per post.

  Counted in the application rather than with a Postgres aggregate because
  PostgREST's grouping support is awkward and this is a handful of rows. If a
  feed ever gets big enough for this to hurt, the answer is a counter column
  maintained by a trigger, not a cleverer select.
*/
async function countsFor(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ids: string[],
): Promise<{ likes: Record<string, number>; comments: Record<string, number> }> {
  if (ids.length === 0) return { likes: {}, comments: {} };

  const [reactions, comments] = await Promise.all([
    supabase.from("post_reactions").select("post_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
  ]);

  const tally = (rows: { post_id: unknown }[] | null) => {
    const out: Record<string, number> = {};
    for (const r of rows ?? []) {
      const k = String(r.post_id);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  return { likes: tally(reactions.data), comments: tally(comments.data) };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function getProfileSummary(handleOrId: string): Promise<ProfileSummary | null> {
  if (isDemoMode) return demoProfile(handleOrId);

  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? null;

  const isUuid = /^[0-9a-f-]{36}$/i.test(handleOrId);
  const { data: pp } = isUuid
    ? await supabase
        .from("player_profiles")
        .select("user_id, handle, primary_position, club, bio, is_public")
        .eq("user_id", handleOrId)
        .maybeSingle()
    : await supabase
        .from("player_profiles")
        .select("user_id, handle, primary_position, club, bio, is_public")
        .eq("handle", handleOrId.replace(/^@/, ""))
        .maybeSingle();

  if (!pp) return null;
  const userId = String(pp.user_id);

  const [{ data: profile }, posts, followers, following, mine] = await Promise.all([
    supabase.from("profiles").select("full_name, known_as, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("community_posts").select("id").eq("user_id", userId),
    supabase.from("follows").select("follower_id").eq("following_id", userId),
    supabase.from("follows").select("following_id").eq("follower_id", userId),
    me
      ? supabase.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    userId,
    name: (profile?.known_as as string) || (profile?.full_name as string) || "Player",
    handle: (pp.handle as string) ?? null,
    position: (pp.primary_position as string) ?? null,
    club: (pp.club as string) ?? null,
    avatar: (profile?.avatar_url as string) ?? null,
    bio: (pp.bio as string) ?? null,
    posts: (posts.data ?? []).length,
    followers: (followers.data ?? []).length,
    following: (following.data ?? []).length,
    followedByMe: Boolean(mine.data),
    isMe: me === userId,
  };
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

const demoAuthor = {
  userId: "demo",
  name: "MIDO",
  handle: "mido9",
  position: "CF",
  avatar: null,
};

function demoPosts(): Post[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  return [
    {
      id: "p1",
      author: demoAuthor,
      caption:
        "Near-post run from Saturday. Third time this month I've arrived on the right side and gone across the keeper instead of the front zone.",
      media: { kind: "youtube", url: "aqz-KE-bpKQ", width: null, height: null },
      clip: null,
      tags: ["finishing", "movement"],
      visibility: "public",
      createdAt: ago(4),
      likes: 6,
      comments: 2,
      likedByMe: false,
      mine: true,
    },
    {
      id: "p2",
      author: { ...demoAuthor, userId: "demo2", name: "Ade", handle: "ade6", position: "6" },
      caption: "Body shape before receiving — open to the whole pitch. Rondo work paying off.",
      media: null,
      clip: null,
      tags: ["scanning"],
      visibility: "public",
      createdAt: ago(20),
      likes: 3,
      comments: 0,
      likedByMe: true,
      mine: false,
    },
  ];
}

function demoFeed(q: FeedQuery): Post[] {
  let posts = demoPosts();
  if (q.authorId) posts = posts.filter((p) => p.author.userId === q.authorId);
  if (q.followingOnly) posts = posts.filter((p) => !p.mine);
  return posts;
}

function demoProfile(handleOrId: string): ProfileSummary {
  const wanted = handleOrId.replace(/^@/, "");
  const mine = wanted === "mido9" || wanted === "demo";
  return {
    userId: mine ? "demo" : "demo2",
    name: mine ? "MIDO" : "Ade",
    handle: mine ? "mido9" : "ade6",
    position: mine ? "CF" : "6",
    club: "Northgate FC",
    avatar: null,
    bio: mine ? "Direct forward — runs in behind, presses from the front." : null,
    posts: demoPosts().filter((p) => (mine ? p.mine : !p.mine)).length,
    followers: mine ? 12 : 4,
    following: mine ? 8 : 11,
    followedByMe: !mine,
    isMe: mine,
  };
}

/**
 * One post, with its comments.
 *
 * Goes through the same block and visibility rules as the feed — a post
 * somebody cannot see in the feed must not be reachable by pasting its id, or
 * blocking is a suggestion rather than a rule.
 */
export async function getPost(
  id: string,
): Promise<{ post: Post; comments: { id: string; userId: string; name: string; handle: string | null; body: string; createdAt: string; mine: boolean }[] } | null> {
  if (isDemoMode) {
    const post = demoPosts().find((p) => p.id === id);
    return post ? { post, comments: [] } : null;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const me = user.id;

  const { data: row } = await supabase.from("community_posts").select(SELECT).eq("id", id).maybeSingle();
  if (!row) return null;

  const [blocked, following, liked] = await Promise.all([
    blockedEitherWay(supabase, me),
    followingIds(supabase, me),
    likedPostIds(supabase, me),
  ]);

  const post = rowToPost(row as unknown as Record<string, unknown>, me, liked);

  // The same two rules the feed applies. A blocked author's post is not
  // reachable by id either.
  if (blocked.has(post.author.userId)) return null;
  if (
    post.visibility !== "public" &&
    post.author.userId !== me &&
    !following.has(post.author.userId)
  ) {
    return null;
  }

  const [{ data: comments }, counts] = await Promise.all([
    supabase
      .from("post_comments")
      .select("id, user_id, author_name, author_handle, body, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    countsFor(supabase, [id]),
  ]);

  return {
    post: { ...post, likes: counts.likes[id] ?? 0, comments: counts.comments[id] ?? 0 },
    comments: (comments ?? [])
      // A blocked person's comments go too. Seeing them under a post is the
      // same failure as seeing their posts.
      .filter((c) => !blocked.has(String(c.user_id)))
      .map((c) => ({
        id: String(c.id),
        userId: String(c.user_id),
        name: (c.author_name as string) ?? "Player",
        handle: (c.author_handle as string) ?? null,
        body: String(c.body),
        createdAt: String(c.created_at),
        mine: String(c.user_id) === me,
      })),
  };
}
