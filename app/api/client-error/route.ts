import { NextResponse } from "next/server";

/*
  Client errors, relayed to where we can see them.

  A "use client" error boundary logs to the PLAYER'S browser console —
  which for observability purposes is /dev/null. This route re-logs the
  minimum server-side, so a founder saying "it broke on the film page
  yesterday" can be met with a log line instead of a shrug.

  Privacy is enforced by shape, not by promise: an error message and a
  Next.js digest are framework strings; the route path says WHERE, never
  what the player was writing. Nothing here accepts free text a player
  authored, and everything is truncated so this cannot become a channel
  for anything else.
*/
/*
  Flood control. The route stays unauthenticated on purpose — the errors
  most worth hearing about include "auth is broken" — but an open,
  unlimited log-writer is a log-flooding primitive. A small in-memory
  token bucket per instance caps the damage: real error bursts fit
  comfortably; a script pointed at it gets 204s that write nothing.
*/
let windowStart = 0;
let windowCount = 0;
const WINDOW_MS = 60_000;
const WINDOW_MAX = 30;

export async function POST(req: Request) {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > WINDOW_MAX) {
    return new NextResponse(null, { status: 204 });
  }
  try {
    const body = (await req.json()) as {
      digest?: string;
      message?: string;
      path?: string;
      boundary?: string;
    };

    console.error(
      "[client-error]",
      JSON.stringify({
        boundary: String(body.boundary ?? "unknown").slice(0, 40),
        path: String(body.path ?? "").slice(0, 200),
        digest: String(body.digest ?? "").slice(0, 100),
        message: String(body.message ?? "").slice(0, 500),
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // A malformed report is not worth a second error.
  }
  // Always 204: the reporter must never retry or care.
  return new NextResponse(null, { status: 204 });
}
