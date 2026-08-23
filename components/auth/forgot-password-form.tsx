"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Demo mode — password reset activates once Supabase is connected.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.appUrl}/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <p className="rounded-lg border border-signal-line bg-signal/10 px-3 py-3 text-sm text-signal-bright">
        If an account exists for <span className="text-text-hi">{email}</span>, a reset
        link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 focus-within:border-signal-line">
        <Mail className="size-4 text-text-faint" />
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
      </button>
      <Link href="/login" className="block text-center text-sm text-text-dim hover:text-text-hi">
        Back to log in
      </Link>
    </form>
  );
}
