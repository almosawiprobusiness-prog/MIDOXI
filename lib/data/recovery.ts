import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { score, streakOf, type Checkin, type RecoveryView } from "./recovery-types";

/*
  Recovery data access.

  Like Performance, this page previously imported a hardcoded module with no
  branch on demo mode — and the numbers it showed (HRV, resting heart rate,
  hydration) do not exist in the schema and cannot be entered anywhere. A player
  deciding whether to train was reading invented physiology.

  Real mode reads `daily_checkins`, which holds four self-reported 1–5 scores
  and a note. That is all there is, so that is all this returns.
*/

export async function getRecovery(days = 14): Promise<RecoveryView> {
  if (isDemoMode) return demoRecovery(days);

  const supabase = await createClient();
  if (!supabase) return empty();
  const user = await getAuthUser();
  if (!user) return empty();

  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_checkins")
    .select("checkin_date, energy, soreness, sleep, mental, note")
    .eq("user_id", user.id)
    .gte("checkin_date", since)
    .order("checkin_date", { ascending: true });

  const checkins: Checkin[] = (data ?? []).map((d) => ({
    date: String(d.checkin_date),
    energy: d.energy ?? null,
    soreness: d.soreness ?? null,
    sleep: d.sleep ?? null,
    mental: d.mental ?? null,
    note: d.note ?? null,
  }));

  return view("yours", checkins);
}

function view(source: "demo" | "yours", checkins: Checkin[]): RecoveryView {
  const scored = checkins.map(score);
  return {
    source,
    days: scored,
    today: scored.length ? scored[scored.length - 1] : null,
    streak: streakOf(checkins),
  };
}

function empty(): RecoveryView {
  return { source: "yours", days: [], today: null, streak: { reported: 0, of: 7 } };
}

// ── demo ─────────────────────────────────────────────────────

/*
  Seeded to the shape of the real thing: four 1–5 scores and a note, nothing a
  wearable would be needed for. The dip mid-week and the recovery afterwards is
  the pattern worth showing — a week where nothing changes teaches nobody how to
  read their own check-ins.
*/
function demoRecovery(days: number): RecoveryView {
  const seed = [
    { energy: 5, soreness: 1, sleep: 5, mental: 5, note: "Fresh — best session of the week." },
    { energy: 4, soreness: 2, sleep: 4, mental: 4, note: null },
    { energy: 3, soreness: 3, sleep: 3, mental: 3, note: "Heavy legs after the double." },
    { energy: 2, soreness: 4, sleep: 3, mental: 3, note: "Rough night, quads tight." },
    { energy: 3, soreness: 3, sleep: 4, mental: 4, note: null },
    { energy: 4, soreness: 2, sleep: 5, mental: 4, note: "Back to it." },
    { energy: 5, soreness: 2, sleep: 5, mental: 5, note: null },
  ].slice(-Math.min(days, 7));

  const now = Date.now();
  const checkins: Checkin[] = seed.map((s, i) => ({
    ...s,
    date: new Date(now - (seed.length - 1 - i) * 864e5).toISOString().slice(0, 10),
  }));

  return view("demo", checkins);
}
