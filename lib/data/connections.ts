import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import {
  generateCode,
  normaliseCode,
  type Connection,
  type Invite,
  type InvitePreview,
  type InviteStatus,
  type LinkKind,
  type ShareScope,
} from "./connection-types";

/*
  Connections data access.

  Real mode goes through the security-definer functions in migration 0009:
  `preview_invite`, `accept_invite` and `set_link_scope`. That is deliberate —
  the accepting player must not be able to write to a coach's rows directly, and
  a coach must not be able to widen their own access. The database decides.

  Demo mode keeps the same shapes in memory so the whole flow can be walked
  through without a backend. It is one identity, so accepting your own code is
  allowed there and labelled as a demonstration.
*/

interface DemoConnectionsDB {
  invites: Invite[];
  /** Links the demo identity has accepted, as the linked person sees them. */
  connections: Connection[];
  seq: number;
}

const g = globalThis as unknown as { __midoConnDB?: DemoConnectionsDB };
const demoDB: DemoConnectionsDB = (g.__midoConnDB ??= { invites: [], connections: [], seq: 1 });

// ── issuing ──────────────────────────────────────────────────

export interface IssueInput {
  kind: LinkKind;
  targetTable: "coach_players" | "trainer_athletes" | "org_staff";
  targetId: string;
  /** How the issuer has this person recorded — shown to whoever holds the code. */
  label: string;
  /** Who is inviting: "Northgate FC · First team". */
  issuerLabel: string;
}

export async function issueInvite(input: IssueInput): Promise<Invite | null> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 14 * 864e5).toISOString();

  if (isDemoMode) {
    const invite: Invite = {
      id: `iv${demoDB.seq++}`,
      code,
      kind: input.kind,
      label: input.label,
      issuerLabel: input.issuerLabel,
      status: "open",
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    demoDB.invites.push(invite);
    return invite;
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;

  const { data, error } = await supabase
    .from("invites")
    .insert({
      code,
      kind: input.kind,
      issued_by: user.id,
      target_table: input.targetTable,
      target_id: input.targetId,
      label: input.label,
      issuer_label: input.issuerLabel,
      expires_at: expiresAt,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToInvite(data);
}

function rowToInvite(r: Record<string, unknown>): Invite {
  return {
    id: r.id as string,
    code: r.code as string,
    kind: (r.kind as LinkKind) ?? "coach-player",
    label: (r.label as string) ?? "",
    issuerLabel: (r.issuer_label as string) ?? "",
    status: (r.status as InviteStatus) ?? "open",
    expiresAt: (r.expires_at as string) ?? new Date().toISOString(),
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/** Invites this user has issued for one record. */
export async function listInvitesFor(targetId: string): Promise<Invite[]> {
  if (isDemoMode) {
    return demoDB.invites.filter((i) => i.label && i.status !== "revoked" && i.id).slice(-5).reverse();
  }
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("invites")
    .select("*")
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []).map(rowToInvite);
}

export async function revokeInvite(id: string): Promise<boolean> {
  if (isDemoMode) {
    const invite = demoDB.invites.find((i) => i.id === id);
    if (!invite) return false;
    invite.status = "revoked";
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("invites").update({ status: "revoked" }).eq("id", id);
  return !error;
}

// ── redeeming ────────────────────────────────────────────────

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const clean = normaliseCode(code);
  if (!clean) return null;

  if (isDemoMode) {
    const invite = demoDB.invites.find((i) => i.code === clean);
    if (!invite) return null;
    return {
      kind: invite.kind,
      label: invite.label,
      issuerLabel: invite.issuerLabel,
      status: invite.status,
      expiresAt: invite.expiresAt,
    };
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("preview_invite", { p_code: clean });
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    kind: row.kind as LinkKind,
    label: (row.label as string) ?? "",
    issuerLabel: (row.issuerLabel as string) ?? "",
    status: (row.status as InviteStatus) ?? "open",
    expiresAt: (row.expiresAt as string) ?? new Date().toISOString(),
  };
}

export type AcceptResult =
  | { ok: true; kind: LinkKind; label: string; scope: ShareScope }
  | { ok: false; error: string };

export async function acceptInvite(code: string, scope: ShareScope): Promise<AcceptResult> {
  const clean = normaliseCode(code);

  if (isDemoMode) {
    const invite = demoDB.invites.find((i) => i.code === clean);
    if (!invite) return { ok: false, error: "That code does not match an invitation." };
    if (invite.status !== "open") {
      return { ok: false, error: "That invitation has already been used or was withdrawn." };
    }
    invite.status = "accepted";
    demoDB.connections.push({
      id: `cn${demoDB.seq++}`,
      kind: invite.kind,
      holder: invite.issuerLabel,
      label: invite.label,
      scope: invite.kind === "club-staff" ? null : scope,
      createdAt: new Date().toISOString(),
    });
    return { ok: true, kind: invite.kind, label: invite.label, scope };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Backend unavailable." };
  const { data, error } = await supabase.rpc("accept_invite", { p_code: clean, p_scope: scope });
  if (error) return { ok: false, error: error.message };

  const row = (data ?? {}) as Record<string, unknown>;
  if (!row.ok) return { ok: false, error: (row.error as string) ?? "Could not accept that invitation." };
  return {
    ok: true,
    kind: row.kind as LinkKind,
    label: (row.label as string) ?? "",
    scope: (row.scope as ShareScope) ?? scope,
  };
}

// ── the linked person's view ─────────────────────────────────

export async function listMyConnections(): Promise<Connection[]> {
  if (isDemoMode) return [...demoDB.connections].reverse();

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!supabase || !user) return [];

  const [{ data: coaches }, { data: trainers }, { data: staff }] = await Promise.all([
    supabase.from("coach_players").select("id, display_name, position, share_scope, created_at").eq("player_id", user.id),
    supabase.from("trainer_athletes").select("id, display_name, position, share_scope, created_at").eq("athlete_id", user.id),
    supabase.from("org_staff").select("id, display_name, staff_role, created_at").eq("member_id", user.id),
  ]);

  const out: Connection[] = [];
  for (const r of coaches ?? []) {
    out.push({
      id: r.id as string,
      kind: "coach-player",
      holder: "Your coach",
      label: [r.display_name, r.position].filter(Boolean).join(" · "),
      scope: (r.share_scope as ShareScope) ?? "identity",
      createdAt: (r.created_at as string) ?? new Date().toISOString(),
    });
  }
  for (const r of trainers ?? []) {
    out.push({
      id: r.id as string,
      kind: "trainer-athlete",
      holder: "Your trainer",
      label: [r.display_name, r.position].filter(Boolean).join(" · "),
      scope: (r.share_scope as ShareScope) ?? "identity",
      createdAt: (r.created_at as string) ?? new Date().toISOString(),
    });
  }
  for (const r of staff ?? []) {
    out.push({
      id: r.id as string,
      kind: "club-staff",
      holder: "Your club",
      label: [r.display_name, r.staff_role].filter(Boolean).join(" · "),
      scope: null,
      createdAt: (r.created_at as string) ?? new Date().toISOString(),
    });
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type ScopeResult = { ok: true; unlinked?: boolean } | { ok: false; error: string };

/** Change what a link shares, or end it. Only ever called by the linked person. */
export async function setLinkScope(
  kind: LinkKind,
  id: string,
  scope: ShareScope | "none",
): Promise<ScopeResult> {
  if (isDemoMode) {
    const conn = demoDB.connections.find((c) => c.id === id);
    if (!conn) return { ok: false, error: "That connection no longer exists." };
    if (scope === "none") {
      demoDB.connections = demoDB.connections.filter((c) => c.id !== id);
      return { ok: true, unlinked: true };
    }
    conn.scope = scope;
    return { ok: true };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Backend unavailable." };
  const { data, error } = await supabase.rpc("set_link_scope", {
    p_kind: kind,
    p_id: id,
    p_scope: scope,
  });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (!row.ok) return { ok: false, error: (row.error as string) ?? "Could not update that connection." };
  return { ok: true, unlinked: Boolean(row.unlinked) };
}
