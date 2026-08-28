import { createClient } from "@/lib/supabase/server";
import { isDemoMode, env } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { track } from "@/lib/analytics/track";
import { extensionJson, preflight, refuseBadOrigin } from "@/lib/extension/api";

export const dynamic = "force-dynamic";

/*
  Who is this, and what are they working on?

  One round trip serving the whole popup: connection state, the name to
  greet with, and the active development goals the capture can attach
  to. The extension calls it on open; a 401 here IS the "Connect MIDO
  XI" state, not an error.

  Goals failing to load must never block capturing — the extension
  treats a missing `goals` array as "capture unconnected", so this
  route prefers an empty list to a 500.
*/

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const refused = refuseBadOrigin(request);
  if (refused) return refused;

  const appUrl = env.appUrl;

  if (isDemoMode) {
    const goals = demoStore
      .listGoals()
      .filter((g) => g.status === "active")
      .map((g) => ({ id: g.id, title: g.title, category: g.category }));
    return extensionJson(request, {
      authenticated: true,
      demo: true,
      user: { name: "Demo player" },
      goals,
      appUrl,
    });
  }

  const supabase = await createClient();
  if (!supabase) {
    return extensionJson(request, { authenticated: false, error: "Service unavailable." }, 503);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return extensionJson(request, { authenticated: false }, 401);

  let name: string | null = null;
  let goals: { id: string; title: string; category: string }[] = [];
  try {
    const [profileRes, goalsRes] = await Promise.all([
      supabase.from("profiles").select("known_as, full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("development_goals")
        .select("id, title, category")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(12),
    ]);
    name =
      (profileRes.data?.known_as as string) ||
      (profileRes.data?.full_name as string) ||
      null;
    goals = (goalsRes.data ?? []) as typeof goals;
  } catch {
    // Goals are an enhancement; the capture works without them.
  }

  await track("extension_opened", { goals: goals.length });

  return extensionJson(request, {
    authenticated: true,
    user: { name: name ?? user.email ?? null },
    goals,
    appUrl,
  });
}
