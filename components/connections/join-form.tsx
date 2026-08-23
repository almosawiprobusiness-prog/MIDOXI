"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { lookupInvite, joinWithCode } from "@/app/app/connections/actions";
import {
  LINK_KINDS,
  SHARE_SCOPES,
  daysLeft,
  type InvitePreview,
  type ShareScope,
} from "@/lib/data/connection-types";
import { FormError, FormNote } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Redeeming a code.

  Two steps on purpose: first we say who is asking and what they will be able to
  see, then the person chooses the level. Nobody should be linked to a stranger
  without reading what that opens.
*/
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [scope, setScope] = useState<ShareScope>("development");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const look = () => {
    setError(null);
    setNote(null);
    start(async () => {
      const res = await lookupInvite(code);
      if (res.ok && res.data) setPreview(res.data);
      else if (!res.ok) {
        setPreview(null);
        setError(res.error);
      }
    });
  };

  const join = () => {
    setError(null);
    start(async () => {
      const res = await joinWithCode(code, scope);
      if (res.ok) {
        setPreview(null);
        setCode("");
        setNote(res.message ?? "Connected.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  const kind = preview ? LINK_KINDS[preview.kind] : null;
  const isStaff = preview?.kind === "club-staff";

  return (
    <div className="panel p-5">
      <div className="label-tech">Have a code?</div>
      <p className="mt-1 text-sm leading-relaxed text-text-dim">
        A coach, trainer or club can invite you to link your account to the record they keep about you.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && look()}
          placeholder="ABCD-1234"
          className="data-mono h-11 min-w-0 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-base tracking-[0.15em] text-text-hi placeholder:tracking-normal placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button
          onClick={look}
          disabled={pending || !code.trim()}
          className="flex h-11 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Check code
        </button>
      </div>

      {preview && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-signal">{kind?.label}</span>
            <span className="text-sm text-text-hi">{preview.issuerLabel || "A MIDO XI account"}</span>
            <span className="label-tech ml-auto">expires in {daysLeft(preview.expiresAt)} days</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
            They have you recorded as{" "}
            <span className="text-text-hi">{preview.label || "an unnamed record"}</span>. Linking connects
            that record to your account.
          </p>

          {isStaff ? (
            <div className="panel mt-4 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
                <p className="text-xs leading-relaxed text-text-dim">
                  Joining a club as staff shares nothing personal. It puts you on the club&rsquo;s staff
                  list and lets you read its methodology.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="label-tech mb-2">Choose what they can see</div>
              <div className="space-y-2">
                {SHARE_SCOPES.map((s) => {
                  const active = scope === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setScope(s.value)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-signal-line bg-signal/10"
                          : "border-line hover:border-line-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                          active ? "border-signal-bright" : "border-line-strong",
                        )}
                      >
                        {active && <span className="size-2 rounded-full bg-signal-bright" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-hi">{s.label}</span>
                          <span className="label-tech" style={{ color: s.color }}>
                            {s.value}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">
                          {s.summary}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {s.opens.map((o) => (
                            <span key={o} className="chip chip-prose !text-[10px]">
                              {o}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={join}
            disabled={pending}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isStaff ? "Join the club" : `Connect, sharing "${scope}"`}
          </button>
          <p className="mt-2 text-center text-[11px] text-text-faint">
            You can change this or disconnect at any time.
          </p>
        </div>
      )}

      <FormError error={error} />
      <FormNote message={note} />
    </div>
  );
}
