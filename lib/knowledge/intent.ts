import { findPerson } from "./people";
import { CONCEPTS } from "./concepts";
import { findCapability, findLimit } from "@/lib/ai/capabilities";
import type { RoleId } from "@/lib/roles/roles";

/*
  The command bar's intent router (spec 12).

  MIDO XI does not treat every typed line as chat. A command is classified and
  routed into the module that owns it, so "Study Harry Kane" opens a study and
  "Build me a striker session" opens the training module with the brief carried
  across. Classification is deterministic and client-safe — no tokens spent
  deciding where a request belongs.

  Anything the fast patterns miss falls through to the capability registry,
  which either names the builder that owns the request or says plainly that MIDO
  cannot build it and why. Nothing is silently dropped — a command bar that
  returns nothing to "build me a set-piece routine" is a command bar that has
  quietly told the user the product is smaller than it is.
*/

export type IntentKind =
  | "study-person"
  | "study-concept"
  | "study-open"
  | "build-session"
  | "review-match"
  | "development"
  | "log-match"
  | "clip"
  /** A request the registry can route, matched loosely rather than by pattern. */
  | "build"
  /** A request MIDO genuinely cannot serve. Answered, not hidden. */
  | "cannot"
  | "question"
  | "navigate";

export interface Intent {
  kind: IntentKind;
  /** What the command bar shows as the action. */
  label: string;
  /** Where it routes. */
  href: string;
  /** Short explanation of what will happen. */
  hint: string;
  /** Extracted subject, when there is one. */
  subject?: string;
}

const STUDY_RE = /^(?:study|learn(?:\s+about)?|analyse|analyze|teach\s+me(?:\s+about)?|break\s+down)\s+(.+)$/i;
const SESSION_RE = /\b(build|create|design|make|plan|give)\b.*\b(session|drill|workout|training|programme|program)\b/i;
const REVIEW_RE = /\b(review|analyse|analyze|break\s*down)\b.*\b(match|game|performance|last\s+game)\b/i;
const DEV_RE = /\b(what|where)\b.*\b(improve|work on|focus|better|weakness)\b/i;
const LOG_RE = /\b(log|add|record)\b.*\b(match|game|fixture)\b/i;
const CLIP_RE = /\b(clip|film|video|upload|footage)\b/i;
const QUIZ_RE = /\b(quiz|test)\s+me\b/i;

function encode(s: string): string {
  return encodeURIComponent(s.trim());
}

/**
 * "Study <subject>" where the subject is genuinely in the curated library.
 *
 * Split out because it has to run before the refusals: someone asking to study
 * expected goals as an *idea* is asking a legitimate question, even though
 * asking MIDO for their own xG number is something it refuses. The difference
 * is whether the subject resolves to something curated.
 */
function curatedStudy(input: string): Intent | null {
  const study = input.match(STUDY_RE);
  if (!study) return null;
  const subject = study[1].replace(/[?.!]+$/, "").trim();

  const p = findPerson(subject);
  if (p) {
    return {
      kind: "study-person",
      label: `Study ${p.name}`,
      href: `/app/study/${p.slug}`,
      hint:
        p.kind === "coach"
          ? "Tactical philosophy, structures and how to train them"
          : "Their game, broken down through your position",
      subject: p.name,
    };
  }

  const c = CONCEPTS.find(
    (x) =>
      x.name.toLowerCase() === subject.toLowerCase() ||
      x.name.toLowerCase().includes(subject.toLowerCase()) ||
      subject.toLowerCase().includes(x.name.toLowerCase()),
  );
  if (c) {
    return {
      kind: "study-concept",
      label: `Study ${c.name}`,
      href: `/app/study/concept/${c.slug}`,
      hint: c.definition,
      subject: c.name,
    };
  }
  return null;
}

/**
 * Classify a command. Returns the best route, or a `question` intent that hands
 * the line to MIDO with the current role as context.
 */
export function parseIntent(raw: string, role: RoleId = "player"): Intent | null {
  const input = raw.trim();
  if (!input) return null;

  /*
    Order matters here, and it is not the order the patterns were written in.

    A curated subject wins outright: "Study Harry Kane" resolves to a real
    person in the library, and nothing should second-guess that.

    Everything else is checked against the refusals BEFORE any loose pattern
    gets a turn. "Analyse this clip and tell me the sprint count" mentions film,
    so a film pattern would happily claim it — and the user would arrive in a
    tool that cannot count sprints and does not say so. The honest answer has to
    outrank the convenient route.
  */
  const curated = curatedStudy(input);
  if (curated) return curated;

  const limit = findLimit(input);
  if (limit) {
    return {
      kind: "cannot",
      label: `MIDO does not do this: ${limit.asked.toLowerCase()}`,
      href: "/app/study",
      hint: limit.wouldNeed ? `${limit.why} Needs: ${limit.wouldNeed}` : limit.why,
      subject: input,
    };
  }

  // "Study <subject>" that resolved to nothing curated — offer to build it.
  const study = input.match(STUDY_RE);
  if (study) {
    const subject = study[1].replace(/[?.!]+$/, "").trim();
    return {
      kind: "study-open",
      label: `Study "${subject}"`,
      href: `/app/study?q=${encode(subject)}`,
      hint: "Not in the curated library yet — MIDO will offer to build this study",
      subject,
    };
  }

  if (QUIZ_RE.test(input)) {
    return {
      kind: "study-open",
      label: "Test what you know",
      href: `/app/study?q=${encode(input)}`,
      hint: "Knowledge checks live inside your studies",
    };
  }

  if (SESSION_RE.test(input)) {
    return {
      kind: "build-session",
      label: "Build a session",
      href: `/app/training?brief=${encode(input)}`,
      hint: role === "coach" ? "Opens the training module with your brief" : "Turns this into a session you can log",
      subject: input,
    };
  }

  if (REVIEW_RE.test(input)) {
    return {
      kind: "review-match",
      label: "Review a match",
      href: "/app/matches",
      hint: "Open the match centre and run a post-match review",
    };
  }

  if (LOG_RE.test(input)) {
    return { kind: "log-match", label: "Log a match", href: "/app/matches", hint: "Add a fixture or result" };
  }

  if (DEV_RE.test(input)) {
    return {
      kind: "development",
      label: "What to work on",
      href: "/app/development",
      hint: "Your development map, goals and the evidence behind them",
    };
  }

  if (CLIP_RE.test(input)) {
    return { kind: "clip", label: "Open the Film Room", href: "/app/film-room", hint: "Clips, tags and study sessions" };
  }

  // Nothing above matched. Ask the registry which builder owns this.
  const cap = findCapability(input, role);
  if (cap) {
    return {
      kind: "build",
      label: cap.builds,
      href: `${cap.href}?brief=${encode(input)}`,
      hint: cap.produces,
      subject: input,
    };
  }

  return null;
}
