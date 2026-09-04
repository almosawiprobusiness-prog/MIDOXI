"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import {
  askExplainBoard,
  askBoardToDrill,
  askRedrawBoard,
  applyBoardDocument,
  type RedrawnBoard,
} from "@/app/app/tactics/ai-actions";
import type { BoardExplanation } from "@/lib/ai/board-engine";
import type { DraftedDrill } from "@/lib/ai/board-engine";
import { cn } from "@/lib/utils";

/*
  Ask MIDO, from the board (§17).

  A short list of things worth asking, not every action at once. Each is
  one metered call the user chose to make — there is no background
  analysis and nothing runs on open, because a board being looked at is
  not a request.

  THE COMPOSED BADGE IS THE POINT. When the answer came from the
  deterministic path — free tier, no credits, model unreachable — it
  says so, and says what it is: a reading of what is on the board rather
  than MIDO's interpretation of it. An unlabelled fallback would be the
  product quietly overstating itself.
*/

type Answer =
  | { kind: "explanation"; data: BoardExplanation }
  | { kind: "drill"; data: DraftedDrill };

const PERSPECTIVES = ["striker", "winger", "number 8", "full-back", "centre-back", "goalkeeper"];

export function AskMido({ boardId, role }: { boardId: string; role: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPositions, setShowPositions] = useState(false);
  const [redraw, setRedraw] = useState<RedrawnBoard | null>(null);
  const [asking, setAsking] = useState(false);
  const [brief, setBrief] = useState("");
  const [, start] = useTransition();

  const run = (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    start(async () => {
      await fn();
      setBusy(null);
    });
  };

  const explain = (perspective?: string) =>
    run(perspective ?? "explain", async () => {
      const res = await askExplainBoard(boardId, perspective);
      if (res.ok) setAnswer({ kind: "explanation", data: res.data });
      else setError(res.error);
      setShowPositions(false);
    });

  /*
    Draw the idea onto this board. Two steps on purpose: MIDO proposes, a
    person replaces. A board has no version history, so a one-click overwrite
    would destroy work that cannot be recovered.
  */
  const propose = () =>
    run("redraw", async () => {
      const res = await askRedrawBoard(boardId, brief);
      if (res.ok) setRedraw(res.data);
      else setError(res.error);
    });

  const applyIt = () =>
    run("apply", async () => {
      if (!redraw) return;
      const res = await applyBoardDocument(boardId, redraw.doc);
      if (res.ok) window.location.reload();
      else setError(res.error);
    });

  const drill = () =>
    run("drill", async () => {
      const res = await askBoardToDrill(boardId);
      if (res.ok) setAnswer({ kind: "drill", data: res.data });
      else setError(res.error);
    });

  const btn =
    "flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50";

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-signal-bright" />
        <span className="label-tech">Ask MIDO</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => explain()} disabled={busy !== null} className={btn}>
          {busy === "explain" && <Loader2 className="size-3 animate-spin" />}
          Explain this
        </button>

        {/* Player OS's question, and the reason the same board reads
            differently per role (§10). */}
        <button
          type="button"
          onClick={() => setShowPositions((v) => !v)}
          disabled={busy !== null}
          aria-expanded={showPositions}
          className={btn}
        >
          Explain by position
        </button>

        <button
          type="button"
          onClick={() => setAsking((v) => !v)}
          disabled={busy !== null}
          aria-expanded={asking}
          className={btn}
        >
          Draw it on this board
        </button>

        {role !== "player" && (
          <button type="button" onClick={drill} disabled={busy !== null} className={btn}>
            {busy === "drill" && <Loader2 className="size-3 animate-spin" />}
            Turn into a drill
          </button>
        )}
      </div>

      {showPositions && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {PERSPECTIVES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => explain(p)}
              disabled={busy !== null}
              className="h-7 rounded-md border border-line px-2 text-[11px] capitalize text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
            >
              {busy === p ? <Loader2 className="size-3 animate-spin" /> : p}
            </button>
          ))}
        </div>
      )}

      {asking && (
        <div className="mt-2 border-t border-line pt-2">
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Leave empty to draw the objective already on this board"
            className="h-8 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <button
            type="button"
            onClick={propose}
            disabled={busy !== null}
            className="mt-2 flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
          >
            {busy === "redraw" && <Loader2 className="size-3 animate-spin" />}
            Draw it
          </button>

          {redraw && (
            <div className="mt-3 rounded-lg border border-line bg-ink-850 p-3">
              {(redraw.composed || redraw.note) && (
                <p className="mb-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-dim">
                  <Info className="mt-0.5 size-3 shrink-0" />
                  <span>{redraw.note ?? "This is the starting shape, not a drawn idea."}</span>
                </p>
              )}
              <p className="text-xs text-text">
                {redraw.summary.ours} of yours against {redraw.summary.theirs} ·{" "}
                {redraw.summary.paths} movement{redraw.summary.paths === 1 ? "" : "s"} ·{" "}
                {redraw.summary.zones} area{redraw.summary.zones === 1 ? "" : "s"}
              </p>
              {redraw.objective && (
                <p className="mt-1 text-xs leading-relaxed text-text-dim">{redraw.objective}</p>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
                Applying replaces what is on this board. There is no undo once saved.
              </p>
              <button
                type="button"
                onClick={applyIt}
                disabled={busy !== null}
                className="mt-2 flex h-7 items-center gap-1.5 rounded-md bg-signal px-2.5 text-xs font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
              >
                {busy === "apply" && <Loader2 className="size-3 animate-spin" />}
                Replace the board with this
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs text-correction">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-3 border-t border-line pt-3">
          {/* What produced this. Never silent. */}
          {(answer.data.composed || answer.data.note) && (
            <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 text-[11px] leading-relaxed text-text-dim">
              <Info className="mt-0.5 size-3 shrink-0" />
              <span>
                {answer.data.note ??
                  "This is what is on the board, read back. MIDO's own interpretation needs an AI allowance."}
              </span>
            </p>
          )}

          {answer.kind === "explanation" ? (
            <>
              <p className="font-display text-base font-semibold leading-snug text-text-hi">
                {answer.data.headline}
              </p>
              <ul className="mt-2 space-y-1.5">
                {answer.data.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-signal" />
                    {pt}
                  </li>
                ))}
              </ul>
              {answer.data.watchFor.length > 0 && (
                <>
                  <div className="label-tech mt-3">Watch for</div>
                  <ul className="mt-1 space-y-1">
                    {answer.data.watchFor.map((w, i) => (
                      <li key={i} className="text-xs leading-relaxed text-text-dim">
                        {w}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-text-hi">{answer.data.name}</span>
                <span className="label-tech">{answer.data.phase.replace(/-/g, " ")}</span>
                <span className="data-mono text-xs text-signal-bright">{answer.data.durationMin}m</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{answer.data.organisation}</p>
              {answer.data.coachingPoints.length > 0 && (
                <>
                  <div className="label-tech mt-3">Coaching points</div>
                  <ul className="mt-1 space-y-1">
                    {answer.data.coachingPoints.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-positive" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(answer.data.progression || answer.data.regression) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {answer.data.progression && (
                    <span className="chip !normal-case">↑ {answer.data.progression}</span>
                  )}
                  {answer.data.regression && (
                    <span className="chip !normal-case">↓ {answer.data.regression}</span>
                  )}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-text-faint">
                Add it to a session from the session planner — the board goes with it.
              </p>
            </>
          )}
        </div>
      )}

      {!answer && !error && (
        <p className={cn("mt-3 text-[11px] leading-relaxed text-text-faint")}>
          MIDO reads the board itself — the positions, the movements and the space you marked — not a
          picture of it.
        </p>
      )}
    </div>
  );
}
