import { ArrowDown, Eye, HelpCircle, Scale } from "lucide-react";

/*
  Show the loop instead of describing it.

  ABOUT THIS DATA. Every football word here is MIDO's own: "Receiving on the
  half-turn" is a real curated concept in `lib/knowledge/concepts.ts`, the
  markers are its real `looksLike` entries, and the session block is one of its
  real `trains` drills. What is invented is the match — there is no seeded
  analysis fixture to quote from, so the chain is labelled an example and says
  so on screen. It is a demonstration of the FORM a read takes, and it is never
  dressed up as a player's performance.

  The section exists because the product's argument is a sequence, and a
  sequence is the one thing a feature list cannot show: something happened,
  MIDO can point at it, and here is the work that follows.
*/

const MOMENTS = ["61:12", "68:40", "74:05"];

function Step({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative">
      <div className="label-tech mb-2 !text-text-faint">{label}</div>
      {children}
      {!last && (
        <div aria-hidden className="flex justify-center py-3">
          <ArrowDown className="size-4 text-text-faint" />
        </div>
      )}
    </li>
  );
}

export function OneMatchIn() {
  return (
    <section className="cv-auto relative z-10 mx-auto max-w-3xl px-5 py-20">
      <div className="label-tech mb-3">How it works</div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-text-hi md:text-4xl">
        One match in. Your next move out.
      </h2>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-text-dim">
        MIDO doesn&rsquo;t hand you an opinion. It points at the film, tells you how sure it is, and
        waits for you to agree before anything enters your record.
      </p>

      <ol className="mt-10 flex flex-col">
        <Step label="You give MIDO a match">
          <div className="panel p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-lg font-semibold text-text-hi">
                Saturday, 90 minutes
              </span>
              <span className="data-mono text-xs text-text-faint">full match · one camera</span>
            </div>
          </div>
        </Step>

        <Step label="MIDO reads it">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* The confidence label is the product's stance, not a badge. */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-positive/40 bg-positive/10 px-2 py-1">
                <Eye className="size-3 text-positive" />
                <span className="label-tech !text-positive">Observed</span>
              </span>
              <span className="font-display text-lg font-semibold text-text-hi">
                Receiving on the half-turn
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-text">
              Your back foot is square as the ball arrives, so the first touch goes back towards
              your own goal instead of away from pressure.
            </p>
          </div>
        </Step>

        <Step label="And points at it">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              {MOMENTS.map((t) => (
                <span
                  key={t}
                  className="data-mono rounded-md border border-signal-line bg-signal/10 px-2.5 py-1 text-sm text-signal-bright"
                >
                  {t}
                </span>
              ))}
              <span className="text-xs text-text-faint">three moments, in your film</span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-text-dim">
              In the product these jump straight to the second they name. An observation you
              can&rsquo;t go and look at is an opinion.
            </p>
          </div>
        </Step>

        <Step label="You decide if it's real">
          <div className="panel border-signal-line p-4">
            <p className="text-sm leading-relaxed text-text">
              <span className="text-text-hi">Does this belong in your record?</span> Nothing is
              written until you say so — MIDO proposes, you confirm.
            </p>
          </div>
        </Step>

        <Step label="It becomes a priority">
          <div className="panel p-4">
            <div className="font-display text-lg font-semibold text-text-hi">
              Open the back foot before the ball arrives
            </div>
            <p className="mt-1.5 text-sm text-text-dim">
              Now it&rsquo;s in your record, with the three moments attached as evidence.
            </p>
          </div>
        </Step>

        <Step label="And MIDO builds the work" last>
          <div className="panel p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-lg font-semibold text-text-hi">
                Y-shaped passing with a mandatory half-turn
              </span>
              <span className="data-mono text-xs text-signal-bright">12 min</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 border-l-2 border-signal-line pl-2.5">
              <span className="label-tech !text-text-faint">Built from</span>
              <span className="text-sm text-text">Open the back foot before the ball arrives</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-faint">
              The session keeps its reason. Three days later you still know why you&rsquo;re doing
              it.
            </p>
          </div>
        </Step>
      </ol>

      {/*
        Said plainly and near the thing it qualifies, rather than in a
        footnote nobody reads.
      */}
      <p className="mt-8 rounded-lg border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-text-faint">
        An example, to show the shape. The football is real — &ldquo;Receiving on the
        half-turn&rdquo; is a concept in MIDO&rsquo;s library and that drill is one of the ways it
        trains. The match is not: these are not one player&rsquo;s numbers.
      </p>
    </section>
  );
}

/*
  The three things MIDO can say, and the difference between them.

  This is on the homepage on purpose. Every tool in this category sounds
  equally certain about everything it outputs; being willing to say "I don't
  know" in public is the part that cannot be copied without meaning it.
*/
export function HowSureIsIt() {
  const levels = [
    {
      icon: Eye,
      name: "Observed",
      color: "var(--positive)",
      body: "It is in the film and MIDO can point at the second it happens.",
    },
    {
      icon: Scale,
      name: "Inferred",
      color: "var(--caution)",
      body: "The film supports it, but it is a judgement — context could change it.",
    },
    {
      icon: HelpCircle,
      name: "Uncertain",
      color: "var(--text-dim)",
      body: "The film does not settle it. Often MIDO cannot tell which player is you.",
    },
  ];

  return (
    <section className="cv-auto relative z-10 mx-auto max-w-5xl px-5 py-20">
      <div className="label-tech mb-3">How sure is it</div>
      <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight text-text-hi md:text-4xl">
        MIDO doesn&rsquo;t pretend to know what the film can&rsquo;t prove.
      </h2>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-text-dim">
        Every reading carries how confident it is. That is what makes the confident ones worth
        something.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {levels.map((l) => (
          <div key={l.name} className="panel flex flex-col gap-2 p-5">
            <l.icon className="size-4" style={{ color: l.color }} />
            <div className="font-display text-xl font-semibold uppercase" style={{ color: l.color }}>
              {l.name}
            </div>
            <p className="text-sm leading-relaxed text-text-dim">{l.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
