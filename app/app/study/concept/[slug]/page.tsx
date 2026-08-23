import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Target, Dumbbell, Network, ArrowUpRight, Users } from "lucide-react";
import { concept } from "@/lib/knowledge/concepts";
import { connectionsFor, peopleForConcept } from "@/lib/knowledge/graph";
import { SectionHeader } from "@/components/ui/primitives";
import { initials } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/app/study/concept/[slug]">) {
  const { slug } = await params;
  const c = concept(slug);
  return { title: c ? `${c.name} — MIDO XI` : "Concept — MIDO XI" };
}

const AREA_COLOR: Record<string, string> = {
  technical: "var(--signal-bright)",
  tactical: "var(--info)",
  physical: "var(--positive)",
  mental: "var(--review)",
};

const EDGE_LABEL: Record<string, { out: string; in: string }> = {
  requires: { out: "Requires", in: "Required by" },
  counters: { out: "Answers", in: "Answered by" },
  partOf: { out: "Part of", in: "Contains" },
  relatesTo: { out: "Related", in: "Related" },
  embodies: { out: "Embodied by", in: "Embodies" },
};

export default async function ConceptPage({ params }: PageProps<"/app/study/concept/[slug]">) {
  const { slug } = await params;
  const c = concept(slug);
  if (!c) notFound();

  const connections = connectionsFor(slug);
  const people = peopleForConcept(slug);
  const color = AREA_COLOR[c.area] ?? "var(--signal)";

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-6 lg:py-8">
      <Link
        href="/app/study"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> All studies
      </Link>

      <header className="mb-8">
        <div className="rise-in label-tech flex flex-wrap items-center gap-3">
          <span style={{ color }}>{c.area}</span>
          <span className="h-px w-6 bg-line-strong" />
          <span className="text-text">{c.phase.replace(/-/g, " ")}</span>
        </div>
        <h1 className="rise-in mt-3 font-display text-4xl font-bold tracking-tight text-text-hi md:text-5xl" style={{ animationDelay: "60ms" }}>
          {c.name}
        </h1>
        <p className="rise-in mt-3 max-w-2xl text-base leading-relaxed text-text" style={{ animationDelay: "120ms" }}>
          {c.definition}
        </p>
        <p className="rise-in mt-2 max-w-2xl text-sm leading-relaxed text-text-dim" style={{ animationDelay: "160ms" }}>
          {c.why}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Eye className="size-4 text-info" />
            <h2 className="text-sm font-medium text-text-hi">What it looks like</h2>
          </div>
          <ul className="space-y-2.5 p-5">
            {c.looksLike.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text-dim">
                <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: color }} />
                {l}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Target className="size-4 text-signal-bright" />
            <h2 className="text-sm font-medium text-text-hi">Cues to hold</h2>
          </div>
          <ul className="space-y-2.5 p-5">
            {c.cues.map((l, i) => (
              <li key={i} className="text-sm leading-relaxed text-text-hi">
                &ldquo;{l}&rdquo;
              </li>
            ))}
          </ul>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Dumbbell className="size-4 text-positive" />
            <h2 className="text-sm font-medium text-text-hi">How you train it</h2>
          </div>
          <ul className="space-y-2.5 p-5">
            {c.trains.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text-dim">
                <span className="data-mono mt-0.5 shrink-0 text-[11px] text-signal">{String(i + 1).padStart(2, "0")}</span>
                {l}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {people.length > 0 && (
        <section className="mt-8">
          <SectionHeader label="Study this through" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <Link
                key={p.slug}
                href={`/app/study/${p.slug}`}
                className="min-w-0 group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-display text-sm font-bold text-signal-bright">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-hi">{p.name}</span>
                  <span className="label-tech block truncate">{p.descriptor}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {connections.length > 0 && (
        <section className="mt-8">
          <SectionHeader label="In the knowledge graph" />
          <div className="panel divide-y divide-line overflow-hidden">
            {connections.map((conn, i) => {
              const label = EDGE_LABEL[conn.edge.kind]?.[conn.direction] ?? "Related";
              return (
                <Link
                  key={i}
                  href={`/app/study/concept/${conn.concept.slug}`}
                  className="group flex items-start gap-3 p-4 transition-colors hover:bg-ink-850"
                >
                  <span className="chip mt-0.5 shrink-0">{label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-hi">{conn.concept.name}</span>
                    {conn.edge.note && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{conn.edge.note}</span>
                    )}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-text-faint">
        <Network className="size-3.5" />
        Curated football concept. Relationships are authored, not generated — MIDO explains them, it does
        not invent them.
      </p>

      <div className="mt-6 flex justify-center">
        <Link
          href="/app/study"
          className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Users className="size-4" /> Browse every study
        </Link>
      </div>
    </div>
  );
}
