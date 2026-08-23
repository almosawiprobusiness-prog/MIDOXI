import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { roleDef } from "@/lib/roles/roles";

/*
  Honest scaffold for sections not yet built in this milestone.
  Not a "coming soon" wall — it states exactly what will live here
  and what's already wired, so navigation is real and truthful.
*/
export async function SectionScaffold({
  icon: Icon,
  title,
  tagline,
  planned,
  wired,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  planned: string[];
  wired?: string;
}) {
  const user = await getCurrentUser();
  const home = roleDef(user?.role).terminology.home;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <div className="rise-in flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">
            {title}
          </h1>
          <p className="text-sm text-text-dim">{tagline}</p>
        </div>
        <span className="chip ml-auto">Building</span>
      </div>

      <div className="rise-in mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]" style={{ animationDelay: "80ms" }}>
        <div className="min-w-0 panel-raised p-5">
          <div className="label-tech">Planned for this section</div>
          <ul className="mt-3 space-y-2.5">
            {planned.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-text">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel flex flex-col p-5">
          <div className="label-tech">Foundation status</div>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-text-dim">
            {wired ??
              "The data model, navigation, design system and command palette that power this view are already built — this screen is next in the roadmap."}
          </p>
          <Link
            href="/app"
            className="mt-4 flex items-center gap-2 self-start rounded-lg border border-line px-3 py-2 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
          >
            <ArrowLeft className="size-4" />
            Back to {home}
          </Link>
        </div>
      </div>
    </div>
  );
}
