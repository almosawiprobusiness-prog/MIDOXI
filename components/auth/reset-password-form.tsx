"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Demo mode — password reset activates once Supabase is connected.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setDone(true);
      setTimeout(() => router.push("/app"), 1200);
    }
  };

  if (done) {
    return (
      <p className="rounded-lg border border-positive/30 bg-positive/10 px-3 py-3 text-sm text-positive">
        Password updated. Taking you into MIDO…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 focus-within:border-signal-line">
        <Lock className="size-4 text-text-faint" />
        <input
          type="password"
          required
          minLength={8}
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="h-full flex-1 bg-transparent text-sm text-text-hi placeholder:text-text-faint focus:outline-none"
        />
      </label>
      {error && (
        <p className="rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
      </button>
    </form>
  );
}
