import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { listMatches } from "./matches";
import { listGoals } from "./development";
import type { SearchEntry } from "@/lib/search";

/*
  The user's own football memory, flattened for the command bar.

  Built on the server and handed to the palette as plain data, because the
  alternative — the palette fetching on keystroke — would put a round trip in
  front of every character typed into the fastest surface in the product.

  Matches and goals come through the existing adapters, so demo and real mode
  are already handled there. Clips are read directly because there is no
  list-all-clips adapter and this only needs three columns.
*/

/** Enough to search a season without shipping a database to the browser. */
const LIMITS = { matches: 40, clips: 60, goals: 30 } as const;

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function getSearchIndex(): Promise<SearchEntry[]> {
  const [matches, goals, clips] = await Promise.all([
    listMatches().catch(() => []),
    listGoals().catch(() => []),
    listClips().catch(() => []),
  ]);

  const entries: SearchEntry[] = [];

  for (const m of matches.slice(0, LIMITS.matches)) {
    const label = `${m.home ? "vs" : "@"} ${m.opponent}`;
    entries.push({
      id: `match-${m.id}`,
      type: "match",
      title: label,
      subtitle: [m.competition, dateLabel(m.date)].filter(Boolean).join(" · "),
      href: `/app/matches/${m.id}`,
      keywords: `${m.opponent} ${m.opponentShort} ${m.competition} match fixture ${dateLabel(m.date)}`,
    });
  }

  for (const c of clips.slice(0, LIMITS.clips)) {
    entries.push({
      id: `clip-${c.id}`,
      type: "clip",
      title: c.title,
      subtitle: `Clip · ${c.tags.join(", ") || "untagged"}`,
      href: "/app/film-room",
      keywords: `${c.title} ${c.note} ${c.tags.join(" ")} clip film`,
    });
  }

  for (const g of goals.slice(0, LIMITS.goals)) {
    entries.push({
      id: `goal-${g.id}`,
      type: "goal",
      title: g.title,
      subtitle: `Development · ${g.category} · ${g.status}`,
      href: `/app/development/${g.id}`,
      keywords: `${g.title} ${g.why} ${g.category} development goal objective`,
    });
  }

  return entries;
}

interface ClipRow {
  id: string;
  title: string;
  note: string;
  tags: string[];
}

async function listClips(): Promise<ClipRow[]> {
  if (isDemoMode) {
    const { demoStore } = await import("./store");
    return demoStore.listClips().map((c) => ({
      id: c.id,
      title: c.title,
      note: c.note ?? "",
      tags: c.tags ?? [],
    }));
  }

  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("clips")
    .select("id, title, note, clip_tags(tag)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(LIMITS.clips);

  return (data ?? []).map((c) => ({
    id: String(c.id),
    title: String(c.title ?? "Clip"),
    note: String(c.note ?? ""),
    tags: ((c.clip_tags as { tag: string }[] | null) ?? []).map((t) => t.tag),
  }));
}
