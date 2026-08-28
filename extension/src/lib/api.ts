/*
  The MIDO XI API, as the popup sees it.

  Every request carries `credentials: "include"`: the player's existing
  MIDO XI session cookies are the whole auth model. The extension never
  sees, stores, or forwards a credential of its own — being signed in
  to MIDO XI in this browser IS being signed in here. A 401 is a state
  ("Connect MIDO XI"), not an error.

  Responses are treated as untrusted input: shapes are checked before
  use, strings are bounded, and nothing from the network is ever
  rendered as HTML.
*/
import { apiBase } from "./config";
import type { CaptureInput } from "../../../lib/data/capture-types";

export interface SessionGoal {
  id: string;
  title: string;
  category: string;
}

export type SessionState =
  | { kind: "connected"; name: string | null; goals: SessionGoal[]; appUrl: string; demo: boolean }
  | { kind: "signed-out" }
  | { kind: "offline" }
  | { kind: "error"; message: string };

function asGoals(v: unknown): SessionGoal[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (g): g is { id: string; title: string; category?: string } =>
        !!g && typeof g === "object" &&
        typeof (g as { id?: unknown }).id === "string" &&
        typeof (g as { title?: unknown }).title === "string",
    )
    .slice(0, 12)
    .map((g) => ({
      id: g.id,
      title: String(g.title).slice(0, 120),
      category: typeof g.category === "string" ? g.category : "",
    }));
}

export async function fetchSession(): Promise<SessionState> {
  const base = await apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/api/extension/session`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { kind: "offline" };
  }

  if (res.status === 401) return { kind: "signed-out" };
  if (!res.ok) return { kind: "error", message: `MIDO XI answered ${res.status}.` };

  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (body.authenticated !== true) return { kind: "signed-out" };
    const user = (body.user ?? {}) as { name?: unknown };
    return {
      kind: "connected",
      name: typeof user.name === "string" ? user.name.slice(0, 80) : null,
      goals: asGoals(body.goals),
      appUrl: typeof body.appUrl === "string" ? body.appUrl : base,
      demo: body.demo === true,
    };
  } catch {
    return { kind: "error", message: "Unexpected response from MIDO XI." };
  }
}

export type SaveState =
  | { kind: "saved"; id: string; openUrl: string; deduped: boolean }
  | { kind: "signed-out" }
  | { kind: "offline" }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string };

export async function postCapture(input: CaptureInput): Promise<SaveState> {
  const base = await apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/api/extension/captures`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: "offline" };
  }

  if (res.status === 401) return { kind: "signed-out" };

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // A body-less error still reports by status below.
  }

  if (res.ok && body.ok === true && typeof body.id === "string") {
    return {
      kind: "saved",
      id: body.id,
      openUrl: typeof body.openUrl === "string" ? body.openUrl : base,
      deduped: body.deduped === true,
    };
  }

  const message =
    typeof body.error === "string" && body.error
      ? body.error.slice(0, 200)
      : `Save failed (${res.status}).`;
  // 4xx = the capture itself was refused; retrying unchanged will not help.
  return res.status >= 400 && res.status < 500
    ? { kind: "rejected", message }
    : { kind: "error", message };
}
