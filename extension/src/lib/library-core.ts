/*
  The local capture library — pure logic, no chrome.*, no DOM.

  Free Mode's whole promise is that a capture belongs to the person who
  wrote it: stored on their machine, searchable, exportable, deletable,
  and — only if they choose — importable into MIDO XI. Everything that
  can be reasoned about without a browser lives here so the unit tests
  can hold it still; the thin chrome.storage wrapper is library.ts.
*/
import {
  captureCategoryLabel,
  formatTimestamp,
  timestampedYoutubeUrl,
  type CaptureCategory,
  type CaptureInput,
} from "../../../lib/data/capture-types";

/** One locally-owned capture. `id` doubles as the import client key. */
export interface LocalCapture {
  id: string;
  videoId: string;
  sourceUrl: string;
  videoTitle: string;
  channelName: string | null;
  thumbnailUrl: string | null;
  timestampSeconds: number;
  observation: string;
  category: CaptureCategory | null;
  createdAt: string;
  updatedAt: string | null;
  /** local = only on this device; synced = also exists in MIDO XI. */
  syncState: "local" | "synced";
  midoId?: string;
  origin: "chrome_extension";
}

/**
 * Bounded on purpose. 2000 small records is years of serious use; past
 * it, adding REFUSES loudly rather than silently trimming someone's
 * oldest notes — quiet data loss is the one sin a notes tool cannot
 * commit. Export exists precisely so the ceiling is never a wall.
 */
export const LIBRARY_CAP = 2000;

/** Drafts older than this are stale thoughts, not recoveries. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/* ── search / filter ───────────────────────────────────────── */

export interface LibraryQuery {
  text?: string;
  category?: CaptureCategory | null;
}

/**
 * Plain substring search over title, observation, channel and category
 * label — case-insensitive, every term must match somewhere. Immediate
 * and predictable beats clever: nobody wants fuzzy ranking over their
 * own twelve notes.
 */
export function filterCaptures(captures: LocalCapture[], q: LibraryQuery): LocalCapture[] {
  const terms = (q.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return captures.filter((c) => {
    if (q.category && c.category !== q.category) return false;
    if (terms.length === 0) return true;
    const haystack = [
      c.videoTitle,
      c.observation,
      c.channelName ?? "",
      c.category ? captureCategoryLabel(c.category) : "",
    ]
      .join("\n")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

export function sortNewestFirst(captures: LocalCapture[]): LocalCapture[] {
  return [...captures].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** "Today" / "Yesterday" / "26 Aug" / "26 Aug 2025" — relative to now. */
export function dateLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (day(d) === day(now)) return "Today";
  if (day(d) === day(yesterday)) return "Yesterday";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/* ── formatting: copy + export ─────────────────────────────── */

/** The clipboard shape for one moment — plain text, human-first. */
export function formatCaptureText(c: LocalCapture): string {
  const lines = [
    c.videoTitle,
    formatTimestamp(c.timestampSeconds),
    "",
    "Observation:",
    c.observation,
  ];
  if (c.category) lines.push("", "Category:", captureCategoryLabel(c.category));
  lines.push("", "Watch:", timestampedYoutubeUrl(c.videoId, c.timestampSeconds));
  return lines.join("\n");
}

/** The whole library as one readable Markdown document. */
export function formatLibraryMarkdown(captures: LocalCapture[], now: Date = new Date()): string {
  const parts = [
    "# MIDO XI Capture Export",
    "",
    `Exported ${now.toISOString().slice(0, 10)} · ${captures.length} moment${captures.length === 1 ? "" : "s"}`,
    "",
  ];
  for (const c of sortNewestFirst(captures)) {
    parts.push(
      `## ${c.videoTitle}`,
      "",
      `Timestamp: ${formatTimestamp(c.timestampSeconds)}`,
      ...(c.category ? [`Category: ${captureCategoryLabel(c.category)}`] : []),
      ...(c.channelName ? [`Source: ${c.channelName}`] : []),
      `Captured: ${c.createdAt.slice(0, 10)}`,
      "",
      c.observation,
      "",
      `Watch: ${timestampedYoutubeUrl(c.videoId, c.timestampSeconds)}`,
      "",
      "---",
      "",
    );
  }
  return parts.join("\n");
}

/** JSON export — portability/backup, secondary to Markdown. */
export function formatLibraryJson(captures: LocalCapture[]): string {
  return JSON.stringify({ app: "MIDO XI Capture", version: 1, captures: sortNewestFirst(captures) }, null, 2);
}

/* ── import to MIDO ────────────────────────────────────────── */

/** The wire shape for importing one local capture. id → clientKey, so a
 *  re-import of the same moment dedupes server-side instead of doubling. */
export function toCaptureInput(c: LocalCapture): CaptureInput {
  return {
    videoId: c.videoId,
    sourceUrl: c.sourceUrl,
    videoTitle: c.videoTitle,
    channelName: c.channelName,
    thumbnailUrl: c.thumbnailUrl,
    timestampSeconds: c.timestampSeconds,
    observation: c.observation,
    category: c.category,
    goalId: null,
    clientKey: c.id,
  };
}

export function pendingImport(captures: LocalCapture[]): LocalCapture[] {
  return captures.filter((c) => c.syncState === "local");
}

/* ── migration ─────────────────────────────────────────────── */

/**
 * v0.1 kept failed MIDO saves in a `pending` retry queue. Free Mode
 * makes the library the one store, so old pending entries become local
 * captures — nothing a player wrote is dropped by an upgrade.
 */
export function migratePendingToLibrary(
  pending: unknown,
  existing: LocalCapture[],
  nowIso: string,
): LocalCapture[] {
  if (!Array.isArray(pending)) return [];
  const seen = new Set(existing.map((c) => c.id));
  const out: LocalCapture[] = [];
  for (const raw of pending) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Partial<CaptureInput>;
    if (typeof p.videoId !== "string" || typeof p.observation !== "string" || !p.observation.trim()) continue;
    const id = typeof p.clientKey === "string" && p.clientKey ? p.clientKey : cryptoRandomId();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      videoId: p.videoId,
      sourceUrl: typeof p.sourceUrl === "string" ? p.sourceUrl : `https://www.youtube.com/watch?v=${p.videoId}`,
      videoTitle: typeof p.videoTitle === "string" && p.videoTitle ? p.videoTitle : "Untitled video",
      channelName: typeof p.channelName === "string" ? p.channelName : null,
      thumbnailUrl: typeof p.thumbnailUrl === "string" ? p.thumbnailUrl : null,
      timestampSeconds: typeof p.timestampSeconds === "number" && Number.isFinite(p.timestampSeconds) ? p.timestampSeconds : 0,
      observation: p.observation,
      category: (p.category as CaptureCategory) ?? null,
      createdAt: nowIso,
      updatedAt: null,
      syncState: "local",
      origin: "chrome_extension",
    });
  }
  return out;
}

/** crypto.randomUUID where present (browser/node), fallback for tests. */
export function cryptoRandomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
