"use client";

import { useState } from "react";
import { Loader2, Check, Mail, Lock } from "lucide-react";
import { updatePassword, updatePrivacy } from "@/app/app/settings/actions";

export function AccountSecurity({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.ok) {
      setPassword("");
      setMsg({ ok: true, text: res.demo ? "Demo — password change not persisted." : "Password updated." });
    } else setMsg({ ok: false, text: res.error });
  };

  return (
    <div className="panel p-5">
      <label className="block">
        <span className="label-tech mb-1 block">Email</span>
        <div className="flex h-10 items-center gap-2.5 rounded-lg border border-line bg-ink-925 px-3 text-sm text-text-dim">
          <Mail className="size-4 text-text-faint" />
          {email || "—"}
        </div>
      </label>

      <label className="mt-4 block">
        <span className="label-tech mb-1 block">New password</span>
        <div className="flex h-10 items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 focus-within:border-signal-line">
          <Lock className="size-4 text-text-faint" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="h-full flex-1 bg-transparent text-sm text-text-hi placeholder:text-text-faint focus:outline-none"
          />
        </div>
      </label>

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-positive" : "text-correction"}`}>{msg.text}</p>
      )}

      <button
        onClick={save}
        disabled={busy || password.length < 8}
        className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Update password
      </button>
    </div>
  );
}

export function PrivacyToggle({ initial }: { initial: boolean }) {
  const [isPublic, setIsPublic] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    setIsPublic(next);
    setBusy(true);
    setNote(null);
    const res = await updatePrivacy(next);
    setBusy(false);
    if (!res.ok) {
      setIsPublic(!next); // revert
      setNote(res.error);
    } else if (res.demo) {
      setNote("Demo — preference not persisted.");
    }
  };

  return (
    <div className="panel flex items-start justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-medium text-text-hi">Public profile</div>
        <p className="mt-1 max-w-md text-sm text-text-dim">
          Off by default. When on, only your name, position, club, season stats and highlight
          clips can be shared — never your journal, readiness or coach feedback.
        </p>
        {note && <p className="mt-2 text-xs text-review">{note}</p>}
      </div>
      <button
        role="switch"
        aria-checked={isPublic}
        aria-label="Public profile"
        disabled={busy}
        onClick={() => toggle(!isPublic)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${isPublic ? "bg-signal" : "bg-ink-700"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
