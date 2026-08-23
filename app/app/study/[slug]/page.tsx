import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  Film,
  Dumbbell,
  Target,
  StickyNote,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { getStudyPage } from "@/lib/data/studies";
import { person } from "@/lib/knowledge/people";
import { PROVENANCE_META } from "@/lib/knowledge/study-types";
import { SectionHeader } from "@/components/ui/primitives";
import { KnowledgeCheck } from "@/components/study/knowledge-check";
import {
  PersonaliseButton,
  TakeIntoTrainingButton,
  ApplyToGameButton,
  ModuleToggle,
  NoteBox,
} from "@/components/study/study-actions";
import type { Provenance } from "@/lib/knowledge/types";

export async function generateMetadata({ params }: PageProps<"/app/study/[slug]">) {
  const { slug } = await params;
  const p = person(slug);
  return { title: p ? `Study ${p.name} — MIDO XI` : "Study — MIDO XI" };
}

function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  const meta = PROVENANCE_META[provenance];
  return (
    <span
      className="chip"
      title={meta.hint}
      style={{ color: meta.color, borderColor: "color-mix(in oklab, " + meta.color + " 34%, transparent)" }}
    >
      {meta.label}
    </span>
  );
}

export default async function StudyPage({ params }: PageProps<"/app/study/[slug]">) {
  const { slug } = await params;
  const page = await getStudyPage(slug);
  if (!page) notFound();

  const { view, record, takeaways } = page;
  const done = new Set(record?.completedModules ?? []);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 lg:py-8">
      <Link
        href="/app/study"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> All studies
      </Link>

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="rise-in label-tech flex flex-wrap items-center gap-3">
          <span>Study</span>
          <span className="h-px w-6 bg-line-strong" />
          <span className="text-text">{view.subject.descriptor}</span>
          <span className="chip chip-signal">{view.viewer.lensLabel} lens</span>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="rise-in font-display text-4xl font-bold tracking-tight text-text-hi md:text-5xl" style={{ animationDelay: "60ms" }}>
            {view.subject.name}
          </h1>
          <PersonaliseButton slug={slug} enhanced={view.enhanced} />
        </div>
        <p className="rise-in mt-3 max-w-2xl text-sm leading-relaxed text-text-dim" style={{ animationDelay: "120ms" }}>
          {view.subject.premise}
        </p>
      </header>

      {/* ── Verified record + concept spine ─────────────── */}
      <div className="mb-10 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="min-w-0 panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <BadgeCheck className="size-4 text-info" />
            <h2 className="text-sm font-medium text-text-hi">Verified record</h2>
            <span className="ml-auto">
              <ProvenanceTag provenance="verified" />
            </span>
          </div>
          <dl className="divide-y divide-line">
            {view.subject.verified.map((f, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-2.5">
                <dt className="label-tech w-32 shrink-0 pt-0.5">{f.label}</dt>
                <dd className="min-w-0 flex-1 text-sm text-text">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-text-faint">
            Curated by hand from stable public record. Everything below this panel is football
            interpretation, and is labelled as such.
          </p>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Eye className="size-4 text-signal-bright" />
            <h2 className="text-sm font-medium text-text-hi">What this study teaches</h2>
          </div>
          <div className="space-y-2.5 p-5">
            {view.concepts.slice(0, 5).map((c) => (
              <Link
                key={c.slug}
                href={`/app/study/concept/${c.slug}`}
                className="group flex items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:border-signal-line"
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-signal" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text-hi">{c.name}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{c.definition}</span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {view.aiNote && (
        <p className="mb-8 rounded-lg border border-line bg-ink-900 px-4 py-3 text-xs leading-relaxed text-text-dim">
          {view.aiNote}
        </p>
      )}

      {/* ── Modules ──────────────────────────────────────── */}
      <div className="space-y-8">
        {view.modules.map((m, i) => (
          <section key={m.key} className="rise-in">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span className="data-mono text-[11px] text-signal">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-xl font-semibold text-text-hi">{m.title}</h2>
              <ProvenanceTag provenance={m.provenance} />
              <span className="ml-auto">
                <ModuleToggle slug={slug} moduleKey={m.key} complete={done.has(m.key)} />
              </span>
            </div>

            <div className="panel p-5">
              <p className="text-sm leading-relaxed text-text">{m.summary}</p>

              <div className="mt-5 space-y-4">
                {m.points.map((p, pi) => (
                  <div key={pi} className="border-l-2 border-line pl-4">
                    <h3 className="text-sm font-medium text-text-hi">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-dim">{p.body}</p>
                  </div>
                ))}
              </div>

              {m.watchFor && m.watchFor.length > 0 && (
                <div className="mt-5 rounded-lg border border-line bg-ink-850 p-4">
                  <div className="label-tech flex items-center gap-1.5">
                    <Film className="size-3" /> Watch for
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {m.watchFor.map((w, wi) => (
                      <li key={wi} className="flex items-start gap-2 text-xs leading-relaxed text-text-dim">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-signal" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* ── Match study ──────────────────────────────────── */}
      <section className="mt-12">
        <SectionHeader label="Match study" index="→" />
        <div className="panel-raised relative overflow-hidden">
          <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="relative p-6">
            <div className="flex items-start gap-3">
              <Film className="mt-1 size-5 shrink-0 text-signal-bright" />
              <p className="font-display text-lg leading-snug text-text-hi">{view.matchStudy.instruction}</p>
            </div>
            {view.matchStudy.watch.length > 0 && (
              <ul className="mt-5 grid gap-2 border-t border-line pt-5 sm:grid-cols-2">
                {view.matchStudy.watch.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text-dim">
                    <span className="data-mono mt-0.5 shrink-0 text-[11px] text-signal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <Link
                href="/app/film-room"
                className="flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
              >
                <Film className="size-4" /> Open the Film Room
              </Link>
              <span className="text-xs text-text-faint">Tag what you see — clips attach to this study.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Take into training ───────────────────────────── */}
      <section className="mt-10">
        <SectionHeader label="Take this into training" index="→" />
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <Dumbbell className="size-4 text-signal-bright" />
            <h3 className="font-display text-base font-semibold text-text-hi">{view.training.title}</h3>
            <span className="chip flex items-center gap-1">
              <Clock className="size-3" /> {view.training.durationMin} min
            </span>
            <span className="chip">{view.training.kind}</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm leading-relaxed text-text-dim">{view.training.objective}</p>
            <ol className="mt-4 divide-y divide-line border-y border-line">
              {view.training.blocks.map((b, i) => (
                <li key={i} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                  <span className="w-full text-sm font-medium text-text-hi sm:w-auto sm:flex-1">{b.name}</span>
                  <span className="data-mono shrink-0 text-xs text-signal-bright">{b.work}</span>
                  <p className="w-full text-xs leading-relaxed text-text-dim">{b.detail}</p>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <TakeIntoTrainingButton slug={slug} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Knowledge check ─────────────────────────────── */}
      {view.quiz.length > 0 && (
        <section className="mt-10">
          <SectionHeader label="Test what you took in" index="→" />
          <KnowledgeCheck slug={slug} questions={view.quiz} />
        </section>
      )}

      {/* ── Apply to my game ────────────────────────────── */}
      <section className="mt-10">
        <SectionHeader label="Apply to my game" index="→" />
        <div className="panel-raised relative overflow-hidden">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative p-6">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 size-5 shrink-0 text-signal-bright" />
              <p className="text-sm leading-relaxed text-text">{view.apply.summary}</p>
            </div>
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              {view.apply.points.map((p, i) => (
                <div key={i} className="border-l-2 border-signal-line pl-4">
                  <h3 className="text-sm font-medium text-text-hi">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-dim">{p.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <ApplyToGameButton slug={slug} goalTitle={view.apply.goal.title} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Your observations ───────────────────────────── */}
      <section className="mt-10">
        <SectionHeader label="Your observations" index="→" />
        <NoteBox slug={slug} />
        {takeaways.length > 0 && (
          <div className="panel mt-3 divide-y divide-line overflow-hidden">
            {takeaways.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 shrink-0">
                  {t.kind === "training" ? (
                    <Dumbbell className="size-4 text-signal-bright" />
                  ) : t.kind === "goal" ? (
                    <Target className="size-4 text-positive" />
                  ) : t.kind === "quiz" ? (
                    <BadgeCheck className="size-4 text-info" />
                  ) : (
                    <StickyNote className="size-4 text-review" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-hi">{t.body ?? t.kind}</div>
                  <div className="label-tech mt-0.5">
                    {t.kind === "training"
                      ? "Added to training"
                      : t.kind === "goal"
                        ? "Development goal created"
                        : t.kind === "quiz"
                          ? `Knowledge check · ${t.score}%`
                          : "Your observation"}
                  </div>
                </div>
                {t.kind === "training" && (
                  <Link href="/app/training" className="chip hover:border-signal-line hover:text-signal-bright">
                    Open
                  </Link>
                )}
                {t.kind === "goal" && (
                  <Link href="/app/development" className="chip hover:border-signal-line hover:text-signal-bright">
                    Open
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-text-faint">
        <span className="size-1.5 shrink-0 rounded-full bg-info" />
        Verified facts are curated. MIDO analysis is interpretation, not record. Your observations are
        yours.
      </p>
    </div>
  );
}
