/*
  Blog posts, as data rather than markdown files or a CMS.

  Client-safe: no server imports, no database. Three posts to start,
  each one about a real mechanic of the product rather than generic
  advice — the loop, the recovery honesty principle, and what a film
  session with a coach actually is. A blog with nothing to say about
  the product it sits next to is worse than no blog.

  `body` is typed blocks, not an HTML string — `dangerouslySetInnerHTML`
  for content that lives in the repository and never touches user input
  is not a real risk, but a typed structure is what lets the renderer
  stay a single small component instead of one per post.
*/

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  readMinutes: number;
  body: BlogBlock[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "the-development-loop",
    title: "The development loop, and why most football improvement doesn't stick",
    excerpt:
      "A match without film is an opinion. Film without study is entertainment. Study without training is a diary. The loop only works if every stage feeds the next one.",
    date: "2026-07-14",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "Ask most players what they worked on last month and you get a mood, not an answer. “My first touch has been better.” “I felt sharper.” Nothing wrong with the feeling — but a feeling isn’t something you can point back to in six weeks and check whether it was actually true.",
      },
      {
        type: "p",
        text: "MIDO XI is built around a specific claim: that improvement that sticks follows the same six-step loop every time, and that skipping a step is usually where the improvement stops sticking.",
      },
      {
        type: "h2",
        text: "Match → Film → Insight → Study → Training → Match",
      },
      {
        type: "list",
        items: [
          "Match — something happens. A goal conceded from a switch of play, a run you didn’t make, a duel you won that you didn’t expect to.",
          "Film — you watch it back. Not the highlights reel, the actual passage of play, more than once if it needs it.",
          "Insight — you or your coach name what actually happened. Not “bad game,” but “you stepped before the pass was played, three times, always on the near side.”",
          "Study — the insight becomes something to understand, not just remember. Why does stepping early against that pattern get punished?",
          "Training — you rehearse the specific thing, not “fitness” in general.",
          "Match — the next one is where you find out if it worked. Which starts the loop again.",
        ],
      },
      {
        type: "p",
        text: "Most players are strong at one or two of these stages and weak at the rest. Plenty watch film obsessively but never turn it into a training cue. Plenty train hard but couldn’t tell you which match moment the session was answering. The loop breaks wherever a stage has nothing to hand off to the next one — film with no insight, insight with no training, training with no match to test it against.",
      },
      {
        type: "quote",
        text: "The loop is the whole product, not a slide in the pitch deck. Film Room, Development, Training and Matches aren’t four separate tools — they’re the same loop with a different stage highlighted.",
      },
      {
        type: "p",
        text: "That’s also why a development goal in MIDO XI is never just a number going up. It’s tracked by evidence — the clip, the session, the note — so “scanning before receiving” means something specific enough to actually train, and something you can check six weeks later against what actually happened on the pitch.",
      },
    ],
  },
  {
    slug: "we-dont-invent-your-recovery-score",
    title: "We don't invent your recovery score — here's what that actually means",
    excerpt:
      "Most recovery screens show HRV, resting heart rate and a readiness score whether or not anything measured them. Ours doesn't. Here's why that was a deliberate rebuild, not an oversight.",
    date: "2026-08-05",
    readMinutes: 3,
    body: [
      {
        type: "p",
        text: "An earlier version of the Recovery screen in MIDO XI showed HRV in milliseconds, resting heart rate in bpm, hydration in litres, and a six-region soreness map. It looked exactly like every other recovery dashboard.",
      },
      {
        type: "p",
        text: "It was also, for almost every player using it, completely made up. None of those numbers existed anywhere in the product. There was no wearable connected, no lab test, nothing measuring HRV at all — the screen was rendering plausible-looking numbers that nothing had actually produced.",
      },
      {
        type: "h2",
        text: "The rebuild",
      },
      {
        type: "p",
        text: "The current Recovery page records exactly what a player actually reports: four scores, each 1 to 5 — energy, soreness, sleep, mental state — and a note. That’s the whole input. A readiness figure is derived from those four numbers by arithmetic simple enough to check by hand, and the page says plainly what it is not measuring and what device would be needed to measure it for real.",
      },
      {
        type: "p",
        text: "When a player connects a WHOOP strap, the picture changes — genuinely, not cosmetically. Recovery score, HRV, resting heart rate, blood oxygen and sleep stages start showing up, sourced from the device and kept visibly separate from the self-reported scores. They are never averaged together into one number. A device reading and a player typing “4 out of 5 for sleep” are different kinds of fact, and blending them would just be the same invented-number problem with better production values.",
      },
      {
        type: "list",
        items: [
          "A missing HRV reading renders as “not measured,” never as zero.",
          "A night WHOOP itself couldn’t score stays unscored — no number is invented to fill the gap.",
          "Self-reported and device-measured data are never combined into a single figure.",
        ],
      },
      {
        type: "quote",
        text: "A recovery number a player might use to decide whether to train has to be either real or absent. There is no honest third option.",
      },
      {
        type: "p",
        text: "This is a small page in a large product, but the rule behind it runs through everything: separate what was actually observed from what is inferred, and never let one quietly become the other.",
      },
    ],
  },
  {
    slug: "what-a-film-session-should-look-like",
    title: "What a film session with your coach should look like",
    excerpt:
      "Most \"let's watch some clips together\" calls are a video window and two people talking past each other. Here's the version that actually produces something.",
    date: "2026-08-20",
    readMinutes: 4,
    body: [
      {
        type: "p",
        text: "The usual version of a remote film session goes like this: a Zoom link, a shared screen, a coach scrubbing through a match while narrating, and a player nodding along. It ends, and neither person has anything to show for it beyond a vague sense of what was said.",
      },
      {
        type: "p",
        text: "The problem isn’t the video call. It’s that the call and the film are two separate things happening near each other rather than one thing happening together.",
      },
      {
        type: "h2",
        text: "The agenda is the session",
      },
      {
        type: "p",
        text: "In MIDO XI, a session between a coach and a player carries a shared agenda — an ordered list either person can add to, reorder and tick off, live, before and during the call. An agenda item isn’t just a line of text. It can be a specific clip at a specific timestamp, a study module, or a development goal. “Join” means both people land on the same frame of the same footage, not a call where somebody has to describe what they meant.",
      },
      {
        type: "list",
        items: [
          "The coach adds the two clips they flagged after the match, each with a note on what to watch for.",
          "The player adds a question about the weak-foot work from three sessions ago — is it actually transferring to matches?",
          "Whoever gets there first ticks an item off once it’s been covered, so the session doesn’t re-cover ground or run out of time before the thing that mattered most.",
        ],
      },
      {
        type: "h2",
        text: "Nobody has to guess what moved",
      },
      {
        type: "p",
        text: "If a session needs to shift — training moved, a match got rescheduled — the new time is proposed, not silently written over the old one. The other person accepts it or doesn’t. Nobody discovers a session moved by staring at a calendar that quietly changed underneath them, because it never changes without an answer from both sides.",
      },
      {
        type: "quote",
        text: "A film session that produces an agenda item nobody can find again tomorrow wasn’t really a film session. It was a conversation that happened to have video in the background.",
      },
      {
        type: "p",
        text: "None of this replaces a coach’s eye. It just makes sure what the two of you actually agreed on survives past the end of the call.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

export function latestPosts(n: number): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, n);
}

/**
 * A published date as the editor set it, not as the reader's clock
 * shifts it. `new Date("2026-07-14")` parses as UTC midnight, and
 * rendering that with the browser's local zone turns "14 July" into
 * "13 July" for anybody west of Greenwich — the same class of bug this
 * project has already caught in meeting times and WHOOP cycle days.
 * Forcing `timeZone: "UTC"` here is what keeps a publish date the same
 * for every reader, which is the property that actually matters for an
 * editorial date.
 */
export function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
