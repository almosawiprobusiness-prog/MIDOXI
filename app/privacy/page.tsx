import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "Privacy — MIDO XI" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 2026">
      <p className="text-text-dim">
        MIDO XI is a football performance environment. This policy describes what
        we store and how it is handled. It reflects the system as actually built —
        we don&rsquo;t claim protections we haven&rsquo;t implemented.
      </p>

      <LegalSection heading="What we store">
        <p>
          Your account (email), your football profile, and the data you enter:
          matches, statistics, reviews, training logs, development goals, calendar
          events, daily check-ins, notes, and any video or clips you upload.
        </p>
      </LegalSection>

      <LegalSection heading="How uploads are handled">
        <p>
          Video you upload is stored in object storage, not in the database, and is
          private to your account by default. Only you — and a coach you have
          explicitly joined on a team — can access it, enforced by row-level
          security.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party AI processing">
        <p>
          MIDO Pro intelligence features send relevant football context (for
          example a match review or your goals) to our AI provider to generate
          insights and summaries. We do not send your raw uploaded video to the AI
          provider. AI usage is metered for fair use.
        </p>
      </LegalSection>

      <LegalSection heading="YouTube integration">
        <p>
          The Study Engine queries the YouTube Data API to find public coaching and
          analysis videos. We store only video metadata (title, channel, thumbnail,
          duration, URL) and the search context. Videos are shown via YouTube&rsquo;s
          embed player; we do not download copyrighted content.
        </p>
      </LegalSection>

      <LegalSection heading="Your control">
        <p>
          Your profile is private by default. You can export your data or delete
          your account at any time from Settings; deletion removes your profile,
          entered data and uploads.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>Questions about your data can be sent to the address in your account settings.</p>
      </LegalSection>
    </LegalShell>
  );
}
