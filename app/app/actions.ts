"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { ROLE_COOKIE } from "@/lib/auth/session";
import { isRoleId, type RoleId } from "@/lib/roles/roles";
import { getMembership } from "@/lib/billing/membership";
import { canUseRole } from "@/lib/billing/plans";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { readinessOf } from "@/lib/data/recovery-types";

/** Sign out (real mode) and return to the landing page. */
export async function signOut() {
  if (!isDemoMode) {
    const supabase = await createClient();
    if (supabase) await supabase.auth.signOut();
  }
  redirect("/");
}

/**
 * Switch the active operating system (player / coach / trainer / club).
 *
 * Demo mode stores the choice in a cookie so every role can be explored.
 * Real mode writes `profiles.role` and provisions the matching profile row
 * if the account has never used that role before, so the user lands in a
 * working workspace rather than an error.
 */
export async function switchRole(role: RoleId) {
  if (!isRoleId(role)) return;

  /*
    The gate, server-side.

    This action does not merely switch a view — it writes `profiles.role` and
    upserts that role's profile row, which is what makes an account
    *provisioned* for a system. So a client calling it directly with "club"
    would provision Club and, because a free account's one system is whichever
    one it chose, be handed it.

    The switcher already hides what is not entitled, but hiding is not
    enforcing. This is where it is enforced. Demo mode is exempt: it has no
    billing and exists to show the whole product.
  */
  if (!isDemoMode) {
    const membership = await getMembership();
    if (!canUseRole(membership.planId, role)) return;
  }

  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  if (!isDemoMode) {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ role }).eq("id", user.id);
        const table =
          role === "player" ? "player_profiles"
          : role === "coach" ? "coach_profiles"
          : role === "trainer" ? "trainer_profiles"
          : "club_profiles";
        // Idempotent: creates an empty profile the first time this role is used.
        await supabase.from(table).upsert({ user_id: user.id }, { onConflict: "user_id" });
      }
    }
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export interface CheckinInput {
  energy: number;
  sleep: number;
  soreness: number;
  mental: number;
  note?: string;
}

export type ActionResult = { ok: true; demo?: boolean } | { ok: false; error: string };

export async function saveCheckin(input: CheckinInput): Promise<ActionResult> {
  if (isDemoMode) return { ok: true, demo: true };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Backend unavailable." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: user.id,
      checkin_date: today,
      energy: input.energy,
      sleep: input.sleep,
      soreness: input.soreness,
      mental: input.mental,
      note: input.note ?? null,
    },
    { onConflict: "user_id,checkin_date" }
  );
  if (error) return { ok: false, error: error.message };

  /*
    The check-in is the only place a readiness figure comes from, so it
    is the one MIDO must never guess — and the log records the figure
    that was actually derived, not the four raw scores.

    Derived with `readinessOf` rather than averaged here. Three places
    computing "how ready are you" three different ways is how a product
    contradicts itself on the same morning, and this is the third place.

    Keyed by DAY. The write is an upsert — editing this morning's
    check-in is a correction, not a second check-in — so a day that was
    revised must not read as two.
  */
  const readiness = readinessOf({
    date: today,
    energy: input.energy,
    sleep: input.sleep,
    soreness: input.soreness,
    mental: input.mental,
    note: input.note ?? null,
  });

  await emitMidoEvent({
    type: "PLAYER_CHECKIN_COMPLETED",
    subjectType: "checkin",
    subjectId: today,
    occurredAt: new Date(`${today}T12:00:00.000Z`).toISOString(),
    payload: { readiness },
    idempotencyKey: idempotencyKey(["checkin", today]),
  });

  revalidatePath("/app");
  return { ok: true };
}
