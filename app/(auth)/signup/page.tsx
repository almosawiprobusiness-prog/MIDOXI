import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getAuthProviders } from "@/lib/auth/providers";
import { isPlausibleReferralCode, normaliseReferralCode, REWARD } from "@/lib/data/referral-types";

export const metadata = { title: "Create your profile — MIDO XI" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // Someone who arrived on a referral link is told so before they sign up,
  // rather than discovering afterwards that a code was riding along.
  const [params, providers] = await Promise.all([searchParams, getAuthProviders()]);
  const raw = params.ref;
  const ref = typeof raw === "string" ? normaliseReferralCode(raw) : "";
  const referred = isPlausibleReferralCode(ref);

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="label-tech mb-1">Step 01 · Create account</div>
        <h1 className="font-display text-xl font-semibold text-text-hi">
          Start your football system
        </h1>
        <p className="mt-1 text-sm text-text-dim">
          Next you&rsquo;ll pick a role and build your profile.
        </p>
      </div>

      {referred && (
        <div className="mb-5 rounded-lg border border-signal-line bg-signal/10 px-4 py-3 text-center">
          <p className="text-sm text-signal-bright">
            You were invited with code <span className="font-mono font-semibold">{ref}</span>.
          </p>
          <p className="mt-0.5 text-xs text-text-dim">
            Your first paid month comes with {REWARD.monthsForJoiner} free
            {REWARD.monthsForJoiner === 1 ? " month" : " months"} — and earns the person who sent
            you one too.
          </p>
        </div>
      )}
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-ink-850" />}>
        <AuthForm mode="signup" googleEnabled={providers.google} />
      </Suspense>
    </div>
  );
}
