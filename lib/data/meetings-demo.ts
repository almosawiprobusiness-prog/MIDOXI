import type { Meeting, MeetingDetail, MeetingPerson } from "./meeting-types";
import type { MeetingQuery } from "./meetings";

/*
  Demo meetings.

  Demo mode is why the community section shipped over three tables that
  did not exist — it renders green whatever the schema is. So the rule
  here is that the demo shows the same SHAPES the real adapter returns
  and never a field the real one cannot fill.

  Times are relative to now so the list is always sensibly ordered and
  one meeting is always joinable, which is the state worth showing.
*/

const at = (hours: number, minutes = 0) =>
  new Date(Date.now() + hours * 3600_000 + minutes * 60_000).toISOString();

const COACH: MeetingPerson = {
  id: "demo-coach",
  name: "Dan Whitmore",
  handle: "danw",
  avatar: null,
  position: null,
};

const PLAYER: MeetingPerson = {
  id: "demo-player-2",
  name: "Sam Oyelaran",
  handle: "sam_o",
  avatar: null,
  position: "RB",
};

const MEETINGS: Meeting[] = [
  {
    id: "m1",
    kind: "film",
    title: "Northgate away — first half",
    note: "Bring the two build-up clips you flagged.",
    // Live right now, so the join button is in its interesting state.
    startsAt: at(0, -12),
    endsAt: at(0, 33),
    status: "confirmed",
    videoProvider: "daily",
    videoRoom: "demo-room-1",
    externalUrl: null,
    withPerson: COACH,
    organiser: false,
    createdAt: at(-72),
  },
  {
    id: "m2",
    kind: "check_in",
    title: "Weekly check-in",
    note: null,
    startsAt: at(26),
    endsAt: at(26, 30),
    status: "confirmed",
    videoProvider: "daily",
    videoRoom: "demo-room-2",
    externalUrl: null,
    withPerson: COACH,
    organiser: false,
    createdAt: at(-120),
  },
  {
    id: "m3",
    kind: "review",
    title: "Scanning block — where it got to",
    note: "Half an hour, no rush.",
    startsAt: at(74),
    endsAt: at(74, 45),
    // Waiting on the other side, which is the state the accept/decline UI needs.
    status: "proposed",
    videoProvider: null,
    videoRoom: null,
    externalUrl: null,
    withPerson: PLAYER,
    organiser: true,
    createdAt: at(-4),
  },
  {
    id: "m4",
    kind: "film",
    title: "Pressing triggers — clips 3 to 9",
    note: null,
    startsAt: at(-168),
    endsAt: at(-167),
    status: "done",
    videoProvider: "daily",
    videoRoom: "demo-room-4",
    externalUrl: null,
    withPerson: COACH,
    organiser: false,
    createdAt: at(-240),
  },
];

export function demoMeetings(q: MeetingQuery = {}): Meeting[] {
  const scope = q.scope ?? "upcoming";
  const now = Date.now();
  const rows =
    scope === "upcoming"
      ? MEETINGS.filter((m) => Date.parse(m.endsAt) >= now).sort(
          (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
        )
      : scope === "past"
        ? MEETINGS.filter((m) => Date.parse(m.endsAt) < now).sort(
            (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
          )
        : [...MEETINGS].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return rows.slice(0, Math.min(q.limit ?? 50, 200));
}

export function demoMeetingDetail(id: string): MeetingDetail | null {
  const m = MEETINGS.find((x) => x.id === id);
  if (!m) return null;

  const agenda =
    m.id === "m1"
      ? [
          {
            id: "a1", position: 1, kind: "clip" as const,
            title: "Third man run, 12th minute",
            body: "Watch the shoulder check before the ball arrives.",
            refClip: "demo-clip-1", refStudy: null, refVideo: "demo-video-1", refGoal: null,
            atSeconds: 734, done: true, addedBy: "demo-coach", mine: false,
          },
          {
            id: "a2", position: 2, kind: "clip" as const,
            title: "Same pattern, other side",
            body: null,
            refClip: "demo-clip-2", refStudy: null, refVideo: "demo-video-1", refGoal: null,
            atSeconds: 1288, done: false, addedBy: "demo-coach", mine: false,
          },
          {
            id: "a3", position: 3, kind: "note" as const,
            title: "Ask about the weak-foot work",
            body: "Three sessions in — is it transferring?",
            refClip: null, refStudy: null, refVideo: null, refGoal: null,
            atSeconds: null, done: false, addedBy: "demo-player", mine: true,
          },
          {
            id: "a4", position: 4, kind: "goal" as const,
            title: "Scanning before receiving",
            body: null,
            refClip: null, refStudy: null, refVideo: null, refGoal: "demo-goal-1",
            atSeconds: null, done: false, addedBy: "demo-player", mine: true,
          },
        ]
      : [];

  return {
    ...m,
    agenda,
    // m3 is the one somebody has asked to move, so the propose/accept
    // path has something to render.
    openProposal:
      m.id === "m3"
        ? {
            id: "p1",
            startsAt: at(98),
            endsAt: at(98, 45),
            note: "Training moved — could we do Thursday instead?",
            proposedBy: "demo-player-2",
            mine: false,
            status: "pending" as const,
            createdAt: at(-2),
          }
        : null,
    history: [
      { action: "created", actorId: m.organiser ? "demo-player" : m.withPerson.id, at: m.createdAt, detail: {} },
      ...(m.status === "confirmed"
        ? [{ action: "accepted", actorId: m.organiser ? m.withPerson.id : "demo-player", at: at(-70), detail: {} }]
        : []),
      ...(m.id === "m3"
        ? [{ action: "proposed_time", actorId: "demo-player-2", at: at(-2), detail: { note: "Training moved" } }]
        : []),
    ],
  };
}
