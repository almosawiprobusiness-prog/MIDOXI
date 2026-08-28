/*
  Never lose an observation mid-thought.

  The DRAFT is what is being typed right now, keyed to the video it is
  about, written on every input and cleared on a successful save —
  Chrome closes popups on any focus loss, and that must never cost the
  player their sentence. Recovery is bounded: a draft older than a week
  is a stale thought, not a rescue, and is discarded on read.

  (v0.1 also kept a `pending` retry queue here for failed MIDO saves.
  Free Mode replaced it: a capture that cannot reach MIDO now saves
  into the local library instead — see library.ts, which migrates any
  old pending entries on first load.)
*/
import { DRAFT_MAX_AGE_MS } from "./library-core";

const DRAFT_KEY = "draft";

export interface Draft {
  videoId: string;
  observation: string;
  goalId: string | null;
  category: string | null;
  savedAt: number;
}

export async function readDraft(videoId: string): Promise<Draft | null> {
  try {
    const { [DRAFT_KEY]: d } = await chrome.storage.local.get(DRAFT_KEY);
    if (!d || typeof d !== "object") return null;
    const draft = d as Draft;
    if (draft.videoId !== videoId || typeof draft.observation !== "string") return null;
    if (typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      void clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function writeDraft(draft: Draft): Promise<void> {
  try {
    await chrome.storage.local.set({ [DRAFT_KEY]: draft });
  } catch {
    // Draft persistence is best-effort; the textarea still has the text.
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await chrome.storage.local.remove(DRAFT_KEY);
  } catch {
    // Nothing to do — a stale draft is filtered by videoId on read.
  }
}
