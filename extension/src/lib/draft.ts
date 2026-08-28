/*
  Never lose an observation.

  Two kinds of local state, both in chrome.storage.local, both small,
  both disposable once MIDO XI has the data:

  · DRAFT — what is being typed right now, keyed to the video it is
    about. Written on every input, cleared on successful save. Closing
    the popup mid-thought (which Chrome does on any focus loss) costs
    nothing.

  · PENDING — captures whose save FAILED. The full validated payload,
    including its clientKey, so a retry after connectivity returns is
    idempotent end to end. Capped: this is a safety net for a bad
    minute on a train, not an offline sync engine.

  Observation text lives only on this device, only until it reaches
  MIDO XI, and is never sent anywhere else.
*/
import type { CaptureInput } from "../../../lib/data/capture-types";

const DRAFT_KEY = "draft";
const PENDING_KEY = "pending";
export const PENDING_CAP = 5;

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
    return draft.videoId === videoId && typeof draft.observation === "string" ? draft : null;
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

export async function listPending(): Promise<CaptureInput[]> {
  try {
    const { [PENDING_KEY]: p } = await chrome.storage.local.get(PENDING_KEY);
    return Array.isArray(p) ? (p as CaptureInput[]).slice(0, PENDING_CAP) : [];
  } catch {
    return [];
  }
}

export async function pushPending(input: CaptureInput): Promise<void> {
  try {
    const existing = await listPending();
    // Same clientKey = same capture attempt; replace, don't duplicate.
    const rest = existing.filter((p) => !input.clientKey || p.clientKey !== input.clientKey);
    await chrome.storage.local.set({ [PENDING_KEY]: [input, ...rest].slice(0, PENDING_CAP) });
  } catch {
    // Worst case the retry chip undercounts; the current popup still
    // holds the text on screen.
  }
}

export async function removePending(clientKey: string | null | undefined): Promise<void> {
  if (!clientKey) return;
  try {
    const existing = await listPending();
    await chrome.storage.local.set({
      [PENDING_KEY]: existing.filter((p) => p.clientKey !== clientKey),
    });
  } catch {
    // A cleared-on-server pending row deduplicates harmlessly on retry.
  }
}
