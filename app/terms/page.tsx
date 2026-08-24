import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "Terms — MIDO XI" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="24 August 2026" active="terms">
      <p className="text-text-dim">
        By using MIDO XI you agree to these terms. They&rsquo;re intentionally plain,
        and where they refer to a plan or a feature, that name matches what is
        actually sold in the app rather than an older name that has since changed.
      </p>

      <LegalSection heading="Your account">
        <p>
          You&rsquo;re responsible for your account and for the accuracy of the data
          you enter. Keep your credentials secure. You must be old enough to consent
          to data processing in your country, or have a parent or guardian&rsquo;s
          consent — see the Minors section of our{" "}
          <Link href="/privacy" className="underline hover:text-text-hi">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You own your football data and uploads. You grant MIDO XI the permission
          needed to store and process that content to operate the service for you —
          including generating AI insights on features you use, and showing content
          you choose to share to people you&rsquo;ve connected with or, for a public
          community post, to other signed-in users.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Don&rsquo;t upload content you don&rsquo;t have the right to use, and don&rsquo;t
          use MIDO to infringe others&rsquo; rights or the terms of integrated
          platforms such as YouTube, WHOOP or Stripe. In the community feed,
          harassment, impersonation and content that endangers or exploits a young
          player are never acceptable — see our{" "}
          <Link href="/community-guidelines" className="underline hover:text-text-hi">
            Community Guidelines
          </Link>{" "}
          for the fuller standard and how reports are handled. We may remove content
          or suspend an account that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Plans & billing">
        <p>
          Player, Coach and Trainer each have a genuinely usable free tier. Paid
          plans — Player, Touchline and Club — unlock deeper AI-assisted analysis
          and, for Touchline and Club, additional operating systems and staff seats.
          Current pricing is shown on the Membership page in the app rather than
          restated here, so this document never drifts from what you&rsquo;re actually
          charged. Plans are billed monthly or annually through Stripe and
          cancellable at any time; cancelling stops future billing and you keep paid
          access through the end of the period already paid for. AI features are
          subject to the fair-use limits shown in the app for your plan.
        </p>
      </LegalSection>

      <LegalSection heading="Wearables and third-party connections">
        <p>
          Connecting a wearable or other third-party account is optional and
          governed by that provider&rsquo;s own terms as well as ours. You can
          disconnect at any time from the relevant settings page, which also revokes
          our access on the provider&rsquo;s side.
        </p>
      </LegalSection>

      <LegalSection heading="AI accuracy">
        <p>
          MIDO intelligence is a study and analysis aid, not professional coaching,
          medical or fitness advice. AI insights are derived from the data you enter
          and the film you provide, may be incomplete or wrong, and should never
          replace your own judgement or a qualified professional&rsquo;s — particularly
          for anything touching injury, recovery or a young player&rsquo;s wellbeing.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty, and our liability">
        <p>
          MIDO XI is provided as it stands, without a guarantee that it will be
          uninterrupted, error-free, or fit for a particular purpose beyond what is
          described here. To the extent the law allows it, we are not liable for
          indirect or consequential loss arising from your use of the service; our
          total liability for a claim arising from a paid plan is capped at what you
          paid us for that plan in the twelve months before the claim. Nothing here
          limits liability that the law does not allow us to limit.
        </p>
      </LegalSection>

      <LegalSection heading="Ending an account">
        <p>
          You can stop using MIDO and delete your account at any time from Settings
          — this is permanent and removes your data as described in the Privacy
          Policy. We may suspend or end an account that breaks these terms, the
          Community Guidelines, or the law, and will tell you why unless doing so
          would itself create a safety risk.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to the service and these terms">
        <p>
          We may update the service and these terms as the product changes; a
          material change to the terms will be surfaced in-app before it takes
          effect, not only posted here.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of [jurisdiction to be confirmed],
          without regard to its conflict-of-law rules, and any dispute not resolved
          informally will be handled in the courts of that jurisdiction.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>Questions about these terms can be sent to the address in your account settings.</p>
      </LegalSection>

      <p className="pt-2 text-xs text-text-faint">
        See also the{" "}
        <Link href="/privacy" className="text-text-dim underline hover:text-text-hi">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/community-guidelines" className="text-text-dim underline hover:text-text-hi">
          Community Guidelines
        </Link>
        .
      </p>
    </LegalShell>
  );
}
