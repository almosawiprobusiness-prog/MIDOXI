"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, Loader2, X } from "lucide-react";
import { createInvite, withdrawInvite } from "@/app/app/connections/actions";
import { daysLeft, type Invite, type LinkKind } from "@/lib/data/connection-types";
import { Modal, FormError } from "@/components/forms/ui";

/*
  Issuing an invitation.

  The code is deliberately short and speakable — a coach reads it out at
  training. It expires in fourteen days and can be withdrawn, and it grants
  nothing on its own: the person accepting chooses what they share.
*/
export function InviteButton({
  kind,
  targetTable,
  targetId,
  label,
  issuerLabel,
  compact,
}: {
  kind: LinkKind;
  targetTable: "coach_players" | "trainer_athletes" | "org_staff";
  targetId: string;
  label: string;
  issuerLabel: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const issue = () => {
    setError(null);
    start(async () => {
      const res = await createInvite({ kind, targetTable, targetId, label, issuerLabel });
      if (res.ok && res.data) {
        setInvite(res.data);
        router.refresh();
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  };

  const openDialog = () => {
    setOpen(true);
    setInvite(null);
    setCopied(false);
    issue();
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the code and copy it manually.");
    }
  };

  const withdraw = () => {
    if (!invite) return;
    start(async () => {
      const res = await withdrawInvite(invite.id);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <button
        onClick={openDialog}
        className={
          compact
            ? "flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
            : "flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        }
        aria-label="Invite to link their account"
      >
        <Link2 className="size-4" />
        {!compact && "Invite"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Account linking"
        title={`Invite ${label}`}
      >
        <p className="text-sm leading-relaxed text-text-dim">
          Give them this code. When they enter it in MIDO XI, they choose what to share with you — and
          they can change or end it at any time.
        </p>

        <div className="panel-raised relative mt-4 overflow-hidden">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative p-6 text-center">
            {pending && !invite ? (
              <Loader2 className="mx-auto size-6 animate-spin text-signal-bright" />
            ) : invite ? (
              <>
                <div className="stat-figure select-all text-3xl tracking-[0.2em] text-text-hi">
                  {invite.code}
                </div>
                <div className="label-tech mt-2">
                  Expires in {daysLeft(invite.expiresAt)} days
                </div>
              </>
            ) : (
              <div className="text-sm text-text-dim">No code yet.</div>
            )}
          </div>
        </div>

        {invite && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={copy}
              className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy code"}
            </button>
            <button
              onClick={withdraw}
              disabled={pending}
              className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-correction/40 hover:text-correction disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Withdraw
            </button>
          </div>
        )}

        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-text-faint">
          A code by itself gives you nothing. What you can see is decided by them when they accept, and
          enforced by the database — not by this interface.
        </p>

        <FormError error={error} />
      </Modal>
    </>
  );
}
