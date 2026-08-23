"use client";

import { useState } from "react";
import { Check, X, RotateCcw, BrainCircuit } from "lucide-react";
import type { QuizQuestion } from "@/lib/knowledge/study-types";
import { saveQuizScore } from "@/app/app/study/actions";
import { cn } from "@/lib/utils";

/*
  Knowledge check. Questions are built from curated concept definitions, so the
  answers are always defensible — there is no model guessing what is correct.
*/
export function KnowledgeCheck({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!questions.length) return null;

  const answered = Object.keys(answers).length;
  const score = questions.reduce((s, q, i) => (answers[i] === q.answer ? s + 1 : s), 0);

  const submit = () => {
    setSubmitted(true);
    void saveQuizScore(slug, score, questions.length);
  };

  return (
    <div className="panel-raised overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <BrainCircuit className="size-4 text-signal-bright" />
        <h3 className="font-display text-base font-semibold text-text-hi">Knowledge check</h3>
        {submitted && (
          <span className="chip ml-auto" style={{ color: score === questions.length ? "var(--positive)" : "var(--review)" }}>
            {score} / {questions.length}
          </span>
        )}
      </div>

      <div className="divide-y divide-line">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <div key={qi} className="p-5">
              <p className="text-sm font-medium text-text-hi">
                <span className="data-mono mr-2 text-signal">{String(qi + 1).padStart(2, "0")}</span>
                {q.q}
              </p>
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isCorrect = oi === q.answer;
                  const state = submitted
                    ? isCorrect
                      ? "correct"
                      : isChosen
                        ? "wrong"
                        : "idle"
                    : isChosen
                      ? "chosen"
                      : "idle";
                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        state === "idle" && "border-line text-text-dim hover:border-line-strong hover:text-text",
                        state === "chosen" && "border-signal-line bg-signal/10 text-text-hi",
                        state === "correct" && "border-positive/40 bg-positive/10 text-text-hi",
                        state === "wrong" && "border-correction/40 bg-correction/10 text-text-hi",
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        {state === "correct" ? (
                          <Check className="size-3.5 text-positive" />
                        ) : state === "wrong" ? (
                          <X className="size-3.5 text-correction" />
                        ) : (
                          <span className="grid size-3.5 place-items-center rounded-full border border-current text-[8px]">
                            {String.fromCharCode(65 + oi)}
                          </span>
                        )}
                      </span>
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-2.5 border-l-2 border-signal-line pl-3 text-xs leading-relaxed text-text-dim">
                  {q.why}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={answered < questions.length}
            className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-40"
          >
            Check answers
          </button>
        ) : (
          <button
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
            className="flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi"
          >
            <RotateCcw className="size-4" /> Try again
          </button>
        )}
        <span className="label-tech ml-auto">
          {submitted ? "Result saved to this study" : `${answered} / ${questions.length} answered`}
        </span>
      </div>
    </div>
  );
}
