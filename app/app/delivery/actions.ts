"use server";

import { revalidatePath } from "next/cache";
import { getDeliverable, moveDeliverable } from "@/lib/data/deliverables";
import { saveClubBrand } from "@/lib/data/brand";
import { hexIssue } from "@/lib/brand/identity";
import { transitionIssue, type DeliverableStatus } from "@/lib/data/deliverable-types";

/*
  The review gate's write path.

  Every action re-reads the row and asks the state machine before writing.
  The UI already hides illegal moves — this is the layer that assumes the UI
  was wrong, or bypassed, which for a gate is the only safe assumption.
*/

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function moveDeliverableTo(
  id: string,
  to: DeliverableStatus,
  note?: string,
): Promise<ActionResult> {
  const current = await getDeliverable(id);
  if (!current) return { ok: false, error: "That deliverable no longer exists." };

  /*
    Asked here as well as inside `moveDeliverable`, because this is the layer
    that can explain WHY in words the operator can act on. The data layer
    returns a boolean; a person needs a sentence.
  */
  const issue = transitionIssue(current.status, to);
  if (issue) return { ok: false, error: issue };

  /*
    Sending work back without saying what is wrong produces a second draft
    with the same problem. The note is the whole value of the round trip.
  */
  if (to === "changes_requested" && !note?.trim()) {
    return { ok: false, error: "Say what needs changing — a note is what makes the next draft better." };
  }

  const ok = await moveDeliverable(id, to, note);
  if (!ok) return { ok: false, error: "That change could not be saved." };

  revalidatePath("/app/delivery");
  return { ok: true };
}

export async function saveBrand(input: {
  name: string;
  shortName: string;
  crestUrl: string;
  primary: string;
}): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "The club needs a name to put on the document." };

  const colourIssue = hexIssue(input.primary);
  if (colourIssue) return { ok: false, error: colourIssue };

  const ok = await saveClubBrand(input);
  if (!ok) return { ok: false, error: "The identity could not be saved." };

  revalidatePath("/app/delivery");
  return { ok: true };
}
