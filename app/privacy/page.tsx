import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "Privacy — MIDO XI" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="24 August 2026" active="privacy">
      <p className="text-text-dim">
        MIDO XI is a football performance environment. This policy describes what we
        store and how it is handled, and it is written to match the system as
        actually built — where a claim below would outrun what the product actually
        does, we would rather narrow the claim than pad the policy.
      </p>

      <LegalSection heading="What we store">
        <p>
          Your account (email) and the football data you enter or generate by using
          the product: your profile, matches, statistics, self-reviews, film and
          clips, training logs, development goals, calendar events, daily
          check-ins, notes, and any video you upload.
        </p>
        <p>
          If you use the community feed, that also includes what you post — a
          caption, media, tags — and the ordinary mechanics of a feed: who you
          follow, who you have blocked, and reports you file or that are filed
          about your content.
        </p>
        <p>
          If you book time with a coach, trainer or player through Sessions, that
          includes the meeting itself, any shared agenda items, and the history of
          who proposed, accepted or declined it.
        </p>
      </LegalSection>

      <LegalSection heading="Wearable and health data">
        <p>
          Connecting a wearable (currently WHOOP) is optional and off by default.
          If you connect one, we receive recovery score, heart-rate variability,
          resting heart rate, blood oxygen, sleep and strain data for the period you
          authorise. This is health data, and we treat it accordingly:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            It is kept in its own table, separate from the four self-reported scores
            you enter yourself (energy, soreness, sleep, mental state) — the two are
            never averaged or blended into a single number.
          </li>
          <li>
            The OAuth credential that connects your wearable account is stored in a
            table our own application code cannot read — not with a permissions
            setting we could accidentally loosen, but because the database role our
            product uses to serve you the app is granted no access to that table at
            all. Only the specific server process that syncs your data can reach it.
          </li>
          <li>
            Disconnecting removes that credential immediately, tells WHOOP to revoke
            it on their side too — so your wearable account stops listing MIDO XI as
            connected — and stops any further sync. Readings already recorded stay,
            because they are a record of what already happened; you can delete them
            separately, as a second, explicit decision, from the Recovery page.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How uploads are handled">
        <p>
          Video you upload is stored in object storage, not in the database, and is
          private to your account by default. Only you — and a coach or trainer you
          have explicitly connected with — can access it, enforced by row-level
          security in the database rather than left to the interface to hide.
        </p>
      </LegalSection>

      <LegalSection heading="The community feed">
        <p>
          Posts default to visible to everyone signed in; a per-post option to
          restrict a post to your followers exists and may become the default later.
          Blocking someone hides their posts from you and yours from them, in both
          directions, and is enforced at the database level, not merely in what the
          interface chooses to display.
        </p>
        <p>
          Reports are read only by us, never by the person reported, and nothing
          automated acts on one — a report is a person asking us to look, not a vote
          that removes content by itself. Reporting includes a reason specifically
          for concerns about a young player, because MIDO XI is used by academy and
          youth footballers and that reason needed to exist rather than be folded
          into &ldquo;other.&rdquo;
        </p>
      </LegalSection>

      <LegalSection heading="Third-party AI processing">
        <p>
          MIDO&rsquo;s intelligence features send relevant football context — a match
          review, your goals, a clip&rsquo;s tags and timestamps — to our AI providers
          (Anthropic, and for native video reading, Google&rsquo;s Gemini) to generate
          insights and summaries. AI usage is metered against your plan&rsquo;s fair-use
          limits, shown in the app.
        </p>
      </LegalSection>

      <LegalSection heading="YouTube integration">
        <p>
          The Study Engine queries the YouTube Data API to find public coaching and
          analysis videos. We store only video metadata (title, channel, thumbnail,
          duration, URL) and the search context. Videos are shown via YouTube&rsquo;s
          own embed player; we do not download or store copyrighted video content.
        </p>
      </LegalSection>

      <LegalSection heading="Payments">
        <p>
          Paid plans are billed through Stripe. We never see or store your full card
          number — Stripe handles that directly, and we hold only what is needed to
          identify your subscription and its status.
        </p>
      </LegalSection>

      <LegalSection heading="Email">
        <p>
          We email you about a narrow set of things that expect an answer —
          someone proposing to meet with you, or responding to a proposal — never
          for a follow, a like or a comment. This is on by default and can be turned
          off entirely from Settings at any time; turning it off does not affect the
          notifications you see inside the app.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          We use a session cookie to keep you signed in, and a short-lived cookie
          during a wearable connection to verify the handshake wasn&rsquo;t
          intercepted (it is deleted immediately afterward, whether the connection
          succeeds or not). We do not use advertising or cross-site tracking cookies,
          and nothing here is sold or shared for advertising purposes.
        </p>
      </LegalSection>

      <LegalSection heading="Minors">
        <p>
          MIDO XI is built for footballers at every level, including academy and
          youth players, and expects a parent or guardian to be involved in an
          account for a player below the age where they can independently consent to
          data processing in their country. We rely on the account holder&rsquo;s own
          representation of their age at present, rather than an automated
          age-verification system — if you believe a young person&rsquo;s account needs
          our attention, contact us using the details below and we will act on it
          directly.
        </p>
      </LegalSection>

      <LegalSection heading="Your control">
        <p>
          Your profile is private by default. You can export your data or delete
          your account at any time from Settings. Deletion removes your profile and
          entered data from our database, and — as of this policy&rsquo;s current
          version — also removes your uploaded video, avatar and community media
          from storage rather than leaving them behind with no owner reference.
        </p>
      </LegalSection>

      <LegalSection heading="Where your data is processed">
        <p>
          Our infrastructure and the providers listed above may process data outside
          your own country. Where that crosses into the EU or UK, we rely on those
          providers&rsquo; own standard safeguards for international transfer rather
          than operating separate infrastructure per region.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we change what we collect or how it is used in a way that matters,
          we&rsquo;ll say so in the app before it takes effect, not only here.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about your data, or a request to act on a young player&rsquo;s
          account, can be sent to the address in your account settings.
        </p>
      </LegalSection>

      <p className="pt-2 text-xs text-text-faint">
        See also the{" "}
        <Link href="/terms" className="text-text-dim underline hover:text-text-hi">
          Terms of Service
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
