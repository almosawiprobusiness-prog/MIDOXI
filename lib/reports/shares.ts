import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { ReportField } from "./fields";
import {
  clampExpiryDays,
  isServable,
  type ReportShare,
  type ShareKind,
} from "./share-types";

/*
  Creating, listing, revoking and resolving share links.

  The important line in this file is the one between `listShares` — which runs
  as the signed-in player and is protected by RLS — and `resolveShare`, which
  runs as the service role because the reader is not signed in as anyone.

  `resolveShare` is the only place in MIDO XI where an unauthenticated request
  causes a privileged read, so it is written to be boring: one lookup by token,
  one liveness check, and it returns the narrowest possible object. It never
  returns the row, never returns the user's id to the caller's page props, and
  never trusts anything but the token it was given.
*/

function rowTo(r: Record<string, unknown>): ReportShare {
  return {
    id: String(r.id),
    token: String(r.token),
    kind: r.kind as ShareKind,
    ref: String(r.ref),
    fields: ((r.fields as string[]) ?? []) as ReportField[],
    expiresAt: String(r.expires_at),
    revokedAt: (r.revoked_at as string) ?? null,
    views: Number(r.views ?? 0),
    lastViewedAt: (r.last_viewed_at as string) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

/**
 * 24 random bytes, base64url — 192 bits.
 *
 * Not `randomUUID`, which is 122 bits and formatted in a way people assume is
 * an identifier they can reason about. Nothing here is derived from the player:
 * a token containing a name or a date would leak through any log that records
 * a URL, and URLs are recorded everywhere.
 */
function mintToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

interface DemoDB {
  rows: ReportShare[];
}
const g = globalThis as unknown as { __midoShareDB?: DemoDB };
const demoDB: DemoDB = (g.__midoShareDB ??= { rows: [] });

export async function listShares(): Promise<ReportShare[]> {
  if (isDemoMode) return [...demoDB.rows];

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("report_shares")
    .select("id, token, kind, ref, fields, expires_at, revoked_at, views, last_viewed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(rowTo);
}

export async function createShare(input: {
  kind: ShareKind;
  ref: string;
  fields: ReportField[];
  days: number;
}): Promise<ReportShare | null> {
  const days = clampExpiryDays(input.days);
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  const token = mintToken();

  if (isDemoMode) {
    const row: ReportShare = {
      id: `sh${demoDB.rows.length + 1}`,
      token,
      kind: input.kind,
      ref: input.ref,
      fields: input.fields,
      expiresAt: expires,
      revokedAt: null,
      views: 0,
      lastViewedAt: null,
      createdAt: new Date().toISOString(),
    };
    demoDB.rows.unshift(row);
    return row;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("report_shares")
    .insert({
      user_id: user.id,
      token,
      kind: input.kind,
      ref: input.ref,
      // Frozen at creation. A later change to the player's defaults must not
      // widen a link that is already out there.
      fields: input.fields,
      expires_at: expires,
    })
    .select("id, token, kind, ref, fields, expires_at, revoked_at, views, last_viewed_at, created_at")
    .maybeSingle();

  return data ? rowTo(data) : null;
}

/**
 * Stop a link working, immediately and permanently.
 *
 * Revoked rather than deleted: the player asked "who has seen this", and a row
 * that is gone cannot answer. It stops serving either way.
 */
export async function revokeShare(id: string): Promise<boolean> {
  if (isDemoMode) {
    const row = demoDB.rows.find((r) => r.id === id);
    if (!row) return false;
    row.revokedAt = new Date().toISOString();
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

// ---------------------------------------------------------------------------
// The public side
// ---------------------------------------------------------------------------

export interface ResolvedShare {
  /** Whose report this is. Used to read their data — never rendered as an id. */
  userId: string;
  kind: ShareKind;
  ref: string;
  fields: ReportField[];
  expiresAt: string;
}

/**
 * Turn a token into permission to read one report.
 *
 * The only privileged read in the product triggered by an unauthenticated
 * request, so it does as little as possible: look up the token, check it is
 * live, hand back the narrowest object that lets the page render.
 *
 * Returns null for absent, expired and revoked alike. The reader is told the
 * link is not valid and nothing more — distinguishing "expired" from "never
 * existed" would confirm to a stranger that a token they guessed was once
 * real.
 */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  if (!token || token.length < 20 || token.length > 100) return null;

  if (isDemoMode) {
    const row = demoDB.rows.find((r) => r.token === token);
    return row && isServable(row)
      ? { userId: "demo", kind: row.kind, ref: row.ref, fields: row.fields, expiresAt: row.expiresAt }
      : null;
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("report_shares")
    .select("user_id, kind, ref, fields, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;
  if (!isServable({ expiresAt: String(data.expires_at), revokedAt: (data.revoked_at as string) ?? null })) {
    return null;
  }

  return {
    userId: String(data.user_id),
    kind: data.kind as ShareKind,
    ref: String(data.ref),
    fields: ((data.fields as string[]) ?? []) as ReportField[],
    expiresAt: String(data.expires_at),
  };
}

/**
 * Note that somebody opened it.
 *
 * Best-effort and deliberately after the render decision: a failure to count a
 * view must never stop a coach reading the report.
 */
export async function countShareView(token: string): Promise<void> {
  if (isDemoMode) return;
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.rpc("record_share_view", { p_token: token });
  } catch {
    // A view counter is not worth an error page.
  }
}
