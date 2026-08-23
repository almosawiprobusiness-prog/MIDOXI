"use server";

import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { createShare, listShares, revokeShare } from "@/lib/reports/shares";
import { clampExpiryDays, shareUrl, type ShareKind } from "@/lib/reports/share-types";
import type { ReportField } from "@/lib/reports/fields";

/*
  Making and withdrawing share links.

  The player is the only one who can do either. There is no path here for a
  coach, for staff, or for MIDO — a link is a disclosure of a young person's
  record, and the only defensible design is that it is made deliberately by the
  person it is about.
*/

export type ShareResult = { ok: true; url: string } | { ok: false; error: string };

export async function shareReport(input: {
  kind: ShareKind;
  ref: string;
  fields: ReportField[];
  days: number;
}): Promise<ShareResult> {
  if (!input.ref) return { ok: false, error: "There is nothing to share yet." };

  const share = await createShare({
    kind: input.kind,
    ref: input.ref,
    // Frozen here, from what was on screen. Not read back from the player's
    // defaults later, which could widen a link that is already out there.
    fields: input.fields,
    days: clampExpiryDays(input.days),
  });
  if (!share) return { ok: false, error: "The link could not be created." };

  revalidatePath("/app/reports");
  return { ok: true, url: shareUrl(env.appUrl, share.token) };
}

export async function withdrawShare(id: string): Promise<{ ok: boolean; error?: string }> {
  const ok = await revokeShare(id);
  if (!ok) return { ok: false, error: "It could not be withdrawn." };
  revalidatePath("/app/reports");
  return { ok: true };
}

/** Every link this player has made, live or not. */
export async function myShares() {
  const shares = await listShares();
  return shares.map((s) => ({ ...s, url: shareUrl(env.appUrl, s.token) }));
}
