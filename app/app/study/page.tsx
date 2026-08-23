import Link from "next/link";
import { GraduationCap, ArrowUpRight, BookOpen, Network, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { roleDef } from "@/lib/roles/roles";
import { listStudies, currentViewer } from "@/lib/data/studies";
import { PLAYERS, COACHES } from "@/lib/knowledge/people";
import { CONCEPTS } from "@/lib/knowledge/concepts";
import { peopleForPosition, searchKnowledge } from "@/lib/knowledge/graph";
import { SectionHeader } from "@/components/ui/primitives";
import { initials } from "@/lib/utils";
import { StatBand } from "@/components/ui/kit";
import { StudyCommand } from "@/components/study/study-command";

export const metadata = { title: "Study — MIDO XI" };

const AREA_COLOR: Record<string, string> = {
  technical: "var(--signal-bright)",
  tactical: "var(--info)",
  physical: "var(--positive)",
  mental: "var(--review)",
};

export default async function StudyHome({ searchParams }: PageProps<"/app/study">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";

  const [user, viewer, studies] = await Promise.all([getCurrentUser(), currentViewer(), listStudies()]);
  const def = roleDef(user?.role);
  const suggested = peopleForPosition(viewer.positionGroup);
  const nearest = q ? searchKnowledge(q, 4) : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 lg:py-8">
      <header className="mb-6">
        <div className="rise-in label-tech flex items-center gap-3">
          <span>Study</span>
          <span className="h-px w-6 bg-line-strong" />
          <span className="text-text">{def.label} lens</span>
        </div>
        <h1 className="rise-in mt-3 font-display text-4xl font-bold tracking-tight text-text-hi md:text-5xl" style={{ animationDelay: "60ms" }}>
          Learn football through
          <br />
          the best people in football.
        </h1>
        <p className="rise-in mt-3 max-w-xl text-sm leading-relaxed text-text-dim" style={{ animationDelay: "120ms" }}>
          Not biographies. Every study is broken into the principles a person&rsquo;s game is built on, read
          through your {viewer.lensLabel.toLowerCase()} lens, and it ends somewhere real: a session in
          your training and a goal in your development map.
        </p>
      </header>

      <div className="rise-in mb-8" style={{ animationDelay: "160ms" }}>
        <StudyCommand role={def.id} openers={def.aiOpeners} />
      </div>

      {q && (
        <section className="mb-8">
          <div className="panel border-review/30 bg-review/5 p-5">
            <div className="flex items-start gap-3">
              <Search className="mt-0.5 size-4 shrink-0 text-review" />
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-text-hi">
                  &ldquo;{q}&rdquo; is not in the curated library yet
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">
                  MIDO XI only writes studies about people whose verified record is held in its own
                  catalogue — that is how the product keeps facts and interpretation separate. New subjects
                  are added deliberately rather than generated on demand.
                </p>
                {nearest.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nearest.map((h) => (
                      <Link key={h.slug} href={h.href} className="chip !normal-case hover:border-signal-line hover:text-signal-bright">
                        {h.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mb-8">
        <StatBand
          cols={4}
          stats={[
            { label: "Studies started", value: studies.length },
            { label: "People", value: PLAYERS.length + COACHES.length },
            { label: "Concepts", value: CONCEPTS.length },
            {
              label: def.id === "player" ? "Your position" : "Your lens",
              value: def.id === "player" ? viewer.positionLabel.split(" ")[0] : def.label,
              hint: def.id === "player" ? viewer.positionLabel : def.question,
            },
          ]}
        />
      </section>

      {studies.length > 0 && (
        <section className="mb-8">
          <SectionHeader label="Continue studying" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {studies.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/app/study/${s.subjectSlug}`}
                className="min-w-0 group panel flex flex-col p-4 transition-colors hover:border-signal-line"
              >
                <div className="flex items-center justify-between">
                  <span className="label-tech">{s.subjectKind}</span>
                  {s.completedModules.length > 0 && (
                    <span className="chip !px-1.5 !py-0 !text-positive">{s.completedModules.length} done</span>
                  )}
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-text-hi">{s.subjectName}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-text-dim">{s.headline}</p>
                <span className="mt-3 flex items-center gap-1 text-[11px] text-text-faint transition-colors group-hover:text-signal-bright">
                  Continue <ArrowUpRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {suggested.length > 0 && (
        <section className="mb-8">
          <SectionHeader
            label={
              def.id === "player"
                ? `Most instructive for a ${viewer.positionLabel.toLowerCase()}`
                : "Start with these"
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            {suggested.slice(0, 4).map((p) => (
              <Link
                key={p.slug}
                href={`/app/study/${p.slug}`}
                className="min-w-0 group panel-raised relative flex items-start gap-4 overflow-hidden p-5 transition-colors hover:border-signal-line"
              >
                <div className="pitch-grid absolute inset-0 opacity-30" aria-hidden />
                <span className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-ink-850 font-display text-base font-bold text-signal-bright">
                  {initials(p.name)}
                </span>
                <div className="relative min-w-0 flex-1">
                  <div className="label-tech">{p.descriptor}</div>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-text-hi">{p.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-dim">{p.premise}</p>
                </div>
                <ArrowUpRight className="relative size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader label="Players" />
          <div className="min-w-0 panel divide-y divide-line overflow-hidden">
            {PLAYERS.map((p) => (
              <Link key={p.slug} href={`/app/study/${p.slug}`} className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850">
                <BookOpen className="size-4 shrink-0 text-text-faint group-hover:text-signal-bright" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-hi">{p.name}</div>
                  <div className="label-tech mt-0.5 truncate">{p.descriptor}</div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <SectionHeader label="Coaches" />
          <div className="min-w-0 panel divide-y divide-line overflow-hidden">
            {COACHES.map((p) => (
              <Link key={p.slug} href={`/app/study/${p.slug}`} className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850">
                <GraduationCap className="size-4 shrink-0 text-text-faint group-hover:text-signal-bright" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-hi">{p.name}</div>
                  <div className="label-tech mt-0.5 truncate">{p.descriptor}</div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <SectionHeader label="Football concepts" />
        <div className="flex flex-wrap gap-2">
          {CONCEPTS.map((c) => (
            <Link
              key={c.slug}
              href={`/app/study/concept/${c.slug}`}
              className="group rounded-lg border border-line px-3 py-2 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text-hi"
            >
              <span className="mr-2 inline-block size-1.5 rounded-full align-middle" style={{ background: AREA_COLOR[c.area] }} />
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] text-text-faint">
          <Network className="size-3.5" />
          Concepts, people and positions are a curated knowledge graph. MIDO explains the connections — it
          does not invent them.
        </p>
      </section>
    </div>
  );
}
