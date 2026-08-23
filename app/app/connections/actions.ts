"use server";

import { revalidatePath } from "next/cache";
import {
  issueInvite,
  revokeInvite,
  previewInvite,
  acceptInvite,
  setLinkScope,
  type IssueInput,
} from "@/lib/data/connections";
import type { Invite, InvitePreview, LinkKind, ShareScope } from "@/lib/data/connection-types";

export type Result<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/app/connections");
  revalidatePath("/app/squad");
  revalidatePath("/app/athletes");
  revalidatePath("/app/staff");
  revalidatePath("/app");
}

/** Issue a code for one record. The issuer shares it however they like. */
export async function createInvite(input: IssueInput): Promise<Result<Invite>> {
  const invite = await issueInvite(input);
  if (!invite) return { ok: false, error: "Could not create an invitation." };
  revalidate();
  return { ok: true, data: invite };
}

export async function withdrawInvite(id: string): Promise<Result> {
  const ok = await revokeInvite(id);
  if (!ok) return { ok: false, error: "Could not withdraw that invitation." };
  revalidate();
  return { ok: true, message: "Invitation withdrawn. The code no longer works." };
}

export async function lookupInvite(code: string): Promise<Result<InvitePreview>> {
  const preview = await previewInvite(code);
  if (!preview) return { ok: false, error: "That code does not match an invitation." };
  if (preview.status === "expired") {
    return { ok: false, error: "That invitation has expired. Ask for a new code." };
  }
  if (preview.status !== "open") {
    return { ok: false, error: "That invitation has already been used or was withdrawn." };
  }
  return { ok: true, data: preview };
}

/** Accept a code at a chosen sharing level. The database enforces the level. */
export async function joinWithCode(code: string, scope: ShareScope): Promise<Result> {
  const res = await acceptInvite(code, scope);
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, message: `Connected. You are sharing at the "${res.scope}" level.` };
}

export async function changeScope(
  kind: LinkKind,
  id: string,
  scope: ShareScope | "none",
): Promise<Result> {
  const res = await setLinkScope(kind, id, scope);
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return {
    ok: true,
    message: res.unlinked
      ? "Disconnected. They keep their own notes, but can no longer see anything of yours."
      : "Sharing level updated.",
  };
}
