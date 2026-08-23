import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { slugifyName } from "./clubs-types";

/*
  Clubs and leagues, learned rather than imported.

  There is no free list of the world's football clubs, and the paid ones cover
  professional football only — which misses almost everyone this product is for.
  A player at Sarisbury Spartans is not in anybody's database, and telling them
  their club "doesn't exist" is a worse experience than a plain text box.

  So the list starts empty and fills from use. The first player to type their
  club's name creates the row; every player after them is offered it. It gets
  more accurate for the actual population over time, which is the opposite of a
  licensed dataset, which decays from the day it is bought.

  The tables are `club_directory` and `league_directory`, NOT `clubs` — which
  has existed since 0001 as a coach's own club record. Getting that wrong is
  how migration 0019 failed the first time: `create table if not exists clubs`
  found the other one, changed nothing, and reported success.

  They are read-only to users. Rows are created only through the
  security-definer functions in migration 0019, called on profile save, so
  nobody can write directly into a list that appears in other people's
  dropdowns.
*/

export interface ClubHit {
  id: string;
  name: string;
  league: string | null;
  /** How many profiles name this club. The ranking signal. */
  uses: number;
}

const MIN_QUERY = 2;
const LIMIT = 8;

/**
 * Clubs whose name starts with what has been typed.
 *
 * Prefix rather than substring on purpose: "uni" should offer "University" and
 * not every club with "united" buried in the middle. `slug text_pattern_ops`
 * makes the prefix an index scan.
 */
export async function searchClubs(query: string): Promise<ClubHit[]> {
  const slug = slugifyName(query);
  if (slug.length < MIN_QUERY) return [];
  if (isDemoMode) return demoClubs.filter((c) => slugifyName(c.name).startsWith(slug)).slice(0, LIMIT);

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("club_directory")
    .select("id, name, league, uses")
    .like("slug", `${slug}%`)
    .order("uses", { ascending: false })
    .limit(LIMIT);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    league: (r.league as string) ?? null,
    uses: Number(r.uses ?? 1),
  }));
}

export async function searchLeagues(query: string): Promise<ClubHit[]> {
  const slug = slugifyName(query);
  if (slug.length < MIN_QUERY) return [];
  if (isDemoMode) return demoLeagues.filter((c) => slugifyName(c.name).startsWith(slug)).slice(0, LIMIT);

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("league_directory")
    .select("id, name, uses")
    .like("slug", `${slug}%`)
    .order("uses", { ascending: false })
    .limit(LIMIT);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    league: null,
    uses: Number(r.uses ?? 1),
  }));
}

/**
 * Record that this player names this club, so the next player is offered it.
 *
 * Best-effort by design. A profile save must never fail because the shared
 * list could not be updated — the player's own club field is already saved by
 * the time this runs, and it is the only copy that matters to them.
 */
export async function rememberClubAndLeague(input: {
  club?: string | null;
  league?: string | null;
  country?: string | null;
}): Promise<void> {
  if (isDemoMode) return;
  const supabase = await createClient();
  if (!supabase) return;

  const club = (input.club ?? "").trim();
  const league = (input.league ?? "").trim();

  try {
    if (club.length >= MIN_QUERY) {
      await supabase.rpc("remember_club", {
        p_name: club,
        p_league: league || null,
        p_country: input.country || null,
      });
    }
    if (league.length >= MIN_QUERY) {
      await supabase.rpc("remember_league", { p_name: league, p_country: input.country || null });
    }
  } catch {
    // The shared list is a convenience. It is never the reason a save fails.
  }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

/*
  A handful, deliberately mixed: two professional, three the kind of club the
  product is actually full of. A demo list of only Premier League sides would
  suggest the feature is for people who play in it.
*/
const demoClubs: ClubHit[] = [
  { id: "c1", name: "Northgate FC", league: "Championship North", uses: 12 },
  { id: "c2", name: "Northgate Rovers", league: "Hampshire Sunday League Div 2", uses: 4 },
  { id: "c3", name: "Halton Town", league: "Championship North", uses: 7 },
  { id: "c4", name: "Sarisbury Spartans FC", league: "Hampshire Sunday League Div 3", uses: 3 },
  { id: "c5", name: "Lakeville United", league: "County Youth U18", uses: 2 },
];

const demoLeagues: ClubHit[] = [
  { id: "l1", name: "Championship North", league: null, uses: 19 },
  { id: "l2", name: "Hampshire Sunday League Div 2", league: null, uses: 6 },
  { id: "l3", name: "Hampshire Sunday League Div 3", league: null, uses: 5 },
  { id: "l4", name: "County Youth U18", league: null, uses: 4 },
];
