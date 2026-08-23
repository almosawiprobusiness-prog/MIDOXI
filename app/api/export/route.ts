import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { getProfileSettings } from "@/lib/data/profile";

/** Download the signed-in user's football data as a JSON file. */
export async function GET() {
  const profile = await getProfileSettings();

  let payload: Record<string, unknown>;

  if (isDemoMode) {
    payload = {
      profile,
      matches: demoStore.listMatches(),
      developmentGoals: demoStore.listGoals().map((g) => ({
        ...g,
        evidence: demoStore.getGoal(g.id)?.evidence ?? [],
      })),
      training: demoStore.listTraining(),
      calendar: demoStore.listEvents(),
      note: "Demo export — seed data, not a real account.",
    };
  } else {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const [matches, matchStats, matchReviews, goals, evidence, training, logs, events, checkins] =
      await Promise.all([
        supabase.from("matches").select("*"),
        supabase.from("match_stats").select("*"),
        supabase.from("match_reviews").select("*"),
        supabase.from("development_goals").select("*"),
        supabase.from("development_evidence").select("*"),
        supabase.from("training_sessions").select("*"),
        supabase.from("training_logs").select("*"),
        supabase.from("calendar_events").select("*"),
        supabase.from("daily_checkins").select("*"),
      ]);

    payload = {
      profile,
      matches: matches.data ?? [],
      matchStats: matchStats.data ?? [],
      matchReviews: matchReviews.data ?? [],
      developmentGoals: goals.data ?? [],
      developmentEvidence: evidence.data ?? [],
      trainingSessions: training.data ?? [],
      trainingLogs: logs.data ?? [],
      calendarEvents: events.data ?? [],
      dailyCheckins: checkins.data ?? [],
    };
  }

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), app: "MIDO XI", ...payload },
    null,
    2
  );

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mido-xi-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
