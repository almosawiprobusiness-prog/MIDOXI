import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata = { title: "Community Guidelines — MIDO XI" };

export default function CommunityGuidelinesPage() {
  return (
    <LegalShell title="Community Guidelines" updated="24 August 2026" active="guidelines">
      <p className="text-text-dim">
        The community feed is footballers sharing film, moments and progress with
        each other — including, in many cases, players who are minors. These
        guidelines exist because a feature like that needed real mechanisms behind
        it from the first version, not added later once something went wrong.
      </p>

      <LegalSection heading="What belongs here">
        <p>
          Your own football — clips, training moments, matches, what you&rsquo;re
          working on. Encouragement and genuine feedback on someone else&rsquo;s post.
          Nothing that isn&rsquo;t yours to share, and nothing that turns a football
          post into something else.
        </p>
      </LegalSection>

      <LegalSection heading="What doesn't">
        <ul className="ml-5 list-disc space-y-1">
          <li>Harassment, threats, or targeting a specific person repeatedly.</li>
          <li>Impersonating another player, coach or club.</li>
          <li>
            Anything that endangers, exploits or inappropriately targets a young
            player — this is treated as a safeguarding matter, not an ordinary
            content dispute, and acted on directly rather than left to community
            reporting alone.
          </li>
          <li>Spam, and content that has nothing to do with football.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Blocking">
        <p>
          Blocking someone is immediate and works in both directions: their posts
          stop reaching you, and yours stop reaching them, enforced by the database
          rather than left to the interface to hide. It also removes any follow
          between you. The person you block is not told, and cannot see that you
          blocked them.
        </p>
      </LegalSection>

      <LegalSection heading="Reporting">
        <p>
          Any post can be reported, with a reason — including one specifically for a
          concern about a young player, separate from the general options. Reports
          are read only by us, never by the person reported. Nothing automated acts
          on a report by itself: a report is a person asking us to look, and we do,
          rather than a vote that removes content on its own.
        </p>
      </LegalSection>

      <LegalSection heading="What happens when something is reported">
        <p>
          We review it and act directly — that can mean removing a post, restricting
          an account, or, for a safeguarding report, treating it with the urgency
          that deserves regardless of how few reports it has. We don&rsquo;t publish a
          strike system or an appeals ladder here, because the honest answer is that
          each case gets looked at rather than run through a formula.
        </p>
      </LegalSection>

      <LegalSection heading="Visibility">
        <p>
          A post defaults to visible to every signed-in user. A per-post option to
          restrict it to your own followers exists in the product and may become the
          default later — nothing here should be read as a promise that today&rsquo;s
          default is permanent.
        </p>
      </LegalSection>

      <p className="pt-2 text-xs text-text-faint">
        See also the{" "}
        <Link href="/privacy" className="text-text-dim underline hover:text-text-hi">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="text-text-dim underline hover:text-text-hi">
          Terms of Service
        </Link>
        .
      </p>
    </LegalShell>
  );
}
