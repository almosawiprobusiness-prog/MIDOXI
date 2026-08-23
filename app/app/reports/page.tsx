import Link from "next/link";
import { FileText, ArrowUpRight, Target, Dumbbell, Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { periodLabel, recentPeriods } from "@/lib/reports/period";
import { listVideos } from "@/lib/data/film";
import { myShares } from "./share-actions";
import { ShareList } from "@/components/reports/share-list";

export const metadata = { title: "Reports — MIDO XI" };

/*
  Every month is a report and every video is a report, whether or not anything
  is in them — so this is a list of subjects rather than a list of saved files.
  There is nothing to generate and nothing to store: open one and it assembles
  itself from the record, and it changes when the record does.
*/

const KINDS = [
  {
    id: "monthly",
    icon: Target,
    label: "Development",
    blurb: "Goals, the evidence behind them, matches and film. The one to send a coach.",
  },
  {
    id: "training",
    icon: Dumbbell,
    label: "Training",
    blurb: "A month of sessions, what they were made of, and every one listed.",
  },
] as const;

export default async function ReportsPage() {
  const periods = recentPeriods(6);
  const [videos, shares] = await Promise.all([listVideos(), myShares()]);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <PageHeader icon={FileText} title="Reports" tagline="Something to hand to a coach." />

      {KINDS.map((kind) => (
        <section key={kind.id} className="mb-8">
          <SectionHeader label={kind.label} />
          <p className="mb-3 text-xs leading-relaxed text-text-faint">{kind.blurb}</p>
          <div className="min-w-0 panel divide-y divide-line">
            {periods.map((p, i) => (
              <Link
                key={p}
                href={`/app/reports/${kind.id}/${p}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-850"
              >
                <kind.icon className="size-4 shrink-0 text-text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-hi">{periodLabel(p)}</span>
                  {i === 0 && (
                    <span className="block text-xs text-text-faint">This month, so far</span>
                  )}
                </span>
                <ArrowUpRight className="size-3.5 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="mb-8">
        <SectionHeader label="Film analysis" action={{ label: "Film room", href: "/app/film-room" }} />
        <p className="mb-3 text-xs leading-relaxed text-text-faint">
          One video&rsquo;s readings, with MIDO&rsquo;s confidence in each one printed alongside.
        </p>
        {videos.length === 0 ? (
          <div className="min-w-0 panel px-4 py-6 text-center text-sm text-text-dim">
            No film yet. Add a video and read a passage of it, and it appears here.
          </div>
        ) : (
          <div className="min-w-0 panel divide-y divide-line">
            {videos.slice(0, 12).map((v) => (
              <Link
                key={v.id}
                href={`/app/reports/film/${v.id}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-850"
              >
                <Clapperboard className="size-4 shrink-0 text-text-faint" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-hi">
                  {v.title}
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/*
        Listed here rather than in settings, because "who did I send that to,
        and is it still open" is a question people ask in a hurry.
      */}
      <section className="mb-8">
        <SectionHeader label="Shared links" />
        <p className="mb-3 text-xs leading-relaxed text-text-faint">
          Every link expires, and you can withdraw one at any time. Expired and withdrawn links stay
          listed so you can see what went where.
        </p>
        <ShareList shares={shares} />
      </section>

      <p className="text-xs leading-relaxed text-text-faint">
        A report is a view of your record, not a file that gets made and stored. It changes when
        your record changes, and it can only ever say what you have logged. Printing produces a PDF
        from your browser — nothing is uploaded anywhere, and no copy is kept but yours.
      </p>
    </div>
  );
}
