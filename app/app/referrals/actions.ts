"use server";

import { revalidatePath } from "next/cache";
import { applyRewards } from "@/lib/data/referrals";

export type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Spend earned months. The database does the work in one transaction —
 * `apply_referral_reward` writes the comped window and marks the rewards spent
 * together, so a crash cannot consume a reward without granting the time.
 */
export async function redeemMonths(months?: number): Promise<Result> {
  const res = await applyRewards(months);
  if (!res.ok) return { ok: false, error: res.error ?? "Could not apply your months." };
  revalidatePath("/app/referrals");
  revalidatePath("/app/membership");
  const n = res.months ?? 0;
  return {
    ok: true,
    message:
      n === 1
        ? "One month of Pro is on your account. Everything metered is unlocked."
        : `${n} months of Pro are on your account. Everything metered is unlocked.`,
  };
}
