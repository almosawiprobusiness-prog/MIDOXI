"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDemoMode, env } from "@/lib/env";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: Mode;
  /**
   * Read from the project's own `/auth/v1/settings`. The button is not rendered
   * unless Google is genuinely enabled — a sign-in button that errors is worse
   * than one fewer way in.
   */
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const supabase = createClient();
    if (!supabase) {
      setNotice(
        "Demo mode is active — connect Supabase to create real accounts. You can explore the demo locker in the meantime."
      );
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${env.appUrl}/auth/callback?next=/onboarding` },
        });
        if (error) throw error;
        setNotice(
          "Check your email to confirm your account, then continue to build your football profile."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const supabase = createClient();
    if (!supabase) {
      setNotice("Demo mode is active — Google sign-in activates once Supabase is connected.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {googleEnabled && (
        <>
          <button
            onClick={google}
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-ink-850 text-sm font-medium text-text-hi transition-colors hover:border-signal-line disabled:opacity-60"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="label-tech">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        <Field
          icon={<Mail className="size-4" />}
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          icon={<Lock className="size-4" />}
          type="password"
          placeholder={mode === "signup" ? "Create a password" : "Password"}
          value={password}
          onChange={setPassword}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />

        {mode === "login" && (
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-text-dim hover:text-text-hi">
              Forgot password?
            </Link>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-signal-line bg-signal/10 px-3 py-2 text-sm text-signal-bright">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {mode === "signup" ? "Create account" : "Log in"}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      {isDemoMode && (
        <Link
          href="/app"
          className="mt-4 flex items-center justify-center rounded-lg border border-line py-2.5 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          Skip — explore the demo locker
        </Link>
      )}

      <p className="mt-6 text-center text-sm text-text-dim">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-signal-bright hover:underline">Log in</Link>
          </>
        ) : (
          <>
            New to MIDO?{" "}
            <Link href="/signup" className="text-signal-bright hover:underline">Create a profile</Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="flex h-11 items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 focus-within:border-signal-line">
      <span className="text-text-faint">{icon}</span>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-full flex-1 bg-transparent text-sm text-text-hi placeholder:text-text-faint focus:outline-none"
      />
    </label>
  );
}

function GoogleGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
