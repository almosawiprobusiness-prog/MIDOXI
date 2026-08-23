import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "Terms — MIDO XI" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 2026">
      <p className="text-text-dim">
        By using MIDO XI you agree to these terms. They&rsquo;re intentionally plain.
      </p>

      <LegalSection heading="Your account">
        <p>
          You&rsquo;re responsible for your account and for the accuracy of the data
          you enter. Keep your credentials secure. You must be old enough to consent
          to data processing in your country, or have guardian consent.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You own your football data and uploads. You grant MIDO XI the permission
          needed to store and process that content to operate the service for you
          (including generating AI insights on features you use).
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Don&rsquo;t upload content you don&rsquo;t have the right to use, and
          don&rsquo;t use MIDO to infringe others&rsquo; rights or the terms of
          integrated platforms such as YouTube.
        </p>
      </LegalSection>

      <LegalSection heading="MIDO Pro & billing">
        <p>
          Core football tools are free. MIDO Pro is a paid membership unlocking the
          AI intelligence layer, billed monthly or annually and cancellable at any
          time. AI features are subject to fair-use limits shown in the app.
        </p>
      </LegalSection>

      <LegalSection heading="AI accuracy">
        <p>
          MIDO intelligence is a study and analysis aid, not professional coaching or
          medical advice. AI insights are derived from the data you enter and may be
          incomplete — always apply your own judgement.
        </p>
      </LegalSection>

      <LegalSection heading="Changes & termination">
        <p>
          We may update the service and these terms; material changes will be
          surfaced in-app. You can stop using MIDO and delete your account at any
          time.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
