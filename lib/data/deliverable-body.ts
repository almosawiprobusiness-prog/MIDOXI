import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getBoard } from "./boards";
import { getSessionPlan } from "./coach";
import { toDocument } from "@/lib/tactics/document";
import type { SessionBlock, SessionPhase } from "./coach-types";
import type { TacticalDocument } from "@/lib/tactics/types";

/*
  The body of a deliverable, read for somebody who is not signed in.

  The app's own readers are RLS-scoped to the caller, and the client has no
  session — so these go through the service role. That is a privilege, and the
  discipline that goes with it is the one `lib/reports/shares.ts` set:

  · These are only ever called AFTER a token has resolved. The token is the
    authorisation; nothing here re-checks it, and nothing here should be
    reachable without it.
  · They return the fields a client is meant to read and nothing more. No
    owner id, no timestamps, no internal state — a narrow shape is what stops
    a future field leaking by accident.

  Demo mode keeps using the ordinary readers: it has no RLS to bypass.
*/

export interface ClientBoard {
  objective: string;
  notes: string;
  doc: TacticalDocument;
}

export async function boardForClient(id: string): Promise<ClientBoard | null> {
  if (isDemoMode) {
    const b = await getBoard(id);
    return b ? { objective: b.doc.objective ?? "", notes: b.notes, doc: b.doc } : null;
  }

  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("tactical_boards")
    .select("notes, doc")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  /*
    Through `toDocument` like every other read, so a v1 board or a malformed
    one still renders. The client is the last person who should meet a raw
    document.
  */
  const doc = toDocument(data.doc);
  return { objective: doc.objective ?? "", notes: String(data.notes ?? ""), doc };
}

export interface ClientSession {
  objective: string;
  durationMin: number | null;
  playersCount: number | null;
  pitch: string;
  blocks: SessionBlock[];
}

export async function sessionForClient(id: string): Promise<ClientSession | null> {
  if (isDemoMode) {
    const d = await getSessionPlan(id);
    return d
      ? {
          objective: d.plan.objective,
          durationMin: d.plan.durationMin,
          playersCount: d.plan.playersCount,
          pitch: d.plan.pitch,
          blocks: d.blocks,
        }
      : null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data: plan } = await admin
    .from("session_plans")
    .select("objective, duration_min, players_count, pitch")
    .eq("id", id)
    .maybeSingle();
  if (!plan) return null;

  const { data: blocks } = await admin
    .from("session_blocks")
    .select("id, phase, name, duration_min, organisation, coaching_points, progression, regression, position")
    .eq("plan_id", id)
    .order("position");

  return {
    objective: String(plan.objective ?? ""),
    durationMin: (plan.duration_min as number | null) ?? null,
    playersCount: (plan.players_count as number | null) ?? null,
    pitch: String(plan.pitch ?? ""),
    blocks: (blocks ?? []).map((b) => {
      const r = b as Record<string, unknown>;
      return {
        id: String(r.id),
        phase: (r.phase as SessionPhase) ?? "technical",
        name: String(r.name ?? ""),
        durationMin: (r.duration_min as number | null) ?? null,
        organisation: String(r.organisation ?? ""),
        coachingPoints: ((r.coaching_points as string[]) ?? []).filter(Boolean),
        progression: String(r.progression ?? ""),
        regression: String(r.regression ?? ""),
        position: Number(r.position ?? 0),
      };
    }),
  };
}
