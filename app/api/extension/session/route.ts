import { createClient } from "@/lib/supabase/server";
import { isDemoMode, env } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { track } from "@/lib/analytics/track";
import { extensionJson, preflight, refuseBadOrigin } from "@/lib/extension/api";
import { getMembership } from "@/lib/billing/membership";
import { PLANS } from "@/lib/billing/plans";

/*
  What the popup's "Build a training session" path needs to know,
  answered server-side so the extension never decides entitlement
  itself: `entitled` is the membership read (an isPaid boolean, no plan
  detail), and `pricing` is the canonical Player plan config — the one
  source of truth — so the paywall can never show a price the checkout
  would disagree with.
*/
function playerPricing() {
  return {
    monthlyCents: PLANS.player_monthly.priceCents,
    annualCents: PLANS.player_annual.priceCents,
  };
}

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
      // Demo shows the product, not a paywall — captures aren't kept
      // there either, and a demo dollar would be a fake one.
      entitled: true,
      pricing: playerPricing(),
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

  /*
    Entitlement is read here, not asserted by the extension — the popup
    only ever renders what this boolean says, and every action it gates
    is re-verified by its own server route anyway. A membership read
    failing must not block capturing: it degrades to "not entitled",
    which shows the paywall path, never an error.
  */
  let entitled = false;
  try {
    entitled = (await getMembership()).isPro;
  } catch {
    // Degrades to the unpaid path; capture itself is untouched.
  }

  return extensionJson(request, {
    authenticated: true,
    user: { name: name ?? user.email ?? null },
    goals,
    appUrl,
    entitled,
    pricing: playerPricing(),
  });
}
