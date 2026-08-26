import type { Match, DevelopmentGoal } from "@/lib/types";
import type { MatchInput, MatchStatsInput, MatchReviewInput } from "./match-types";
import type { GoalInput, EvidenceInput, EvidenceEntry } from "./development-types";
import type { TrainingInput, TrainingEntry } from "./training-types";
import type { CalendarInput, CalendarEvent } from "./calendar-types";
import type { VideoInput, Video, ClipInput, FilmClip, Collection } from "./film-types";
import type { StudySession, StudyNote, StudySessionInput, StudyNoteKind } from "./study-types";
import type { FeedPost, PostComment, PostClip } from "./community-types";

const DEMO_UID = "demo";

interface DemoPost {
  id: string; userId: string; authorName: string; authorHandle: string | null;
  authorPosition: string | null; authorAvatar: string | null;
  title: string; body: string; clip: PostClip | null; tags: string[]; createdAt: string;
}

/*
  DEMO STORE — in-memory, dev/demo only. Backs the app when Supabase
  isn't configured so the CRUD flows are genuinely functional (and
  testable) in the browser. Cached on globalThis to survive HMR.
  In real mode this is never touched — Supabase is the store.
  NB: process-local + non-persistent by design; resets on restart.
*/

interface DemoDB {
  matches: Match[];
  stats: Record<string, MatchStatsInput>;
  reviews: Record<string, MatchReviewInput>;
  goals: DevelopmentGoal[];
  evidence: EvidenceEntry[];
  training: TrainingEntry[];
  events: CalendarEvent[];
  videos: Video[];
  clips: FilmClip[];
  collections: { id: string; name: string; createdAt: string }[];
  collectionClips: { collectionId: string; clipId: string }[];
  studySessions: StudySession[];
  studyNotes: StudyNote[];
  posts: DemoPost[];
  comments: PostComment[];
  reactions: { postId: string; userId: string }[];
}

/** Local ISO (no timezone) for a Date, matching datetime-local values. */
function localISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Monday of the current week at 00:00. */
function weekMonday(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function atDay(offset: number, hh: number, mm = 0) {
  const d = weekMonday();
  d.setDate(d.getDate() + offset);
  d.setHours(hh, mm, 0, 0);
  return localISO(d);
}

/** N whole days ago at a given local time. Seeds use this so the demo never ages. */
function daysAgoAt(days: number, hh: number, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hh, mm, 0, 0);
  return localISO(d);
}

/*
  THE ONE SEEDED SEASON.

  This store is the demo's single world — Timeline, Match Center, Film,
  Training and Performance all describe THESE rows. It was not always so:
  the performance page once carried a private six-match season of its
  own, so a player flipping between two screens saw two different match
  histories with two different opponents, and the locker froze its
  fixture at a hardcoded "3 days out" while this file computed 4. Every
  seeded fact lives here now, and every date is relative, so the demo
  reads the same on any day it is opened.

  The recent three (Halton, Carlton, Ashwell) are load-bearing: clips,
  reviews, the timeline narrative and the locker's recent-match panel
  all reference them by id. The older three exist to give Performance a
  season worth charting. Only Halton has the full written-down stat
  line; the others carry the handful of numbers a player plausibly
  records — a demo that shows Opta-grade coverage of every match is
  promising something the product cannot do.
*/
function seedMatches(): Match[] {
  return [
    { id: "m_ip", opponent: "Halton Town", opponentShort: "HAL", competition: "Pre-Season Cup · Final", date: daysAgoAt(12, 15), home: false, goalsFor: 2, goalsAgainst: 1, formation: "4-3-3", position: "CF", started: true, minutes: 78, rating: 7.6, goals: 1, assists: 1, reviewed: true },
    { id: "m_02", opponent: "Carlton United", opponentShort: "CAR", competition: "Pre-Season · Friendly", date: daysAgoAt(19, 15), home: true, goalsFor: 3, goalsAgainst: 0, formation: "4-3-3", position: "CF", started: true, minutes: 65, rating: 8.1, goals: 2, assists: 0, reviewed: false },
    { id: "m_03", opponent: "Ashwell Rangers", opponentShort: "ASH", competition: "Pre-Season · Friendly", date: daysAgoAt(26, 13), home: false, goalsFor: 1, goalsAgainst: 1, formation: "4-2-3-1", position: "RW", started: false, minutes: 32, rating: 6.4, goals: 0, assists: 1, reviewed: false },
    { id: "m_04", opponent: "Marden Rovers", opponentShort: "MAR", competition: "Pre-Season · Friendly", date: daysAgoAt(33, 15), home: true, goalsFor: 1, goalsAgainst: 2, formation: "4-3-3", position: "CF", started: true, minutes: 71, rating: 6.8, goals: 1, assists: 0, reviewed: true },
    { id: "m_05", opponent: "Colby Athletic", opponentShort: "COL", competition: "Friendly", date: daysAgoAt(40, 14), home: false, goalsFor: 2, goalsAgainst: 2, formation: "4-2-3-1", position: "CF", started: false, minutes: 45, rating: 6.7, goals: 0, assists: 1, reviewed: true },
    { id: "m_06", opponent: "Deanwood", opponentShort: "DEA", competition: "Friendly", date: daysAgoAt(47, 15), home: true, goalsFor: 4, goalsAgainst: 1, formation: "4-3-3", position: "CF", started: true, minutes: 82, rating: 7.0, goals: 0, assists: 0, reviewed: true },
  ];
}

function seedStats(): Record<string, MatchStatsInput> {
  return {
    m_ip: { shots: 4, shotsOnTarget: 2, touches: 41, passes: 22, passPct: 82, keyPasses: 2, chancesCreated: 3, dribbles: 3, duelsWon: 7, duelsTotal: 11, aerialsWon: 3, recoveries: 4, interceptions: 1, tackles: 2, foulsWon: 3, foulsCommitted: 2, offsides: 1, yellow: 0, red: 0 },
    m_02: { shots: 5, shotsOnTarget: 3, chancesCreated: 1, keyPasses: 1, duelsWon: 6, aerialsWon: 4 },
    m_03: { shots: 2, shotsOnTarget: 1, chancesCreated: 2, keyPasses: 3, duelsWon: 4, aerialsWon: 1 },
    m_04: { shots: 3, shotsOnTarget: 2, chancesCreated: 0, keyPasses: 1, duelsWon: 3, aerialsWon: 2 },
    m_05: { shots: 1, shotsOnTarget: 0, chancesCreated: 1, keyPasses: 1, duelsWon: 2, aerialsWon: 1 },
    m_06: { shots: 3, shotsOnTarget: 1, chancesCreated: 1, keyPasses: 2, duelsWon: 5, aerialsWon: 3 },
  };
}

function seedReviews(): Record<string, MatchReviewInput> {
  return {
    m_ip: { didWell: "Movement in behind was sharp — timed the run for the goal well.", couldImprove: "Cut back at the near post instead of finishing early.", repeated: "Attacking runs a beat too early again.", momentToStudy: "67:14 — the winning run behind the CB.", intoTraining: "Delayed blindside runs + near-post finishing reps.", selfRating: 7, confidence: 4, physicalFeel: 4, mentalFeel: 5 },
  };
}

function seedGoals(): DevelopmentGoal[] {
  return [
    { id: "g1", index: 1, category: "technical", title: "Near-post finishing", status: "active", createdLabel: "Aug 2026", why: "I arrive correctly but finish across goal too often. Front-post is open.", evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 }, progress: 46 },
    { id: "g2", index: 2, category: "tactical", title: "Pressing trigger recognition", status: "active", createdLabel: "Jul 2026", why: "First press is a beat late — I react to the ball, not the touch.", evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 }, progress: 62 },
    { id: "g3", index: 3, category: "positional", title: "Blindside movement", status: "monitoring", createdLabel: "Jul 2026", why: "Show for the ball too early — CB tracks me the whole way.", evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 }, progress: 38 },
  ];
}

function seedEvidence(): EvidenceEntry[] {
  const e = (id: string, goalId: string, kind: EvidenceEntry["kind"], note: string, day: string): EvidenceEntry => ({
    id, goalId, kind, note, createdAt: `2026-08-${day}T12:00:00`,
  });
  return [
    e("e1", "g1", "match", "vs Halton — cut back at the near post instead of finishing early.", "09"),
    e("e2", "g1", "film", "41:02 near-post arrival — right zone, wrong choice.", "10"),
    e("e3", "g1", "insight", "Attack the front zone: commit to the early finish across the keeper.", "10"),
    e("e4", "g1", "training", "Near-post finishing — 30 reps, first-time across the front zone.", "11"),
    e("e5", "g2", "film", "12:48 late first press — reacted to the pass, not the touch.", "09"),
    e("e6", "g2", "insight", "Trigger = the CB's open body shape before the ball arrives.", "10"),
    e("e7", "g2", "training", "Pressing shadow drill — curve the run to lock the inside.", "11"),
    e("e8", "g3", "match", "67:14 run in behind for the goal — waited for the CB to check the ball.", "09"),
    e("e9", "g3", "insight", "Start outside the defender's field of vision before the switch.", "10"),
  ];
}

function seedTraining(): TrainingEntry[] {
  const thisWeek: TrainingEntry[] = [
    { id: "t1", kind: "team", title: "Team Training", scheduledAt: atDay(1, 10, 30), durationMin: 90, objective: "Attacking patterns in the final third", rpe: 7, physicalFeel: 4, technicalFeel: 4, improved: "Timing of the third-man run.", feltOff: "" },
    { id: "t2", kind: "gym", title: "Lower Power", scheduledAt: atDay(1, 13, 0), durationMin: 45, objective: "Trap-bar + jumps", rpe: 8, physicalFeel: 3, technicalFeel: 3, improved: "", feltOff: "Left hip a little tight." },
    { id: "t3", kind: "individual", title: "Finishing · Individual", scheduledAt: atDay(2, 12, 30), durationMin: 40, objective: "Near-post finishing — 30 reps", rpe: 6, physicalFeel: 4, technicalFeel: 5, improved: "First-time finishes across the front zone.", feltOff: "" },
  ];

  /*
    The season behind this week. A semi-professional rhythm — two team
    nights and a gym slot most weeks, which is also what the seeded
    memory says this player can actually do. Sparse detail on purpose:
    a player does not annotate every Tuesday from six weeks ago, and a
    history where every old session has notes reads as manufactured.
    These give the workload chart a real eight weeks and the timeline a
    season, without touching the training page's this-week view.
  */
  const past: TrainingEntry[] = [];
  const rhythm: { day: number; hh: number; kind: TrainingEntry["kind"]; title: string; min: number; rpe: number }[] = [
    { day: 1, hh: 19, kind: "team", title: "Team Training", min: 90, rpe: 7 },
    { day: 3, hh: 19, kind: "team", title: "Team Training", min: 90, rpe: 7 },
    { day: 4, hh: 17, kind: "gym", title: "Gym — Lower", min: 45, rpe: 8 },
  ];
  for (let week = 1; week <= 7; week++) {
    for (const r of rhythm) {
      // One session a fortnight goes unlogged, because real logs have holes.
      if (week % 2 === 0 && r.kind === "gym") continue;
      const d = weekMonday();
      d.setDate(d.getDate() - week * 7 + r.day);
      d.setHours(r.hh, 0, 0, 0);
      past.push({
        id: `th_${week}_${r.day}`,
        kind: r.kind,
        title: r.title,
        scheduledAt: localISO(d),
        durationMin: r.min,
        rpe: r.rpe,
        objective: "",
        physicalFeel: null,
        technicalFeel: null,
        improved: "",
        feltOff: "",
      });
    }
  }

  return [...thisWeek, ...past];
}

function seedEvents(): CalendarEvent[] {
  return [
    { id: "c1", kind: "recovery", title: "Recovery + Pool", startsAt: atDay(0, 10, 0), mdTag: "MD-5" },
    { id: "c2", kind: "team", title: "Team Training", startsAt: atDay(1, 10, 30), mdTag: "MD-4" },
    { id: "c3", kind: "gym", title: "Lower Power", startsAt: atDay(1, 13, 0) },
    { id: "c4", kind: "team", title: "Team Training", startsAt: atDay(2, 10, 30), mdTag: "MD-3" },
    { id: "c5", kind: "individual", title: "Finishing · Individual", startsAt: atDay(2, 12, 30) },
    { id: "c6", kind: "tactical", title: "Opposition Shape", startsAt: atDay(3, 10, 30), mdTag: "MD-2" },
    { id: "c7", kind: "team", title: "Activation + Set Pieces", startsAt: atDay(4, 11, 0), mdTag: "MD-1" },
    { id: "c8", kind: "film", title: "Opponent Study · RIV", startsAt: atDay(4, 15, 0) },
    { id: "c9", kind: "match", title: "Riverside Athletic (H)", startsAt: atDay(5, 15, 0), mdTag: "MD" },
    { id: "c10", kind: "recovery", title: "Recovery", startsAt: atDay(6, 11, 0), mdTag: "MD+1" },
  ];
}

// Reliable public-domain sample so the player + clip tooling is testable
// in demo. Real users upload their own match footage.
// A public sample that both plays and permits frame reading (sends
// access-control-allow-origin: *), so demo mode can demonstrate film analysis.
// The previous Google sample bucket now returns 403.
const SAMPLE_MP4 = "https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4";

function seedVideos(): Video[] {
  return [
    { id: "v_demo", title: "Demo footage · vs Halton (sample)", source: "url", url: SAMPLE_MP4, durationSeconds: 15, matchId: "m_ip", status: "ready", createdAt: "2026-08-09T18:00:00" },
    { id: "v_yt", title: "Study · Blindside movement analysis", source: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", externalId: "dQw4w9WgXcQ", status: "ready", createdAt: "2026-08-10T09:00:00" },
  ];
}

function seedClips(): FilmClip[] {
  return [
    { id: "clip1", videoId: "v_demo", matchId: "m_ip", goalId: "g3", title: "Run in behind — goal", startSeconds: 4, endSeconds: 8, sentiment: "positive", note: "Waited until the CB checked the ball before accelerating.", favorite: true, tags: ["Movement", "Timing", "Final Third"], createdAt: "2026-08-09T18:10:00" },
    { id: "clip2", videoId: "v_demo", matchId: "m_ip", goalId: "g1", title: "Near-post arrival", startSeconds: 9, endSeconds: 12, sentiment: "review", note: "Right zone, right time — chose to cut back instead of finishing early.", favorite: false, tags: ["Finishing", "Decision Making"], createdAt: "2026-08-09T18:12:00" },
    { id: "clip3", videoId: "v_demo", matchId: "m_ip", goalId: "g2", title: "Late first press", startSeconds: 1, endSeconds: 3, sentiment: "correction", note: "Reacted to the pass, not the touch.", favorite: false, tags: ["Pressing", "Transition"], createdAt: "2026-08-09T18:14:00" },
  ];
}

function seedStudy(): { sessions: StudySession[]; notes: StudyNote[] } {
  return {
    sessions: [
      { id: "ss_demo", videoId: "v_demo", title: "My Match — Blindside review", goalId: "g3", summary: "", completed: false, createdAt: "2026-08-10T10:00:00" },
    ],
    notes: [
      { id: "sn1", sessionId: "ss_demo", kind: "observation", body: "CB watches the ball during the switch.", atSeconds: 4, createdAt: "2026-08-10T10:02:00" },
      { id: "sn2", sessionId: "ss_demo", kind: "principle", body: "Start outside his field of vision, explode after his eyes shift.", atSeconds: 5, createdAt: "2026-08-10T10:03:00" },
    ],
  };
}

function seedCommunity(): { posts: DemoPost[]; comments: PostComment[]; reactions: { postId: string; userId: string }[] } {
  return {
    posts: [
      {
        id: "post_1", userId: DEMO_UID, authorName: "MIDO", authorHandle: "mido9", authorPosition: "CF", authorAvatar: null,
        title: "Reading the CB before the run",
        body: "Been drilling this — waiting until the centre-back's eyes drop to the ball before I break the line. Split-second later and I'm onside AND behind him. Clip from the weekend below. How do you time yours?",
        clip: { title: "Run in behind — goal", start: 4, tags: ["Movement", "Timing"], sentiment: "positive", videoSource: "youtube", videoExternalId: "dQw4w9WgXcQ" },
        tags: ["Movement", "Strikers"], createdAt: "2026-08-09T20:00:00",
      },
      {
        id: "post_2", userId: "u_lena", authorName: "Lena K.", authorHandle: "lenak8", authorPosition: "8", authorAvatar: null,
        title: "Receiving on the half-turn under pressure",
        body: "Midfielders — what's your first cue to know you can turn? For me it's the far shoulder check. If the presser is tight I bounce it, if there's a yard I open up. Curious how others read it.",
        clip: null,
        tags: ["Midfield", "First Touch"], createdAt: "2026-08-10T08:30:00",
      },
    ],
    comments: [
      { id: "cm_1", postId: "post_1", userId: "u_lena", authorName: "Lena K.", authorHandle: "lenak8", body: "The eyes-drop cue is huge. I coach my forwards to watch the defender's hips too — they open before the ball does.", createdAt: "2026-08-09T20:40:00" },
    ],
    reactions: [{ postId: "post_1", userId: "u_lena" }, { postId: "post_2", userId: DEMO_UID }],
  };
}

function createDB(): DemoDB {
  const study = seedStudy();
  const community = seedCommunity();
  return {
    matches: seedMatches(),
    stats: seedStats(),
    reviews: seedReviews(),
    goals: seedGoals(),
    evidence: seedEvidence(),
    training: seedTraining(),
    events: seedEvents(),
    videos: seedVideos(),
    clips: seedClips(),
    collections: [{ id: "col_box", name: "Movement in the box", createdAt: "2026-08-09T19:00:00" }],
    collectionClips: [
      { collectionId: "col_box", clipId: "clip1" },
      { collectionId: "col_box", clipId: "clip2" },
    ],
    studySessions: study.sessions,
    studyNotes: study.notes,
    posts: community.posts,
    comments: community.comments,
    reactions: community.reactions,
  };
}

const g = globalThis as unknown as { __midoDemoDB?: DemoDB };
// Rebuild if missing or if the cached shape predates a schema change (HMR).
if (!g.__midoDemoDB || !g.__midoDemoDB.goals || !g.__midoDemoDB.evidence || !g.__midoDemoDB.training || !g.__midoDemoDB.events || !g.__midoDemoDB.videos || !g.__midoDemoDB.clips || !g.__midoDemoDB.collections || !g.__midoDemoDB.studySessions || !g.__midoDemoDB.posts) {
  g.__midoDemoDB = createDB();
}
const db: DemoDB = g.__midoDemoDB;

function shortCode(opponent: string) {
  return opponent.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "OPP";
}

/** Recompute a goal's evidence-count summary from its entries. */
function withCounts(goal: DevelopmentGoal): DevelopmentGoal {
  const ev = db.evidence.filter((e) => e.goalId === goal.id);
  return {
    ...goal,
    evidence: {
      clips: ev.filter((e) => e.kind === "film").length,
      training: ev.filter((e) => e.kind === "training").length,
      study: ev.filter((e) => e.kind === "insight").length,
      coachNotes: ev.filter((e) => e.kind === "coach").length,
      matches: ev.filter((e) => e.kind === "match").length,
    },
  };
}

export const demoStore = {
  // ---- matches ----
  listMatches(): Match[] {
    return [...db.matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  getMatch(id: string) {
    const match = db.matches.find((m) => m.id === id);
    if (!match) return null;
    return { match, stats: db.stats[id] ?? null, review: db.reviews[id] ?? null };
  },
  createMatch(input: MatchInput): string {
    const id = `m_${crypto.randomUUID().slice(0, 8)}`;
    db.matches.push({ id, opponent: input.opponent, opponentShort: shortCode(input.opponent), competition: input.competition ?? "", date: input.playedAt, home: input.home, goalsFor: input.goalsFor ?? 0, goalsAgainst: input.goalsAgainst ?? 0, formation: input.formation ?? "", position: (input.position as Match["position"]) ?? "CF", started: input.started, minutes: input.minutes ?? 0, rating: input.rating ?? 0, goals: input.goals, assists: input.assists, reviewed: false });
    return id;
  },
  updateMatch(id: string, input: MatchInput): boolean {
    const i = db.matches.findIndex((m) => m.id === id);
    if (i === -1) return false;
    const prev = db.matches[i];
    db.matches[i] = { ...prev, opponent: input.opponent, opponentShort: shortCode(input.opponent), competition: input.competition ?? "", date: input.playedAt, home: input.home, goalsFor: input.goalsFor ?? 0, goalsAgainst: input.goalsAgainst ?? 0, formation: input.formation ?? "", position: (input.position as Match["position"]) ?? prev.position, started: input.started, minutes: input.minutes ?? 0, rating: input.rating ?? 0, goals: input.goals, assists: input.assists };
    return true;
  },
  deleteMatch(id: string): boolean {
    const before = db.matches.length;
    db.matches = db.matches.filter((m) => m.id !== id);
    delete db.stats[id];
    delete db.reviews[id];
    return db.matches.length < before;
  },
  saveStats(id: string, stats: MatchStatsInput) {
    db.stats[id] = stats;
  },
  saveReview(id: string, review: MatchReviewInput) {
    db.reviews[id] = review;
    const m = db.matches.find((x) => x.id === id);
    if (m) m.reviewed = true;
  },

  // ---- development goals ----
  listGoals(): DevelopmentGoal[] {
    return db.goals.map(withCounts);
  },
  getGoal(id: string) {
    const goal = db.goals.find((x) => x.id === id);
    if (!goal) return null;
    const evidence = db.evidence
      .filter((e) => e.goalId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { goal: withCounts(goal), evidence };
  },
  createGoal(input: GoalInput): string {
    const id = `g_${crypto.randomUUID().slice(0, 8)}`;
    db.goals.push({
      id,
      index: db.goals.length + 1,
      category: input.category,
      title: input.title,
      status: input.status,
      createdLabel: new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      why: input.why ?? "",
      evidence: { clips: 0, training: 0, study: 0, coachNotes: 0 },
      progress: input.progress,
    });
    return id;
  },
  updateGoal(id: string, input: GoalInput): boolean {
    const i = db.goals.findIndex((x) => x.id === id);
    if (i === -1) return false;
    db.goals[i] = { ...db.goals[i], category: input.category, title: input.title, why: input.why ?? "", status: input.status, progress: input.progress };
    return true;
  },
  deleteGoal(id: string): boolean {
    const before = db.goals.length;
    db.goals = db.goals.filter((x) => x.id !== id);
    db.evidence = db.evidence.filter((e) => e.goalId !== id);
    return db.goals.length < before;
  },
  addEvidence(goalId: string, input: EvidenceInput): string {
    const id = `e_${crypto.randomUUID().slice(0, 8)}`;
    db.evidence.push({ id, goalId, kind: input.kind, note: input.note, createdAt: new Date().toISOString() });
    return id;
  },
  deleteEvidence(id: string): boolean {
    const before = db.evidence.length;
    db.evidence = db.evidence.filter((e) => e.id !== id);
    return db.evidence.length < before;
  },

  // ---- training ----
  /** Every stat line in the store, keyed by match id. For derived views. */
  listStats(): Record<string, MatchStatsInput> {
    return { ...db.stats };
  },
  listTraining(): TrainingEntry[] {
    return [...db.training].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  },
  createTraining(input: TrainingInput): string {
    const id = `t_${crypto.randomUUID().slice(0, 8)}`;
    db.training.push({ id, ...input });
    return id;
  },
  updateTraining(id: string, input: TrainingInput): boolean {
    const i = db.training.findIndex((x) => x.id === id);
    if (i === -1) return false;
    db.training[i] = { id, ...input };
    return true;
  },
  deleteTraining(id: string): boolean {
    const before = db.training.length;
    db.training = db.training.filter((x) => x.id !== id);
    return db.training.length < before;
  },

  // ---- calendar ----
  listEvents(): CalendarEvent[] {
    return [...db.events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  },
  createEvent(input: CalendarInput): string {
    const id = `c_${crypto.randomUUID().slice(0, 8)}`;
    db.events.push({ id, ...input });
    return id;
  },
  updateEvent(id: string, input: CalendarInput): boolean {
    const i = db.events.findIndex((x) => x.id === id);
    if (i === -1) return false;
    db.events[i] = { id, ...input };
    return true;
  },
  deleteEvent(id: string): boolean {
    const before = db.events.length;
    db.events = db.events.filter((x) => x.id !== id);
    return db.events.length < before;
  },

  // ---- film: videos ----
  listVideos(): Video[] {
    return [...db.videos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  getVideo(id: string) {
    const video = db.videos.find((v) => v.id === id);
    if (!video) return null;
    const clips = db.clips
      .filter((c) => c.videoId === id)
      .sort((a, b) => a.startSeconds - b.startSeconds);
    return { video, clips };
  },
  createVideo(input: VideoInput): string {
    const id = `v_${crypto.randomUUID().slice(0, 8)}`;
    db.videos.push({
      id,
      title: input.title,
      source: input.source,
      url: input.url,
      externalId: input.externalId,
      matchId: input.matchId ?? null,
      status: "ready",
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  deleteVideo(id: string): boolean {
    const before = db.videos.length;
    db.videos = db.videos.filter((v) => v.id !== id);
    db.clips = db.clips.filter((c) => c.videoId !== id);
    return db.videos.length < before;
  },

  // ---- film: clips ----
  listClips(): FilmClip[] {
    return [...db.clips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  createClip(input: ClipInput): string {
    const id = `clip_${crypto.randomUUID().slice(0, 8)}`;
    db.clips.push({
      id,
      videoId: input.videoId,
      matchId: input.matchId ?? null,
      goalId: input.goalId ?? null,
      title: input.title,
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds ?? null,
      sentiment: input.sentiment ?? null,
      note: input.note ?? "",
      favorite: false,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updateClip(id: string, input: Partial<ClipInput>): boolean {
    const i = db.clips.findIndex((c) => c.id === id);
    if (i === -1) return false;
    db.clips[i] = { ...db.clips[i], ...input, tags: input.tags ?? db.clips[i].tags };
    return true;
  },
  deleteClip(id: string): boolean {
    const before = db.clips.length;
    db.clips = db.clips.filter((c) => c.id !== id);
    return db.clips.length < before;
  },
  toggleClipFavorite(id: string): boolean {
    const c = db.clips.find((x) => x.id === id);
    if (!c) return false;
    c.favorite = !c.favorite;
    return c.favorite;
  },

  // ---- collections ----
  listCollections(): Collection[] {
    return db.collections
      .map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        clipCount: db.collectionClips.filter((cc) => cc.collectionId === c.id).length,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  getCollection(id: string) {
    const col = db.collections.find((c) => c.id === id);
    if (!col) return null;
    const clipIds = db.collectionClips.filter((cc) => cc.collectionId === id).map((cc) => cc.clipId);
    const clips = db.clips
      .filter((c) => clipIds.includes(c.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { collection: { ...col, clipCount: clips.length }, clips };
  },
  createCollection(name: string): string {
    const id = `col_${crypto.randomUUID().slice(0, 8)}`;
    db.collections.push({ id, name, createdAt: new Date().toISOString() });
    return id;
  },
  deleteCollection(id: string): boolean {
    const before = db.collections.length;
    db.collections = db.collections.filter((c) => c.id !== id);
    db.collectionClips = db.collectionClips.filter((cc) => cc.collectionId !== id);
    return db.collections.length < before;
  },
  addClipToCollection(collectionId: string, clipId: string) {
    if (!db.collectionClips.some((cc) => cc.collectionId === collectionId && cc.clipId === clipId)) {
      db.collectionClips.push({ collectionId, clipId });
    }
  },
  removeClipFromCollection(collectionId: string, clipId: string) {
    db.collectionClips = db.collectionClips.filter(
      (cc) => !(cc.collectionId === collectionId && cc.clipId === clipId)
    );
  },
  clipMembership(clipId: string): string[] {
    return db.collectionClips.filter((cc) => cc.clipId === clipId).map((cc) => cc.collectionId);
  },

  // ---- study sessions ----
  listStudySessions(): StudySession[] {
    return [...db.studySessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  getStudySession(id: string) {
    const session = db.studySessions.find((s) => s.id === id);
    if (!session) return null;
    const notes = db.studyNotes
      .filter((n) => n.sessionId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { session, notes };
  },
  createStudySession(input: StudySessionInput): string {
    const id = `ss_${crypto.randomUUID().slice(0, 8)}`;
    db.studySessions.push({ id, videoId: input.videoId ?? null, title: input.title, goalId: input.goalId ?? null, summary: "", completed: false, createdAt: new Date().toISOString() });
    return id;
  },
  addStudyNote(sessionId: string, kind: StudyNoteKind, body: string, atSeconds?: number | null): string {
    const id = `sn_${crypto.randomUUID().slice(0, 8)}`;
    db.studyNotes.push({ id, sessionId, kind, body, atSeconds: atSeconds ?? null, createdAt: new Date().toISOString() });
    return id;
  },
  deleteStudyNote(id: string): boolean {
    const before = db.studyNotes.length;
    db.studyNotes = db.studyNotes.filter((n) => n.id !== id);
    return db.studyNotes.length < before;
  },
  completeStudySession(id: string, summary: string): StudySession | null {
    const s = db.studySessions.find((x) => x.id === id);
    if (!s) return null;
    s.summary = summary;
    s.completed = true;
    return s;
  },

  // ---- community ----
  getClipById(id: string): FilmClip | undefined {
    return db.clips.find((c) => c.id === id);
  },
  listFeed(): FeedPost[] {
    return db.posts
      .map((p) => toFeedPost(p))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  getPost(id: string) {
    const p = db.posts.find((x) => x.id === id);
    if (!p) return null;
    const comments = db.comments
      .filter((c) => c.postId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { post: toFeedPost(p), comments };
  },
  createPost(p: Omit<DemoPost, "id" | "createdAt">): string {
    const id = `post_${crypto.randomUUID().slice(0, 8)}`;
    db.posts.push({ ...p, id, createdAt: new Date().toISOString() });
    return id;
  },
  deletePost(id: string): boolean {
    const before = db.posts.length;
    db.posts = db.posts.filter((p) => p.id !== id);
    db.comments = db.comments.filter((c) => c.postId !== id);
    db.reactions = db.reactions.filter((r) => r.postId !== id);
    return db.posts.length < before;
  },
  addComment(c: Omit<PostComment, "id" | "createdAt">): string {
    const id = `cm_${crypto.randomUUID().slice(0, 8)}`;
    db.comments.push({ ...c, id, createdAt: new Date().toISOString() });
    return id;
  },
  deleteComment(id: string): boolean {
    const before = db.comments.length;
    db.comments = db.comments.filter((c) => c.id !== id);
    return db.comments.length < before;
  },
  toggleReaction(postId: string): boolean {
    const i = db.reactions.findIndex((r) => r.postId === postId && r.userId === DEMO_UID);
    if (i === -1) {
      db.reactions.push({ postId, userId: DEMO_UID });
      return true;
    }
    db.reactions.splice(i, 1);
    return false;
  },
};

function toFeedPost(p: DemoPost): FeedPost {
  return {
    id: p.id,
    userId: p.userId,
    authorName: p.authorName,
    authorHandle: p.authorHandle,
    authorPosition: p.authorPosition,
    authorAvatar: p.authorAvatar,
    title: p.title,
    body: p.body,
    clip: p.clip,
    tags: p.tags,
    createdAt: p.createdAt,
    reactionCount: db.reactions.filter((r) => r.postId === p.id).length,
    commentCount: db.comments.filter((c) => c.postId === p.id).length,
    hasReacted: db.reactions.some((r) => r.postId === p.id && r.userId === DEMO_UID),
  };
}
