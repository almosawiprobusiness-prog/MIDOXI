"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";

/*
  Triage, admin-only.

  Players insert feedback and can do nothing else with it — no policy
  lets them read or update the table, so this runs through the service
  role. Which means the admin check here is the ONLY thing standing
  between a signed-in player and every founder's reports, and it is
  therefore the first line of the function rather than a wrapper
  somebody could forget to apply.
*/

export type TriageResult = { ok: true } | { ok: false; error: string };

const STATUSES = ["new", "investigating", "planned", "fixed", "not_planned"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export async function triageFeedback(input: {
  id: string;
  status?: (typeof STATUSES)[number];
  severity?: (typeof SEVERITIES)[number];
}): Promise<TriageResult> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { ok: false, error: "Not permitted." };

  // Validated against the catalogue rather than trusted: this string
  // reaches a check constraint, and a rejected write here would be a
  // 500 on a dashboard instead of a refusal.
  if (input.status && !STATUSES.includes(input.status)) {
    return { ok: false, error: "Unknown status." };
  }
  if (input.severity && !SEVERITIES.includes(input.severity)) {
    return { ok: false, error: "Unknown severity." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Service key not configured." };

  const patch: Record<string, unknown> = { triaged_at: new Date().toISOString() };
  if (input.status) patch.status = input.status;
  if (input.severity) patch.severity = input.severity;

  const { error } = await admin.from("beta_feedback").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/admin/beta");
  return { ok: true };
}
