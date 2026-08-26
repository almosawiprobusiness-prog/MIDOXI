import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { claimReferralFromCookie } from "@/lib/data/referral-claim";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata = { title: "Build your profile — MIDO XI" };

export default async function OnboardingPage() {
  let initialName = "";
  let referred = false;

  if (!isDemoMode) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (user.onboardingComplete) redirect("/app");

    // First authenticated moment of a new account — the only point at which a
    // remembered referral code can actually be attached to a person.
    referred = (await claimReferralFromCookie()).claimed;

    const supabase = await createClient();
    const { data: profile } = supabase
      ? await supabase.from("profiles").select("full_name, known_as").eq("id", user.id).maybeSingle()
      : { data: null };
    initialName = profile?.full_name || profile?.known_as || "";
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pitch-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="field-glow absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="font-display text-2xl font-bold text-text-hi">MIDO</span>
          <span className="font-display text-2xl font-bold text-signal">XI</span>
        </div>
        {/*
          The Founding XI note. Static and unskippable-because-tiny: four
          honest sentences before the wizard, not a tour, not confetti.
          The software itself has to be the welcome.
        */}
        <div className="mb-4 panel px-4 py-3">
          <p className="label-tech text-signal-bright">Founding XI</p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
            You are one of the first eleven players on MIDO. It is early, and that is
            the point — what you find rough, tell us with the feedback button and it
            gets fixed for everyone. Your football record belongs to you: every line
            of it is yours to read, correct, and delete.
          </p>
        </div>

        <div className="panel-raised p-6 shadow-2xl shadow-black/40">
          {isDemoMode && (
            <p className="mb-4 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">
              Demo mode — this wizard won&rsquo;t persist until Supabase is connected. It
              will still walk you into the app.
            </p>
          )}
          {referred && (
            <p className="mb-4 rounded-lg border border-signal-line bg-signal/10 px-3 py-2 text-xs text-signal-bright">
              You came in on someone&rsquo;s invitation. Your first paid month earns them a
              free month of Pro — and gets you one too.
            </p>
          )}
          <OnboardingWizard initialName={initialName} />
        </div>
      </div>
    </div>
  );
}
