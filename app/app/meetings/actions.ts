"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  AGENDA_MAX_ITEMS,
  AGENDA_TITLE_MAX,
  positionBetween,
  rangeIssue,
  titleIssue,
  type AgendaKind,
  type MeetingKind,
} from "@/lib/data/meeting-types";

/*
  Everything two people can do to a meeting they share.

  Three rules run through all of it.

  A NEW TIME IS OFFERED, NOT WRITTEN. Nothing here lets one side move a
  confirmed meeting on its own. `proposeTime` writes a proposal and the
  other side accepts it, so nobody ever finds out a session moved by
  looking at their calendar.

  EVERY STATE CHANGE LEAVES A TRACE. `meeting_events` has no update or
  delete grant, so the history is append-only by privilege rather than by
  good intentions, and "who moved this?" is always answerable.

  YOU CAN ONLY BOOK SOMEBODY YOU ARE CONNECTED TO. Checked server-side
  here, not merely absent from the picker — a form that only hides an
  option is not enforcing anything.
*/

export type MeetingResult = { ok: true; id?: string } | { ok: false; error: string };

const DEMO: MeetingResult = {
  ok: false,
  error: "This is the demo. Sign in to book a real session.",
};

async function me() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function refresh(id?: string) {
  revalidatePath("/app/meetings");
  if (id) revalidatePath(`/app/meetings/${id}`);
  revalidatePath("/app/calendar");
}

/** Append to the history. Never throws — a lost audit line must not fail the action. */
async function record(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  meetingId: string,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await supabase.from("meeting_events").insert({ meeting_id: meetingId, action, detail });
}

/** Is this person connected to me? The same set `bookableWith` offers. */
async function isConnected(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  meId: string,
  themId: string,
): Promise<boolean> {
  const [a, b, c, d] = await Promise.all([
    supabase.from("coach_players").select("id").eq("coach_id", meId).eq("player_id", themId).limit(1),
    supabase.from("coach_players").select("id").eq("coach_id", themId).eq("player_id", meId).limit(1),
    supabase.from("trainer_athletes").select("id").eq("trainer_id", meId).eq("player_id", themId).limit(1),
    supabase.from("trainer_athletes").select("id").eq("trainer_id", themId).eq("player_id", meId).limit(1),
  ]);
  return [a, b, c, d].some((r) => (r.data ?? []).length > 0);
}

// ---------------------------------------------------------------------------
// The meeting
// ---------------------------------------------------------------------------

export async function createMeeting(input: {
  withUser: string;
  kind: MeetingKind;
  title: string;
  note?: string | null;
  startsAt: string;
  endsAt: string;
  externalUrl?: string | null;
}): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const bad = titleIssue(input.title) ?? rangeIssue(input.startsAt, input.endsAt);
  if (bad) return { ok: false, error: bad };
  if (input.withUser === userId) return { ok: false, error: "Pick somebody else." };

  if (!(await isConnected(supabase, userId, input.withUser))) {
    return { ok: false, error: "You can only book time with someone you are connected to." };
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      created_by: userId,
      with_user: input.withUser,
      kind: input.kind,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      external_url: input.externalUrl?.trim() || null,
      video_provider: input.externalUrl?.trim() ? "external" : null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "That could not be saved." };

  await record(supabase, data.id, "created", { kind: input.kind });
  refresh(data.id);
  return { ok: true, id: data.id };
}

/** Accept or decline the meeting itself. Only the invitee is asked. */
export async function respondToMeeting(id: string, accept: boolean): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { data: m } = await supabase.from("meetings").select("created_by, with_user, status").eq("id", id).maybeSingle();
  if (!m) return { ok: false, error: "That meeting is not there." };
  if (m.created_by === userId) return { ok: false, error: "You called this one — the other side accepts it." };
  if (m.status !== "proposed") return { ok: false, error: "This has already been answered." };

  const { error } = await supabase
    .from("meetings")
    .update({ status: accept ? "confirmed" : "declined", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await record(supabase, id, accept ? "accepted" : "declined");
  refresh(id);
  return { ok: true };
}

/**
 * Call it off.
 *
 * Cancelled, never deleted, once anybody has agreed to it — the other
 * person planned around this, and making it disappear denies them the
 * chance to see that it was called off at all.
 */
export async function cancelMeeting(id: string): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase
    .from("meetings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await record(supabase, id, "cancelled");
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Moving it
// ---------------------------------------------------------------------------

export async function proposeTime(
  meetingId: string,
  startsAt: string,
  endsAt: string,
  note?: string | null,
): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const bad = rangeIssue(startsAt, endsAt);
  if (bad) return { ok: false, error: bad };

  /*
    Supersede any open offer first. The unique index allows one pending
    proposal per meeting, so without this the second "can we move it to..."
    fails with a constraint violation instead of replacing the first —
    and the person offering has no idea why.
  */
  await supabase
    .from("meeting_proposals")
    .update({ status: "superseded" })
    .eq("meeting_id", meetingId)
    .eq("status", "pending");

  const { error } = await supabase.from("meeting_proposals").insert({
    meeting_id: meetingId,
    proposed_by: userId,
    starts_at: startsAt,
    ends_at: endsAt,
    note: note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await record(supabase, meetingId, "proposed_time", { startsAt, endsAt });
  refresh(meetingId);
  return { ok: true };
}

export async function respondToProposal(proposalId: string, accept: boolean): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { data: p } = await supabase
    .from("meeting_proposals")
    .select("id, meeting_id, starts_at, ends_at, proposed_by, status")
    .eq("id", proposalId)
    .maybeSingle();
  if (!p) return { ok: false, error: "That request is not there." };
  if (p.status !== "pending") return { ok: false, error: "This has already been answered." };
  // Accepting your own offer would move the meeting unilaterally, which is
  // the entire thing proposals exist to prevent.
  if (p.proposed_by === userId) return { ok: false, error: "You proposed this — the other side answers it." };

  const { error } = await supabase
    .from("meeting_proposals")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", proposalId);
  if (error) return { ok: false, error: error.message };

  if (accept) {
    const { error: moveErr } = await supabase
      .from("meetings")
      .update({
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.meeting_id);
    if (moveErr) return { ok: false, error: moveErr.message };
  }

  await record(supabase, String(p.meeting_id), accept ? "accepted_time" : "declined_time", {
    startsAt: p.starts_at,
    endsAt: p.ends_at,
  });
  refresh(String(p.meeting_id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The shared agenda
// ---------------------------------------------------------------------------

export async function addAgendaItem(
  meetingId: string,
  input: {
    kind: AgendaKind;
    title: string;
    body?: string | null;
    refClip?: string | null;
    refStudy?: string | null;
    refVideo?: string | null;
    refGoal?: string | null;
    atSeconds?: number | null;
  },
): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the item a title." };
  if (title.length > AGENDA_TITLE_MAX) return { ok: false, error: `Keep it under ${AGENDA_TITLE_MAX} characters.` };

  const [{ data: existing }, { count }] = await Promise.all([
    supabase
      .from("meeting_agenda")
      .select("position")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: false })
      .limit(1),
    supabase
      .from("meeting_agenda")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", meetingId),
  ]);

  if ((count ?? 0) >= AGENDA_MAX_ITEMS) {
    return {
      ok: false,
      error: `An agenda holds ${AGENDA_MAX_ITEMS} items — already more than one meeting can cover.`,
    };
  }

  // New items go on the end.
  const last = existing?.[0]?.position;
  const position = last === undefined || last === null ? 1 : Number(last) + 1;

  const { error } = await supabase.from("meeting_agenda").insert({
    meeting_id: meetingId,
    added_by: userId,
    position,
    kind: input.kind,
    title,
    body: input.body?.trim() || null,
    ref_clip: input.refClip ?? null,
    ref_study: input.refStudy ?? null,
    ref_video: input.refVideo ?? null,
    ref_goal: input.refGoal ?? null,
    at_seconds: input.atSeconds ?? null,
  });
  if (error) return { ok: false, error: error.message };

  refresh(meetingId);
  return { ok: true };
}

/** Tick an item off, or un-tick it. Either party may, on either party's item. */
export async function setAgendaDone(itemId: string, meetingId: string, done: boolean): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("meeting_agenda").update({ done }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  refresh(meetingId);
  return { ok: true };
}

/**
 * Move an item between two others.
 *
 * Takes the neighbours rather than an index so that two people
 * reordering at once do not fight: each drop writes one row, and the
 * loser of a race lands next to where they aimed rather than
 * renumbering the list out from under the other person.
 */
export async function moveAgendaItem(
  itemId: string,
  meetingId: string,
  beforePosition: number | null,
  afterPosition: number | null,
): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const position = positionBetween(beforePosition, afterPosition);

  if (position === null) {
    /*
      The gap between the neighbours has collapsed below what a double
      can represent. Renumber the whole list to whole numbers and retry
      — rare enough to be worth doing properly rather than silently
      writing a duplicate position.
    */
    const { data: all } = await supabase
      .from("meeting_agenda")
      .select("id, position")
      .eq("meeting_id", meetingId)
      .order("position", { ascending: true });

    let i = 1;
    for (const row of all ?? []) {
      await supabase.from("meeting_agenda").update({ position: i }).eq("id", row.id);
      i++;
    }
    refresh(meetingId);
    return { ok: false, error: "The order needed tidying up. Try that move again." };
  }

  const { error } = await supabase.from("meeting_agenda").update({ position }).eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  refresh(meetingId);
  return { ok: true };
}

/** Only the author removes their own item. Reordering somebody else's point is not the same as deleting it. */
export async function deleteAgendaItem(itemId: string, meetingId: string): Promise<MeetingResult> {
  if (isDemoMode) return DEMO;
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("meeting_agenda").delete().eq("id", itemId).eq("added_by", userId);
  if (error) return { ok: false, error: error.message };
  refresh(meetingId);
  return { ok: true };
}
