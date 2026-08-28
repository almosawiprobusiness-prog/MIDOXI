/*
  The library's storage — chrome.storage.local, one versioned key.

  Small structured records (≈0.5KB each, capped at 2000 ≈ 1MB) sit far
  inside storage.local's 10MB quota, and one keyed array read/write is
  both simpler and faster than IndexedDB at this scale. Every operation
  degrades safely: a read failure is an empty library on screen, never
  a crash; a write failure REPORTS false so the UI can refuse to clear
  the player's text.

  v0.1 → v0.2 migration happens on first load: the old `pending` retry
  queue (failed MIDO saves) becomes local library entries, because Free
  Mode makes the library the single place a capture can safely wait.
*/
import {
  LIBRARY_CAP,
  migratePendingToLibrary,
  sortNewestFirst,
  type LocalCapture,
} from "./library-core";

const KEY = "library";
const VERSION_KEY = "libraryV";
const CURRENT_VERSION = 1;

export type AddResult = { ok: true; count: number } | { ok: false; reason: "full" | "storage" };

async function readRaw(): Promise<LocalCapture[]> {
  try {
    const got = await chrome.storage.local.get([KEY, VERSION_KEY, "pending"]);
    let captures: LocalCapture[] = Array.isArray(got[KEY]) ? (got[KEY] as LocalCapture[]) : [];

    if ((got[VERSION_KEY] ?? 0) < CURRENT_VERSION) {
      const migrated = migratePendingToLibrary(got["pending"], captures, new Date().toISOString());
      if (migrated.length) captures = [...migrated, ...captures];
      try {
        await chrome.storage.local.set({ [KEY]: captures, [VERSION_KEY]: CURRENT_VERSION });
        await chrome.storage.local.remove("pending");
      } catch {
        // Migration retries next open; the merged view is still served.
      }
    }
    return captures;
  } catch {
    return [];
  }
}

export async function listLibrary(): Promise<LocalCapture[]> {
  return sortNewestFirst(await readRaw());
}

async function writeAll(captures: LocalCapture[]): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [KEY]: captures, [VERSION_KEY]: CURRENT_VERSION });
    return true;
  } catch {
    return false;
  }
}

export async function addToLibrary(capture: LocalCapture): Promise<AddResult> {
  const all = await readRaw();
  if (all.some((c) => c.id === capture.id)) return { ok: true, count: all.length };
  if (all.length >= LIBRARY_CAP) return { ok: false, reason: "full" };
  const next = [capture, ...all];
  return (await writeAll(next)) ? { ok: true, count: next.length } : { ok: false, reason: "storage" };
}

export async function updateCapture(
  id: string,
  patch: Partial<Pick<LocalCapture, "observation" | "category" | "syncState" | "midoId">>,
): Promise<boolean> {
  const all = await readRaw();
  const i = all.findIndex((c) => c.id === id);
  if (i === -1) return false;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  return writeAll(all);
}

export async function removeFromLibrary(id: string): Promise<LocalCapture | null> {
  const all = await readRaw();
  const gone = all.find((c) => c.id === id) ?? null;
  if (!gone) return null;
  return (await writeAll(all.filter((c) => c.id !== id))) ? gone : null;
}

/** Undo support: put a just-deleted capture back where it was. */
export async function restoreToLibrary(capture: LocalCapture): Promise<boolean> {
  const all = await readRaw();
  if (all.some((c) => c.id === capture.id)) return true;
  return writeAll(sortNewestFirst([capture, ...all]));
}

export async function clearLibrary(): Promise<boolean> {
  return writeAll([]);
}

export async function libraryCount(): Promise<number> {
  return (await readRaw()).length;
}

/* ── small one-off flags (milestones, import-banner dismissal) ── */

export async function getFlag<T>(name: string): Promise<T | undefined> {
  try {
    const got = await chrome.storage.local.get(name);
    return got[name] as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setFlag(name: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [name]: value });
  } catch {
    // A lost flag re-shows a milestone once; harmless.
  }
}
