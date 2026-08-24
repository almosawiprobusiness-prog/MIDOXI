import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type {
  AgendaItem,
  Meeting,
  MeetingDetail,
  MeetingKind,
  MeetingPerson,
  MeetingStatus,
  TimeProposal,
  VideoProvider,
} from "./meeting-types";
import { demoMeetingDetail, demoMeetings } from "./meetings-demo";

/*
  Reading meetings.

  One row, two readers — see 0024. Which means every query here is
  "where I am either side", and every row that comes back has to be
  turned around so that `withPerson` is the OTHER person from the
  reader's point of view. Getting that backwards shows a coach a list
  of meetings with themselves, which is the sort of thing that looks
  fine in a screenshot and is nonsense in use.
*/

const SELECT =
  "id, created_by, with_user, kind, title, note, starts_at, ends_at, status, " +
  "video_provider, video_room, external_url, created_at";

interface Row {
  id: string;
  created_by: string;
  with_user: string;
  kind: string;
  title: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  video_provider: string | null;
  video_room: string | null;
  external_url: string | null;
  created_at: string;
}

/*
  Names and faces for a set of user ids.

  Two tables because they answer different questions: `profiles` is
  who the account is, `player_profiles` is who they are on a pitch.
  A coach has the first and not the second, so the position is
  optional rather than assumed.
*/
async function peopleFor(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ids: string[],
): Promise<Map<string, MeetingPerson>> {
  const out = new Map<string, MeetingPerson>();
  if (ids.length === 0) return out;

  const [{ data: profiles }, { data: players }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, known_as, avatar_url").in("id", ids),
    supabase.from("player_profiles").select("user_id, handle, primary_position").in("user_id", ids),
  ]);

  const byUser = new Map((players ?? []).map((p) => [String(p.user_id), p]));
  for (const p of profiles ?? []) {
    const id = String(p.id);
    const pl = byUser.get(id);
    out.set(id, {
      id,
      name: String(p.known_as || p.full_name || "Someone").trim(),
      handle: (pl?.handle as string) ?? null,
      avatar: (p.avatar_url as string) ?? null,
      position: (pl?.primary_position as string) ?? null,
    });
  }

  /*
    Anyone whose profile row is missing still gets an entry. A meeting
    that silently vanishes because the other side has no profile row is
    far worse than one that says "Someone".
  */
  for (const id of ids) {
    if (!out.has(id)) out.set(id, { id, name: "Someone", handle: null, avatar: null, position: null });
  }
  return out;
}

function toMeeting(row: Row, me: string, people: Map<string, MeetingPerson>): Meeting {
  const otherId = row.created_by === me ? row.with_user : row.created_by;
  return {
    id: row.id,
    kind: row.kind as MeetingKind,
    title: row.title,
    note: row.note,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as MeetingStatus,
    videoProvider: (row.video_provider as VideoProvider) ?? null,
    videoRoom: row.video_room,
    externalUrl: row.external_url,
    withPerson: people.get(otherId) ?? { id: otherId, name: "Someone", handle: null, avatar: null, position: null },
    organiser: row.created_by === me,
    createdAt: row.created_at,
  };
}

export interface MeetingQuery {
  /** 'upcoming' also includes anything happening right now. */
  scope?: "upcoming" | "past" | "all";
  limit?: number;
}

export async function listMeetings(q: MeetingQuery = {}): Promise<Meeting[]> {
  if (isDemoMode) return demoMeetings(q);

  const supabase = await createClient();
  if (!supabase) return [];
  const user = await getAuthUser();
  if (!user) return [];
  const me = user.id;

  const scope = q.scope ?? "upcoming";
  let query = supabase.from("meetings").select(SELECT).or(`created_by.eq.${me},with_user.eq.${me}`);

  /*
    Bounded on `ends_at`, not `starts_at`. A meeting that began twenty
    minutes ago is the single most useful row in the list — it is the
    one somebody is late for — and filtering on the start time drops it.
  */
  const now = new Date().toISOString();
  if (scope === "upcoming") {
    query = query.gte("ends_at", now).order("starts_at", { ascending: true });
  } else if (scope === "past") {
    query = query.lt("ends_at", now).order("starts_at", { ascending: false });
  } else {
    query = query.order("starts_at", { ascending: false });
  }

  const { data } = await query.limit(Math.min(q.limit ?? 50, 200));
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.flatMap((r) => [r.created_by, r.with_user]))];
  const people = await peopleFor(supabase, ids);
  return rows.map((r) => toMeeting(r, me, people));
}

export async function getMeeting(id: string): Promise<MeetingDetail | null> {
  if (isDemoMode) return demoMeetingDetail(id);

  const supabase = await createClient();
  if (!supabase) return null;
  const user = await getAuthUser();
  if (!user) return null;
  const me = user.id;

  /*
    No `.or(...)` filter here: RLS already refuses a meeting the reader
    is not party to, and repeating the rule in the query is a second
    place for it to be wrong. Not found and not allowed are the same
    answer to the caller, deliberately — "you are not in this meeting"
    tells somebody a meeting exists.
  */
  const { data: row } = await supabase.from("meetings").select(SELECT).eq("id", id).maybeSingle();
  if (!row) return null;

  const [{ data: agenda }, { data: proposals }, { data: history }] = await Promise.all([
    supabase
      .from("meeting_agenda")
      .select("id, position, kind, title, body, ref_clip, ref_study, ref_video, ref_goal, at_seconds, done, added_by")
      .eq("meeting_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("meeting_proposals")
      .select("id, starts_at, ends_at, note, proposed_by, status, created_at")
      .eq("meeting_id", id)
      .eq("status", "pending")
      .maybeSingle(),
    supabase
      .from("meeting_events")
      .select("action, actor_id, detail, created_at")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const r = row as unknown as Row;
  const people = await peopleFor(supabase, [r.created_by, r.with_user]);

  const open = proposals as unknown as {
    id: string; starts_at: string; ends_at: string; note: string | null;
    proposed_by: string; status: string; created_at: string;
  } | null;

  return {
    ...toMeeting(r, me, people),
    agenda: (agenda ?? []).map(
      (a): AgendaItem => ({
        id: String(a.id),
        position: Number(a.position),
        kind: a.kind as AgendaItem["kind"],
        title: String(a.title),
        body: (a.body as string) ?? null,
        refClip: (a.ref_clip as string) ?? null,
        refStudy: (a.ref_study as string) ?? null,
        refVideo: (a.ref_video as string) ?? null,
        refGoal: (a.ref_goal as string) ?? null,
        atSeconds: a.at_seconds === null ? null : Number(a.at_seconds),
        done: Boolean(a.done),
        addedBy: String(a.added_by),
        mine: String(a.added_by) === me,
      }),
    ),
    openProposal: open
      ? ({
          id: open.id,
          startsAt: open.starts_at,
          endsAt: open.ends_at,
          note: open.note,
          proposedBy: open.proposed_by,
          mine: open.proposed_by === me,
          status: open.status as TimeProposal["status"],
          createdAt: open.created_at,
        } satisfies TimeProposal)
      : null,
    history: (history ?? []).map((h) => ({
      action: String(h.action),
      actorId: String(h.actor_id),
      at: String(h.created_at),
      detail: (h.detail ?? {}) as Record<string, unknown>,
    })),
  };
}

/**
 * People this account may actually book with.
 *
 * Only accounts already connected — a coach's players, a trainer's
 * athletes, and the coaches/trainers who have added this player. Open
 * booking on a product with minors on it is not a feature, it is an
 * inbox for strangers.
 */
export async function bookableWith(): Promise<MeetingPerson[]> {
  if (isDemoMode) {
    const seen = new Map<string, MeetingPerson>();
    for (const m of demoMeetings({ scope: "all" })) seen.set(m.withPerson.id, m.withPerson);
    return [...seen.values()];
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const user = await getAuthUser();
  if (!user) return [];
  const me = user.id;

  const [mine, theirs, myAthletes, theirTrainers] = await Promise.all([
    supabase.from("coach_players").select("player_id").eq("coach_id", me).not("player_id", "is", null),
    supabase.from("coach_players").select("coach_id").eq("player_id", me),
    supabase.from("trainer_athletes").select("player_id").eq("trainer_id", me).not("player_id", "is", null),
    supabase.from("trainer_athletes").select("trainer_id").eq("player_id", me),
  ]);

  const ids = new Set<string>();
  for (const r of mine.data ?? []) if (r.player_id) ids.add(String(r.player_id));
  for (const r of theirs.data ?? []) if (r.coach_id) ids.add(String(r.coach_id));
  for (const r of myAthletes.data ?? []) if (r.player_id) ids.add(String(r.player_id));
  for (const r of theirTrainers.data ?? []) if (r.trainer_id) ids.add(String(r.trainer_id));
  ids.delete(me);

  const people = await peopleFor(supabase, [...ids]);
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}
