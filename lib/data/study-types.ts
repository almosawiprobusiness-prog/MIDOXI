export type StudyNoteKind = "observation" | "principle" | "question" | "action";

export interface StudyNote {
  id: string;
  sessionId: string;
  kind: StudyNoteKind;
  body: string;
  atSeconds?: number | null;
  createdAt: string;
}

export interface StudySession {
  id: string;
  videoId?: string | null;
  title: string;
  goalId?: string | null;
  summary?: string;
  completed: boolean;
  createdAt: string;
}

export interface StudySessionInput {
  videoId?: string | null;
  title: string;
  goalId?: string | null;
  /**
   * 'watch' marks a session whose source is a live match the player
   * watched, not a video in the library (migration 0036). Omitted, the
   * kind is resolved from the video as before.
   */
  sourceKind?: "watch";
}

export interface StudySessionDetail {
  session: StudySession;
  notes: StudyNote[];
}

export const NOTE_KINDS: { kind: StudyNoteKind; label: string; hint: string; color: string }[] = [
  { kind: "observation", label: "Observation", hint: "What did you see?", color: "var(--info)" },
  { kind: "principle", label: "Principle", hint: "What's the rule behind it?", color: "var(--signal-bright)" },
  { kind: "question", label: "Question", hint: "What are you unsure of?", color: "var(--review)" },
  { kind: "action", label: "Action", hint: "What will you apply?", color: "var(--positive)" },
];

export function noteMeta(kind: StudyNoteKind) {
  return NOTE_KINDS.find((n) => n.kind === kind) ?? NOTE_KINDS[0];
}
