import type { LockerData } from "./locker";
import { readinessOf } from "./recovery-types";

/*
  The daily MIDO briefing.

  Deliberately **not** an AI feature. Everything worth saying first thing in the
  morning is already a fact in the locker data — how many days to the match,
  whether you checked in, whether last week's match is still unreviewed. Rules
  produce those instantly, for free, identically every time, and every line can
  be traced to the thing that caused it. Spending a model call to restate facts
  the software already holds would cost money and add doubt.

  Two rules govern what may appear here:

  1. **Every line names its cause.** "Two days to Riverside" is a briefing.
     "You look sharp this week" is a horoscope.
  2. **Nothing is invented, and nothing nags.** A line appears because a
     condition is true, and each has one action attached. Where there is
     genuinely nothing to say, the briefing says that instead of manufacturing
     urgency.
*/

export type BriefingTone = "match" | "body" | "work" | "quiet";

export interface BriefingLine {
  id: string;
  tone: BriefingTone;
  /** The fact. Short enough to read at a glance. */
  headline: string;
  /** Why it is being said, and what it means for today. */
  detail: string;
  action?: { label: string; href: string };
  /** Lower sorts first. */
  priority: number;
}

/** Readiness below this reported figure is worth mentioning. */
export const LOW_READINESS = 55;
/** A match this close changes what today should be. */
export const MATCH_WEEK_DAYS = 3;

/**
 * @param suppress Briefing line ids already covered by a surfaced Next
 * Best Action. The two systems overlap on six of eight lines — see
 * lib/intelligence/overlap.ts — and this is how they coexist without
 * telling somebody to review the same match twice in different words.
 * Empty by default, so the Briefing is unchanged wherever nothing is
 * passed.
 */
export function buildBriefing(data: LockerData, suppress: string[] = []): BriefingLine[] {
  const lines: BriefingLine[] = [];
  const { nextMatch, recentMatch, focus, readiness, week, study, checkedInToday, todayIndex } = data;

  // ── The match, if one is close ──────────────────────────
  if (nextMatch) {
    const d = nextMatch.daysRemaining;
    lines.push({
      id: "match",
      tone: "match",
      headline:
        d === 0
          ? `Matchday — ${nextMatch.home ? "vs" : "away to"} ${nextMatch.opponent}`
          : d === 1
            ? `${nextMatch.home ? "vs" : "Away to"} ${nextMatch.opponent} tomorrow`
            : `${d} days to ${nextMatch.opponent}`,
      detail:
        d === 0
          ? "Everything today serves the game. Nothing new goes in now."
          : d <= MATCH_WEEK_DAYS
            ? `${nextMatch.md} · sharpening, not building. Volume comes down from here.`
            : `${nextMatch.md} · still far enough out to do real work.`,
      action: { label: "Match centre", href: "/app/matches" },
      priority: d <= MATCH_WEEK_DAYS ? 0 : 3,
    });
  }

  // ── The body, but only from what was actually reported ──
  if (!checkedInToday) {
    lines.push({
      id: "checkin",
      tone: "body",
      headline: "You have not checked in today",
      detail:
        "Readiness is built entirely from your check-in. Without it there is nothing to read, and MIDO will not guess.",
      action: { label: "Check in", href: "/app" },
      priority: 1,
    });
  } else if (readiness.latest) {
    /*
      Readiness is derived here with exactly the same arithmetic the Recovery
      page uses — the average of the four reported scores with soreness flipped.
      Two places computing "how ready are you" two different ways is how a
      product ends up contradicting itself on the same morning.
    */
    const r = readinessOf({
      date: readiness.latest.date,
      energy: readiness.latest.energy ?? null,
      soreness: readiness.latest.soreness ?? null,
      sleep: readiness.latest.sleep ?? null,
      mental: readiness.latest.mental ?? null,
      note: null,
    });
    if (r !== null && r < LOW_READINESS) {
      lines.push({
        id: "readiness",
        tone: "body",
        headline: `You reported ${r}/100 this morning`,
        detail:
          // "Below where you usually are" implied a personal baseline
          // nothing here computes. Say only what the number is.
          "That is a low-readiness day. Consider volume over intensity today — and tell whoever is running the session.",
        action: { label: "Recovery", href: "/app/recovery" },
        priority: 0,
      });
    }
  }

  // ── An unreviewed match is the most valuable thing undone ──
  if (recentMatch && !recentMatch.reviewed) {
    lines.push({
      id: "review",
      tone: "work",
      headline: `${recentMatch.opponent} is still unreviewed`,
      detail:
        "The review is where a match turns into something you can train. It gets harder to write the longer you leave it.",
      action: { label: "Review it", href: `/app/matches/${recentMatch.id}` },
      priority: 1,
    });
  }

  // ── Today's schedule ────────────────────────────────────
  const today = week.filter((e) => e.day === todayIndex);
  if (today.length > 0) {
    lines.push({
      id: "schedule",
      tone: "work",
      headline: `${today.length} thing${today.length === 1 ? "" : "s"} scheduled today`,
      detail: today.map((e) => e.label).join(" · "),
      action: { label: "Calendar", href: "/app/calendar" },
      priority: 2,
    });
  }

  // ── What you said you were working on ───────────────────
  const lead = focus[0];
  if (lead) {
    lines.push({
      id: "focus",
      tone: "work",
      headline: `Still working on: ${lead.title}`,
      detail: lead.detail || "Attach something to it today and the progress moves.",
      action: { label: "Development", href: "/app/development" },
      priority: 3,
    });
  }

  // ── The study thread ────────────────────────────────────
  if (study) {
    lines.push({
      id: "study",
      tone: "work",
      headline: `Study open: ${study.title}`,
      detail: `${study.duration}${study.clips ? ` · ${study.clips} clip${study.clips === 1 ? "" : "s"}` : ""}. ${study.detail}`,
      action: { label: "Continue", href: "/app/study" },
      priority: 4,
    });
  }

  // ── Nothing to say is a legitimate answer ───────────────
  if (lines.length === 0) {
    lines.push({
      id: "quiet",
      tone: "quiet",
      headline: "Nothing needs you this morning",
      detail:
        "No match close, nothing unreviewed, nothing scheduled. A quiet day is not a wasted one — pick something to study, or leave it.",
      action: { label: "Study", href: "/app/study" },
      priority: 0,
    });
  }

  /*
    Filtered at the end rather than at each push, so every rule above
    stays readable and unaware that another surface exists. The "quiet"
    line is never suppressed: it appears only when there is nothing to
    say, which cannot be true at the same moment a recommendation is.
  */
  const hidden = new Set(suppress.filter((id) => id !== "quiet"));
  return lines
    .filter((l) => !hidden.has(l.id))
    .sort((a, b) => a.priority - b.priority);
}

/** The greeting line. Time of day only — nothing about the person. */
export function greeting(name: string, now = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}
