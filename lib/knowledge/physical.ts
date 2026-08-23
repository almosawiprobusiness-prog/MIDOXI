/*
  ============================================================
  THE PHYSICAL LAYER OF THE KNOWLEDGE GRAPH
  ------------------------------------------------------------
  Football qualities, the tests that measure them, and the work
  that develops them — curated in code, the same way the
  football concepts are.

  Two rules, matching the rest of the graph:

  1. No invented norms. A test says what it tells you and how to
     administer it. It never claims "elite is 1.72s" — normative
     data is population-specific and would be fabrication here.

  2. Every quality links back to football. A trainer is not
     developing "acceleration" in the abstract; they are
     developing the thing that lets a forward attack a blindside
     run, and the graph says so.

  Client-safe: pure data and pure functions.
  ============================================================
*/

export type QualitySlug =
  | "acceleration"
  | "max-speed"
  | "repeat-sprint"
  | "lower-body-strength"
  | "power"
  | "hamstring-resilience"
  | "mobility"
  | "aerobic-capacity"
  | "return-to-play";

export type TestId =
  | "sprint-10m"
  | "sprint-20m"
  | "sprint-30m"
  | "flying-10m"
  | "cmj"
  | "broad-jump"
  | "cod-505"
  | "rsa-decrement"
  | "yoyo-ir1"
  | "squat-1rm"
  | "trap-bar-1rm"
  | "nordic-break-point"
  | "ankle-dorsiflexion"
  | "body-mass";

export interface AssessmentTest {
  id: TestId;
  label: string;
  unit: string;
  /** Which direction is an improvement. */
  better: "lower" | "higher";
  quality: QualitySlug;
  /** What a change in this number actually tells you. */
  tells: string;
  /** How to run it consistently enough that a change means something. */
  protocol: string;
  /** Sensible retest interval in weeks. */
  retestWeeks: number;
}

export const TESTS: AssessmentTest[] = [
  {
    id: "sprint-10m",
    label: "10m sprint",
    unit: "s",
    better: "lower",
    quality: "acceleration",
    tells: "Pure acceleration — the first three steps, where most football separation is won.",
    protocol: "Standing start, front foot 30cm behind the first gate. Three attempts, full recovery, best retained.",
    retestWeeks: 6,
  },
  {
    id: "sprint-20m",
    label: "20m sprint",
    unit: "s",
    better: "lower",
    quality: "acceleration",
    tells: "Acceleration carried into transition speed — the distance most football sprints actually cover.",
    protocol: "Same start as the 10m, gates at 20m. Three attempts, full recovery, best retained.",
    retestWeeks: 6,
  },
  {
    id: "sprint-30m",
    label: "30m sprint",
    unit: "s",
    better: "lower",
    quality: "max-speed",
    tells: "Whether the athlete keeps accelerating once upright, or tops out early.",
    protocol: "Standing start, gates at 30m. Two to three attempts with full recovery.",
    retestWeeks: 8,
  },
  {
    id: "flying-10m",
    label: "Flying 10m",
    unit: "s",
    better: "lower",
    quality: "max-speed",
    tells: "Maximum velocity, isolated from the start. Improves separately from acceleration.",
    protocol: "20m run-in, timed over the following 10m. Two attempts, full recovery.",
    retestWeeks: 8,
  },
  {
    id: "cmj",
    label: "Countermovement jump",
    unit: "cm",
    better: "higher",
    quality: "power",
    tells: "Lower-body power, and — tracked weekly — a practical readiness signal.",
    protocol: "Hands on hips, self-selected depth, three jumps, best retained. Same surface every time.",
    retestWeeks: 4,
  },
  {
    id: "broad-jump",
    label: "Standing broad jump",
    unit: "cm",
    better: "higher",
    quality: "power",
    tells: "Horizontal power — closer to the force direction of a sprint start than a vertical jump.",
    protocol: "Two-foot take-off and landing, measured to the rearmost heel. Three attempts.",
    retestWeeks: 6,
  },
  {
    id: "cod-505",
    label: "505 change of direction",
    unit: "s",
    better: "lower",
    quality: "power",
    tells: "Ability to decelerate and re-accelerate — the action behind most 1v1 duels.",
    protocol: "10m run-in, turn on a line, 5m out. Both legs tested; record each side.",
    retestWeeks: 8,
  },
  {
    id: "rsa-decrement",
    label: "Repeated sprint decrement",
    unit: "%",
    better: "lower",
    quality: "repeat-sprint",
    tells: "How much speed is lost across repeated efforts — the quality that decides late-game actions.",
    protocol: "6 x 30m with 20s recovery. Decrement = drop from best to mean, as a percentage.",
    retestWeeks: 8,
  },
  {
    id: "yoyo-ir1",
    label: "Yo-Yo IR1",
    unit: "m",
    better: "higher",
    quality: "aerobic-capacity",
    tells: "High-intensity running capacity and how quickly the athlete recovers between efforts.",
    protocol: "Standard Yo-Yo intermittent recovery level 1 protocol. Record total distance.",
    retestWeeks: 10,
  },
  {
    id: "squat-1rm",
    label: "Back squat (est. 1RM)",
    unit: "kg",
    better: "higher",
    quality: "lower-body-strength",
    tells: "Maximal lower-body strength — the base that speed and resilience work is built on.",
    protocol: "3-5RM taken to a consistent depth, 1RM estimated. Never test a fatigued athlete.",
    retestWeeks: 8,
  },
  {
    id: "trap-bar-1rm",
    label: "Trap-bar deadlift (est. 1RM)",
    unit: "kg",
    better: "higher",
    quality: "lower-body-strength",
    tells: "Hip-dominant strength with a lower technical demand than a barbell deadlift.",
    protocol: "3-5RM from a consistent bar height, 1RM estimated.",
    retestWeeks: 8,
  },
  {
    id: "nordic-break-point",
    label: "Nordic break point",
    unit: "deg",
    better: "higher",
    quality: "hamstring-resilience",
    tells: "Eccentric hamstring capacity — the single most trainable hamstring-injury risk factor.",
    protocol: "Ankles held, lower under control; record the angle at which control is lost. Both legs.",
    retestWeeks: 6,
  },
  {
    id: "ankle-dorsiflexion",
    label: "Ankle dorsiflexion",
    unit: "cm",
    better: "higher",
    quality: "mobility",
    tells: "Knee-to-wall distance. Restriction here shows up in squatting, landing and sprint mechanics.",
    protocol: "Knee-to-wall, heel down, measured toe-to-wall in centimetres. Both sides.",
    retestWeeks: 6,
  },
  {
    id: "body-mass",
    label: "Body mass",
    unit: "kg",
    better: "higher",
    quality: "lower-body-strength",
    tells: "Context for every other number. Relative strength moves when mass moves.",
    protocol: "Same scale, same time of day, before training.",
    retestWeeks: 4,
  },
];

export interface ProgramExercise {
  name: string;
  /** Sets, reps, load and rest, written the way a trainer writes it. */
  prescription: string;
  cue: string;
  /** Where in a session this belongs. */
  slot: "prep" | "primary" | "secondary" | "accessory" | "conditioning" | "recovery";
}

export interface PhysicalQuality {
  slug: QualitySlug;
  name: string;
  definition: string;
  /** What it buys the athlete on a football pitch. */
  why: string;
  /** Football concepts (lib/knowledge/concepts.ts) this quality serves. */
  footballConcepts: string[];
  tests: TestId[];
  exercises: ProgramExercise[];
  /** How to make the block harder, week to week. */
  progression: string[];
  /** What to pull back first when an athlete is under-recovered. */
  regression: string[];
  /** Sessions per week this quality tolerates alongside football. */
  weeklyDose: string;
}

export const QUALITIES: PhysicalQuality[] = [
  {
    slug: "acceleration",
    name: "Acceleration",
    definition: "Producing high force into the ground in the first five to ten metres, from a standing or rolling start.",
    why: "Football duels are decided in the first three steps, while the opponent is still deciding.",
    footballConcepts: ["acceleration", "runs-in-behind", "creating-separation"],
    tests: ["sprint-10m", "sprint-20m", "broad-jump"],
    exercises: [
      { name: "Wall drill — single exchange", prescription: "3 x 5 each side", cue: "Punch the ground away, do not reach", slot: "prep" },
      { name: "Falling start sprint 10m", prescription: "6 x 10m · walk-back recovery", cue: "Stay long and low out of the first step", slot: "primary" },
      { name: "Resisted sled push 15m", prescription: "5 x 15m · heavy · 90s rest", cue: "Shin angle low, drive through the whole foot", slot: "primary" },
      { name: "Trap-bar jump", prescription: "4 x 3 @ 30% 1RM", cue: "Fast intent every rep", slot: "secondary" },
      { name: "Split squat", prescription: "3 x 6 each side", cue: "Control down, drive up", slot: "accessory" },
    ],
    progression: [
      "Week 1-2: volume low, quality absolute — no rep slower than 95% of the best",
      "Week 3-4: add one sprint rep per session, or 10% sled load",
      "Week 5: reduce volume by a third, keep intensity — the adaptation shows up here",
    ],
    regression: ["Cut the sled load before the sprint reps", "Drop to 4 sprints and extend recovery to 3 minutes"],
    weeklyDose: "2 sessions, away from the heaviest football days",
  },
  {
    slug: "max-speed",
    name: "Maximum speed",
    definition: "Top running velocity, reached beyond roughly 25-30 metres, and the mechanics that sustain it.",
    why: "Exposure to top speed is protective as well as performance work — hamstrings tolerate what they have practised.",
    footballConcepts: ["runs-in-behind", "acceleration"],
    tests: ["sprint-30m", "flying-10m"],
    exercises: [
      { name: "A-skip and dribble series", prescription: "2 x 20m each", cue: "Ground contact under the hip", slot: "prep" },
      { name: "Flying 20m runs", prescription: "4-6 x · 20m build, 20m float", cue: "Relax the face, hold the shape", slot: "primary" },
      { name: "Curved sprints", prescription: "4 x 30m each direction", cue: "Lean from the ankle, not the waist", slot: "secondary" },
      { name: "Nordic hamstring", prescription: "3 x 4 eccentric", cue: "Fight the last 20 degrees", slot: "accessory" },
    ],
    progression: [
      "Week 1: two exposures at 90-95%, technique-led",
      "Week 2-4: one session per week reaching genuine maximum velocity",
      "Never add speed volume in the same week as a competitive fixture increase",
    ],
    regression: ["Cap at 90% and keep the volume", "Replace one exposure with A-skip mechanics work"],
    weeklyDose: "1-2 exposures, at least 48 hours from a match",
  },
  {
    slug: "repeat-sprint",
    name: "Repeat sprint ability",
    definition: "Producing near-maximal efforts repeatedly, with the incomplete recovery a match actually gives.",
    why: "The tenth sprint decides late goals. One fast sprint is a test result; fifteen is a football quality.",
    footballConcepts: ["repeat-sprint-ability", "counter-pressing", "pressing-triggers"],
    tests: ["rsa-decrement", "yoyo-ir1"],
    exercises: [
      { name: "6 x 30m, 20s recovery", prescription: "2-3 sets · 3 min between sets", cue: "Hold the first rep time, do not chase it", slot: "conditioning" },
      { name: "Shuttle 5-10-5 repeats", prescription: "8 x · 25s recovery", cue: "Decelerate under control, then go again", slot: "conditioning" },
      { name: "Extensive tempo runs 100m", prescription: "10 x @ 70% · walk 100m", cue: "Aerobic, not hard — this is recovery work", slot: "conditioning" },
    ],
    progression: [
      "Week 1-2: build the aerobic base with tempo before adding repeat-sprint sets",
      "Week 3-4: reduce recovery by 5s, or add a set",
      "Track decrement, not best time — the drop is the quality",
    ],
    regression: ["Extend recovery rather than cutting reps", "Replace one block with tempo running"],
    weeklyDose: "1-2 sessions, typically MD+2 or MD-4",
  },
  {
    slug: "lower-body-strength",
    name: "Lower-body strength",
    definition: "Maximal force production through the hips, knees and ankles, in both bilateral and single-leg patterns.",
    why: "Strength is the base every other quality draws on, and the buffer that keeps an athlete available.",
    footballConcepts: ["acceleration", "hold-up-play"],
    tests: ["squat-1rm", "trap-bar-1rm", "body-mass"],
    exercises: [
      { name: "Back squat", prescription: "4 x 5 @ 80% · 3 min rest", cue: "Same depth every rep", slot: "primary" },
      { name: "Trap-bar deadlift", prescription: "4 x 4 @ 80%", cue: "Push the floor away", slot: "primary" },
      { name: "Rear-foot elevated split squat", prescription: "3 x 8 each side", cue: "Vertical torso, hips square", slot: "secondary" },
      { name: "Copenhagen adduction", prescription: "3 x 8 each side", cue: "Slow and controlled", slot: "accessory" },
      { name: "Calf raise — straight and bent knee", prescription: "3 x 12 each", cue: "Full range, pause at the top", slot: "accessory" },
    ],
    progression: [
      "Week 1-3: add load while reps stay constant (linear)",
      "Week 4: deload to roughly 60% of the week-3 volume",
      "Retest strength only when the athlete is fresh",
    ],
    regression: ["Reduce load 10% and keep the pattern", "Swap bilateral for single-leg at lower load"],
    weeklyDose: "2 sessions in season, 3 out of season",
  },
  {
    slug: "power",
    name: "Power and elasticity",
    definition: "Rapid force production and the ability to reuse elastic energy in jumping, cutting and landing.",
    why: "Deceleration and re-acceleration are the mechanics behind every change of direction in a duel.",
    footballConcepts: ["acceleration", "creating-separation", "defending-the-inside"],
    tests: ["cmj", "broad-jump", "cod-505"],
    exercises: [
      { name: "Pogo hops", prescription: "4 x 10 · stiff ankle", cue: "Minimum ground time", slot: "prep" },
      { name: "Depth jump to box", prescription: "4 x 3 · full recovery", cue: "Land quiet, leave fast", slot: "primary" },
      { name: "Lateral bound and stick", prescription: "3 x 4 each side", cue: "Stick the landing for two seconds", slot: "secondary" },
      { name: "Deceleration drill 10m", prescription: "6 x · alternate lead leg", cue: "Lower the hips, shorten the steps", slot: "secondary" },
    ],
    progression: [
      "Week 1-2: landing and deceleration quality before any depth jumps",
      "Week 3-4: add height or contacts, never both in one week",
      "Stop the set the moment ground contact time visibly increases",
    ],
    regression: ["Remove depth jumps, keep pogos and bounds", "Halve the contacts"],
    weeklyDose: "2 short sessions, before football or before strength work",
  },
  {
    slug: "hamstring-resilience",
    name: "Hamstring resilience",
    definition: "Eccentric strength and high-speed running exposure that keep the hamstring tolerant of sprinting.",
    why: "Hamstrings are the most common non-contact football injury, and the most preventable one.",
    footballConcepts: ["runs-in-behind", "repeat-sprint-ability"],
    tests: ["nordic-break-point", "flying-10m"],
    exercises: [
      { name: "Nordic hamstring", prescription: "2-3 x 4 · slow eccentric", cue: "Resist all the way down", slot: "accessory" },
      { name: "Single-leg RDL", prescription: "3 x 8 each side", cue: "Hips level, long spine", slot: "secondary" },
      { name: "Sprint exposure at 90%+", prescription: "4-6 x 30m weekly", cue: "The best hamstring protection is sprinting", slot: "primary" },
      { name: "Hip extension isometric", prescription: "3 x 20s each side", cue: "Squeeze, breathe, hold", slot: "accessory" },
    ],
    progression: [
      "Week 1-2: two Nordic sessions with low volume, high control",
      "Week 3+: maintain volume, add sprint exposure rather than more Nordics",
      "Soreness above 48 hours means the volume was too high",
    ],
    regression: ["Reduce the Nordic range with a band", "Keep the sprint exposure, drop the eccentric volume"],
    weeklyDose: "2 sessions, one of which is simply sprinting",
  },
  {
    slug: "mobility",
    name: "Mobility",
    definition: "Usable range of motion at the ankle, hip and thoracic spine, under control rather than passively.",
    why: "Restriction shows up as compensation — in sprint mechanics, landing, and eventually in soft tissue.",
    footballConcepts: ["first-touch-under-pressure"],
    tests: ["ankle-dorsiflexion"],
    exercises: [
      { name: "Knee-to-wall ankle rocks", prescription: "2 x 10 each side", cue: "Heel stays down", slot: "prep" },
      { name: "90/90 hip switches", prescription: "2 x 8 each side", cue: "Move from the hip, not the lower back", slot: "prep" },
      { name: "Thoracic rotation, side-lying", prescription: "2 x 8 each side", cue: "Exhale into the range", slot: "prep" },
      { name: "Loaded ATG split squat", prescription: "3 x 8 each side", cue: "Own the bottom position", slot: "accessory" },
    ],
    progression: ["Week 1-2: daily short exposures", "Week 3+: load the end range rather than stretching further"],
    regression: ["Reduce range, keep the frequency"],
    weeklyDose: "Daily, in small doses",
  },
  {
    slug: "aerobic-capacity",
    name: "Aerobic capacity",
    definition: "The engine underneath everything: how fast the athlete recovers between high-intensity efforts.",
    why: "A bigger aerobic base means faster recovery between sprints, which is what repeat-sprint ability rests on.",
    footballConcepts: ["repeat-sprint-ability", "counter-pressing"],
    tests: ["yoyo-ir1", "rsa-decrement"],
    exercises: [
      { name: "4 x 4 minute intervals @ 90-95% HRmax", prescription: "3 min active recovery", cue: "Even pace across all four", slot: "conditioning" },
      { name: "Extensive tempo 100m", prescription: "12 x @ 70% · walk back", cue: "Comfortable and repeatable", slot: "conditioning" },
      { name: "Small-sided game conditioning", prescription: "4 x 4 min · 4v4 +GK", cue: "Football is the best conditioning when it is organised", slot: "conditioning" },
    ],
    progression: ["Week 1-2: build volume at a steady intensity", "Week 3-4: hold volume, raise intensity"],
    regression: ["Shorten the intervals, keep the number", "Replace an interval block with tempo"],
    weeklyDose: "1-2 sessions, avoided the day before a match",
  },
  {
    slug: "return-to-play",
    name: "Return to play",
    definition: "The staged progression from injury back to full football, with criteria at each stage rather than dates.",
    why: "Reinjury usually follows a stage skipped for the calendar. The criteria decide, not the fixture list.",
    footballConcepts: ["acceleration", "repeat-sprint-ability"],
    tests: ["nordic-break-point", "cmj", "sprint-10m", "flying-10m"],
    exercises: [
      { name: "Stage 1 — linear running 60-70%", prescription: "Daily · 800-1200m in blocks", cue: "Pain-free, controlled, no limp", slot: "conditioning" },
      { name: "Stage 2 — change of direction, wide angles", prescription: "3 sessions · large arcs first", cue: "Progress the angle, not the speed", slot: "secondary" },
      { name: "Stage 3 — progressive high-speed running", prescription: "80% -> 90% -> 95% across sessions", cue: "One variable at a time", slot: "primary" },
      { name: "Stage 4 — football-specific reactive work", prescription: "Small-sided, controlled numbers", cue: "Add unpredictability last", slot: "primary" },
    ],
    progression: [
      "Advance a stage only when the criteria are met, symptom-free, on consecutive days",
      "Match the athlete's own pre-injury numbers before full contact training",
      "The last 10% of speed is the most common stage to skip — do not skip it",
    ],
    regression: ["Return to the previous stage for two sessions", "Reduce speed before reducing volume"],
    weeklyDose: "Daily contact, progressing by criteria",
  },
];

const QUALITY_BY_SLUG = new Map(QUALITIES.map((q) => [q.slug, q]));
const TEST_BY_ID = new Map(TESTS.map((t) => [t.id, t]));

export function quality(slug: string): PhysicalQuality | null {
  return QUALITY_BY_SLUG.get(slug as QualitySlug) ?? null;
}

export function test(id: string): AssessmentTest | null {
  return TEST_BY_ID.get(id as TestId) ?? null;
}

export function testsForQuality(slug: QualitySlug): AssessmentTest[] {
  const q = QUALITY_BY_SLUG.get(slug);
  return (q?.tests ?? []).map((t) => TEST_BY_ID.get(t)).filter((t): t is AssessmentTest => Boolean(t));
}

/**
 * Pick the qualities an objective is actually about. Deterministic keyword
 * matching over curated text — the same approach the coach engine uses, so a
 * trainer with no AI still gets a relevant block.
 */
export function matchQualities(objective: string, limit = 2): PhysicalQuality[] {
  const words = objective
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);

  const scored = QUALITIES.map((q) => {
    const hay = `${q.name} ${q.definition} ${q.why}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 2;
    if (objective.toLowerCase().includes(q.name.toLowerCase())) score += 8;
    // "return to play" and "injury" are the same request in a trainer's words.
    if (q.slug === "return-to-play" && /injur|rehab|return|hamstring|acl|calf/i.test(objective)) score += 8;
    if (q.slug === "acceleration" && /explos|separat|first step|quick/i.test(objective)) score += 4;
    if (q.slug === "repeat-sprint" && /repeat|late|fitness|endur/i.test(objective)) score += 4;
    return { q, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return (scored.length ? scored.map((s) => s.q) : QUALITIES).slice(0, limit);
}
