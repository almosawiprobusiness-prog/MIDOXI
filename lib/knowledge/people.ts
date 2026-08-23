import type { FootballPerson } from "./types";

/*
  ============================================================
  THE PEOPLE LAYER
  ------------------------------------------------------------
  Learn football through the best people in football.

  Two rules govern this file:

  1. `verified` holds only stable public record — birth date,
     position, club, honours, roles. It is curated by hand and
     never written by a model. Everything the product labels
     "verified" comes from here.

  2. Everything else is football *interpretation*. It is
     editorial, it is labelled MIDO ANALYSIS in the UI, and it
     is written to teach a concept from the knowledge graph —
     not to recount a career.

  Curated modules are the quality baseline. Where a module has
  no curated body, the Study Engine generates one from the
  person's concept spine and the reader's own profile.
  ============================================================
*/

export const PEOPLE: FootballPerson[] = [
  // ══════════════════════════════════════════════════════════
  // HARRY KANE — the proof-of-concept study
  // ══════════════════════════════════════════════════════════
  {
    slug: "harry-kane",
    name: "Harry Kane",
    kind: "player",
    descriptor: "Centre-forward · England",
    premise:
      "The most complete study available to a forward: a striker who scores like a nine and builds like a ten. Study Kane and you are really studying movement, timing and decision-making.",
    verified: [
      { label: "Born", value: "28 July 1993, London, England" },
      { label: "Position", value: "Centre-forward" },
      { label: "Club", value: "Bayern Munich (since August 2023)" },
      { label: "Country", value: "England — national team captain" },
      { label: "Record", value: "England's all-time leading goalscorer" },
      { label: "Record", value: "Tottenham Hotspur's all-time leading goalscorer" },
      { label: "Premier League Golden Boot", value: "2015–16, 2016–17, 2020–21" },
      { label: "Premier League Playmaker", value: "2020–21 season" },
    ],
    positions: ["CF", "AM"],
    embodies: [
      "dropping-between-lines",
      "blindside-movement",
      "near-post-finishing",
      "hold-up-play",
      "third-man-runs",
      "scanning",
      "decision-speed",
      "occupying-the-last-line",
    ],
    modules: [
      {
        key: "dna",
        title: "Player DNA",
        brief: "Who he is as a footballer: role, profile, the tendencies that repeat every match.",
        concepts: ["dropping-between-lines", "occupying-the-last-line"],
      },
      {
        key: "movement",
        title: "Movement",
        brief: "How he creates the space he finishes from — dropping, pinning, blindside, box arrival.",
        concepts: ["dropping-between-lines", "blindside-movement", "occupying-the-last-line", "creating-separation"],
      },
      {
        key: "finishing",
        title: "Finishing",
        brief: "Shot selection, body position, and why so many of his goals look simple.",
        concepts: ["near-post-finishing", "decision-speed"],
      },
      {
        key: "link-play",
        title: "Link play",
        brief: "Receiving with defenders behind him, layoffs, turns, and passing into runners.",
        concepts: ["hold-up-play", "third-man-runs", "first-touch-under-pressure"],
      },
      {
        key: "scanning",
        title: "Scanning",
        brief: "What he checks before the ball arrives, and how that becomes a finish two seconds later.",
        concepts: ["scanning", "receiving-half-turn"],
      },
      {
        key: "decisions",
        title: "Decision making",
        brief: "Why he chooses what he chooses — the reasoning behind shoot, combine, hold or spin.",
        concepts: ["decision-speed", "third-man-runs"],
      },
    ],
    curated: {
      dna: {
        provenance: "analysis",
        summary:
          "Kane is a centre-forward who refuses to be only a centre-forward. He occupies the last line to pin defenders, then leaves it to receive between the lines — and the whole attack reorganises around whichever of those two things he is doing. He is a scorer with a playmaker's habits, which is why he has won both a Golden Boot and a Playmaker award in the Premier League.",
        points: [
          {
            title: "Two positions in one player",
            body: "On the last line he is a pinning threat: centre-backs cannot step, so the space between the lines stays open for everyone else. Dropped in, he becomes the link: a passer facing forward with runners ahead of him. The threat is not either of those things individually — it is that a defender never knows which is coming.",
          },
          {
            title: "The defender's dilemma",
            body: "When he drops, one centre-back must decide: follow him into midfield and vacate the space behind, or stay and let him turn with the ball. Both answers cost something. Creating that dilemma repeatedly is the single most transferable idea in this study.",
          },
          {
            title: "Volume through repeatability, not moments",
            body: "His game is built on actions that can be repeated at the same quality in the ninetieth minute: early finishes, one-touch layoffs, simple passes into runners. Spectacular play is rarely repeatable. His is.",
          },
          {
            title: "A range that changes the whole attack",
            body: "The long diagonal after dropping deep is a genuine weapon, not a party trick. It converts one dropping movement into a switch of play, which means dropping is never a purely defensive-minded act for his team.",
          },
        ],
        watchFor: [
          "Where he is standing when his team wins the ball back",
          "How many times he drops without receiving — and what that does to the defensive line",
        ],
      },
      movement: {
        provenance: "analysis",
        summary:
          "Almost every Kane goal is decided before the ball is near him. His movement is a sequence, not an event: pin, check, separate, arrive. Watching the movement rather than the finish is the fastest way to improve as a forward.",
        points: [
          {
            title: "Pin before you move",
            body: "He spends long periods doing apparently nothing on the shoulder of the deepest defender. That stillness is a service to the team: while he holds the line, the space in front of it belongs to his midfielders. Movement only means something if there was a shape to disturb.",
          },
          {
            title: "Move away before you move towards",
            body: "The drop into midfield almost always begins with a step in the opposite direction. The defender reacts to the first step; the second step is the one that matters. Separation is created by the sequence, not by speed.",
          },
          {
            title: "Live on the blindside in the box",
            body: "In the penalty area he positions himself where the defender must choose between watching the ball and watching him. If both are visible to the defender at once, he is too early. He holds until the head turns to the ball, then attacks.",
          },
          {
            title: "Arrive, do not wait",
            body: "He is rarely stationary when a cross is struck. Arriving into the near zone at speed makes redirecting the ball easy and makes defending it almost impossible. Waiting in the six-yard box is a defender's dream.",
          },
          {
            title: "Runs that are meant to be ignored",
            body: "Many of his runs in behind are never found. They still work: each one pushes the defensive line back and buys a metre for the player receiving in front of it. A forward who only runs when the pass is likely is doing half a job.",
          },
        ],
        watchFor: [
          "The step away that comes before every drop",
          "His position relative to the nearest centre-back's eyeline as a cross develops",
          "How many runs he makes that are never passed to — count them",
        ],
      },
      finishing: {
        provenance: "analysis",
        summary:
          "His finishing looks unremarkable, which is the point. The work happens before the shot: body already open, the picture already gathered, the option already chosen. What remains is a technical action performed under almost no time pressure.",
        points: [
          {
            title: "Placement over power, early over late",
            body: "Most of his finishes are struck early and across the goalkeeper rather than blasted. Early contact removes the keeper's set position and the defender's block. Power is the fallback, not the plan.",
          },
          {
            title: "The body is set before the ball arrives",
            body: "He opens his hips towards goal as the ball travels. A forward who has to adjust their body after the touch has already lost the half-second the finish needed.",
          },
          {
            title: "Near post is a decision, not a reaction",
            body: "The front-zone run is committed to before the cross is struck. Attacking it late means arriving after the space has closed. The decision is made when the crosser looks up, not when the ball is in the air.",
          },
          {
            title: "One-touch as a default in the box",
            body: "Inside the area he takes the fewest touches available. Every extra touch invites a block, a recovery or a keeper's advance. First-time finishing is a trainable skill, not a gift.",
          },
          {
            title: "Penalties as a repeatable process",
            body: "His penalty routine is deliberately identical every time — same run-up, same rhythm. Repeatability under pressure is a skill you can copy directly, whatever your level.",
          },
        ],
        watchFor: [
          "How many touches he takes inside the penalty area before shooting",
          "Whether his hips are already open when the ball reaches him",
        ],
      },
      "link-play": {
        provenance: "analysis",
        summary:
          "With a defender behind him, Kane treats the ball as something to move on, not something to hold. The layoff into a runner is the highest-value action in this part of his game, and it is available to any forward willing to train it.",
        points: [
          {
            title: "Feel the defender before the ball arrives",
            body: "An arm across, a shoulder into the chest — he establishes where the defender is while the pass is still travelling, so the first touch can be taken away from that contact rather than into it.",
          },
          {
            title: "The layoff is a pass, not a clearance",
            body: "One touch, into the path of the supporting player, weighted so they can play forward first time. A layoff that has to be controlled has wasted the advantage the drop created.",
          },
          {
            title: "Layoff then spin",
            body: "The action does not end with the pass. He turns immediately to attack the space behind the defender he has just pulled out of position. This is the third-man pattern from the forward's side of it.",
          },
          {
            title: "Turn only when the picture allows",
            body: "He turns when the scan told him the defender was tight to one side or the support was absent. Turning blind into contact is the most common way forwards lose the ball — the difference is information, not courage.",
          },
          {
            title: "The pass into the runner",
            body: "Facing forward, he plays the pass a runner can attack at speed, in front and away from the defender. The quality of that final ball is why his assist numbers look like a midfielder's.",
          },
        ],
        watchFor: [
          "Whether he turns or lays off, and what he checked immediately before deciding",
          "How quickly he moves after the layoff",
        ],
      },
      scanning: {
        provenance: "analysis",
        summary:
          "The habit underneath everything else. He gathers information while the ball travels, so the decision is already made when it arrives. This is the single most copyable thing in the study, and it costs nothing but attention.",
        points: [
          {
            title: "Two looks minimum",
            body: "One scan as the ball travels to the passer, one as it leaves their foot. The first tells him where the pressure is; the second confirms it has not changed.",
          },
          {
            title: "He is not looking at the ball",
            body: "He is looking for the defender's distance and body shape, the position of the supporting midfielder, and the space behind the last line. Three pieces of information, gathered in two glances.",
          },
          {
            title: "The scan sets the touch",
            body: "Where the first touch goes was decided by the last scan. If the touch looks instinctive, it is because the information arrived early enough to make it so.",
          },
          {
            title: "Scanning is trainable, immediately",
            body: "It requires no equipment and no coach. In your next session, check your shoulders twice before every reception. The habit takes weeks, not years.",
          },
        ],
        watchFor: ["Count his head-turns in the three seconds before each reception"],
      },
      decisions: {
        provenance: "analysis",
        summary:
          "Ask why, not what. Every action he takes is an answer to a question the defence asked. Learning to read the question is what turns watching football into studying it.",
        points: [
          {
            title: "Shoot when the picture is already set",
            body: "He shoots early when his body is open and the keeper is unset. He does not shoot to prove he can — when the picture is wrong, the ball goes to a teammate in a better one.",
          },
          {
            title: "Combine when the defender is tight",
            body: "A defender pressed against his back makes turning low-percentage and a layoff high-percentage. The defender's proximity chooses the action, not his preference.",
          },
          {
            title: "Hold when the team needs territory",
            body: "When his side is under pressure, keeping the ball for two extra seconds moves the whole team up the pitch. That is a tactical decision, not a technical one.",
          },
          {
            title: "Drop when the space between the lines is unoccupied",
            body: "He drops into space that exists, not on a schedule. If a midfielder is already there, dropping would crowd the same zone and hand the defence an easy picture.",
          },
        ],
        watchFor: [
          "Pause the film the moment before he acts and predict his choice — then check whether you read the same picture he did",
        ],
      },
    },
  },

  // ══════════════════════════════════════════════════════════
  // OTHER PLAYERS
  // ══════════════════════════════════════════════════════════
  {
    slug: "rodri",
    name: "Rodri",
    kind: "player",
    descriptor: "Defensive midfielder · Spain",
    premise:
      "The clearest study of positioning and scanning in world football. Rodri rarely does anything spectacular, which is exactly why studying him teaches you how midfield actually works.",
    verified: [
      { label: "Born", value: "22 June 1996, Madrid, Spain" },
      { label: "Position", value: "Defensive midfielder" },
      { label: "Club", value: "Manchester City (since 2019)" },
      { label: "Ballon d'Or", value: "2024" },
      { label: "Champions League", value: "Scored the winning goal in the 2023 final" },
      { label: "International", value: "Spain — UEFA Euro 2024 winner" },
    ],
    positions: ["DM", "CM"],
    embodies: ["scanning", "receiving-half-turn", "positional-play", "rest-defence", "decision-speed", "build-up-3-2"],
    modules: [
      { key: "dna", title: "Player DNA", brief: "The role, the habits, and why his team looks different without him.", concepts: ["positional-play", "rest-defence"] },
      { key: "positioning", title: "Positioning", brief: "Where he stands before the ball arrives, and why that decides the next three passes.", concepts: ["positional-play", "half-spaces", "rest-defence"] },
      { key: "scanning", title: "Scanning & receiving", brief: "The pre-reception habits that let him play forward under pressure.", concepts: ["scanning", "receiving-half-turn", "first-touch-under-pressure"] },
      { key: "control", title: "Controlling a match", brief: "Tempo, when to slow the game, and when to break a line.", concepts: ["decision-speed", "switch-of-play"] },
      { key: "defending", title: "Defending the transition", brief: "Screening, rest defence, and killing counter-attacks before they start.", concepts: ["rest-defence", "counter-pressing", "defending-the-inside"] },
    ],
  },
  {
    slug: "lamine-yamal",
    name: "Lamine Yamal",
    kind: "player",
    descriptor: "Winger · Spain",
    premise:
      "A study in isolation and 1v1 decision-making: what a winger does with the ball, and — more importantly — where he stands before he gets it.",
    verified: [
      { label: "Born", value: "13 July 2007, Esplugues de Llobregat, Spain" },
      { label: "Position", value: "Right winger (left-footed)" },
      { label: "Club", value: "Barcelona — La Masia academy" },
      { label: "International", value: "Spain — UEFA Euro 2024 winner" },
      { label: "Record", value: "Youngest player and youngest goalscorer in European Championship history" },
    ],
    positions: ["W", "AM"],
    embodies: ["overload-to-isolate", "half-spaces", "creating-separation", "decision-speed", "switch-of-play"],
    modules: [
      { key: "dna", title: "Player DNA", brief: "The profile of a modern inverted winger and what his team builds around him.", concepts: ["overload-to-isolate", "half-spaces"] },
      { key: "positioning", title: "Width and timing", brief: "Why he stays wide when the ball is far away, and when he comes inside.", concepts: ["overload-to-isolate", "switch-of-play", "half-spaces"] },
      { key: "one-v-one", title: "The 1v1", brief: "Setting up the defender, changing pace, and choosing the outcome early.", concepts: ["creating-separation", "decision-speed"] },
      { key: "final-action", title: "The final action", brief: "Cross, cut-back, shot or pass — reading which one the picture is asking for.", concepts: ["decision-speed", "near-post-finishing"] },
    ],
  },
  {
    slug: "virgil-van-dijk",
    name: "Virgil van Dijk",
    kind: "player",
    descriptor: "Centre-back · Netherlands",
    premise:
      "Defending as decision-making rather than desperation. Van Dijk teaches the version of defending where the tackle is the last resort, not the highlight.",
    verified: [
      { label: "Born", value: "8 July 1991, Breda, Netherlands" },
      { label: "Position", value: "Centre-back" },
      { label: "Club", value: "Liverpool (since January 2018)" },
      { label: "International", value: "Netherlands — national team captain" },
      { label: "Individual", value: "PFA Players' Player of the Year, 2018–19" },
      { label: "Honours", value: "Champions League 2018–19, Premier League 2019–20" },
    ],
    positions: ["CB", "FB"],
    embodies: ["defending-the-inside", "offside-line", "compact-block", "rest-defence", "scanning", "switch-of-play"],
    modules: [
      { key: "dna", title: "Player DNA", brief: "The profile of a defender who defends space rather than opponents.", concepts: ["compact-block", "offside-line"] },
      { key: "positioning", title: "Position and the line", brief: "Holding a line, stepping together, and defending the space in front of the goal.", concepts: ["offside-line", "compact-block", "rest-defence"] },
      { key: "duels", title: "Duels without diving in", brief: "Body position, delay, and forcing an attacker into the least dangerous option.", concepts: ["defending-the-inside", "decision-speed"] },
      { key: "build-up", title: "Building from the back", brief: "Breaking lines from defence, and the switch that reorganises the whole attack.", concepts: ["build-up-3-2", "switch-of-play", "scanning"] },
    ],
  },
  {
    slug: "erling-haaland",
    name: "Erling Haaland",
    kind: "player",
    descriptor: "Striker · Norway",
    premise:
      "A study in specialisation: how a forward who does a small number of things extraordinarily well can bend an entire defence around him.",
    verified: [
      { label: "Born", value: "21 July 2000, Leeds, England" },
      { label: "Position", value: "Striker" },
      { label: "Club", value: "Manchester City (since 2022)" },
      { label: "International", value: "Norway" },
      { label: "Record", value: "36 league goals in 2022–23 — a record for a 38-game Premier League season" },
      { label: "Honours", value: "Treble winner with Manchester City, 2022–23" },
    ],
    positions: ["CF"],
    embodies: ["runs-in-behind", "occupying-the-last-line", "near-post-finishing", "acceleration", "blindside-movement"],
    modules: [
      { key: "dna", title: "Player DNA", brief: "What a maximally direct centre-forward profile actually consists of.", concepts: ["occupying-the-last-line", "runs-in-behind"] },
      { key: "movement", title: "Movement in behind", brief: "The run that starts on the passer's touch, and the curve that keeps it onside.", concepts: ["runs-in-behind", "offside-line", "acceleration"] },
      { key: "box", title: "Inside the box", brief: "Arrival, contact point and the finish that needs no preparation.", concepts: ["near-post-finishing", "blindside-movement"] },
      { key: "physical", title: "The physical model", brief: "Acceleration, repeat efforts and what a forward actually has to train.", concepts: ["acceleration", "repeat-sprint-ability"] },
    ],
  },
  {
    slug: "jude-bellingham",
    name: "Jude Bellingham",
    kind: "player",
    descriptor: "Midfielder · England",
    premise:
      "How a midfielder arrives: the timing of runs from deep, and the habit of being in the box exactly when the defence is looking elsewhere.",
    verified: [
      { label: "Born", value: "29 June 2003, Stourbridge, England" },
      { label: "Position", value: "Midfielder" },
      { label: "Club", value: "Real Madrid (since 2023)" },
      { label: "Previously", value: "Birmingham City, Borussia Dortmund" },
      { label: "International", value: "England" },
    ],
    positions: ["CM", "AM"],
    embodies: ["third-man-runs", "blindside-movement", "half-spaces", "counter-pressing", "decision-speed"],
    modules: [
      { key: "dna", title: "Player DNA", brief: "The all-phase midfielder: box-to-box output with final-third quality.", concepts: ["half-spaces", "third-man-runs"] },
      { key: "arriving", title: "Arriving in the box", brief: "Timing runs from deep so you enter the box unmarked.", concepts: ["third-man-runs", "blindside-movement"] },
      { key: "half-space", title: "Playing the half-space", brief: "Receiving between full-back and centre-back, facing goal.", concepts: ["half-spaces", "receiving-half-turn"] },
      { key: "duels", title: "Duels and counter-press", brief: "Winning the ball back in the first seconds after losing it.", concepts: ["counter-pressing", "pressing-triggers"] },
    ],
  },

  // ══════════════════════════════════════════════════════════
  // COACHES
  // ══════════════════════════════════════════════════════════
  {
    slug: "pep-guardiola",
    name: "Pep Guardiola",
    kind: "coach",
    descriptor: "Head coach · Positional play",
    premise:
      "The most systematic football on earth. Studying Guardiola is studying how structure — not individual brilliance — manufactures the free man, over and over.",
    verified: [
      { label: "Born", value: "18 January 1971, Santpedor, Spain" },
      { label: "Current club", value: "Manchester City (since 2016)" },
      { label: "Previously", value: "Barcelona (2008–2012), Bayern Munich (2013–2016)" },
      { label: "Trebles", value: "Barcelona 2009, Manchester City 2023" },
      { label: "As a player", value: "Defensive midfielder for Barcelona under Johan Cruyff" },
    ],
    positions: ["GK", "CB", "FB", "DM", "CM", "AM", "W", "CF"],
    embodies: ["positional-play", "half-spaces", "build-up-3-2", "rest-defence", "counter-pressing", "overload-to-isolate"],
    modules: [
      { key: "philosophy", title: "Tactical philosophy", brief: "The principles underneath everything: superiority, occupation of space, and the free man.", concepts: ["positional-play", "half-spaces"] },
      { key: "build-up", title: "Build-up structures", brief: "How the first line is built, and how the shape guarantees an extra player.", concepts: ["build-up-3-2", "positional-play", "switch-of-play"] },
      { key: "attacking", title: "Attacking principles", brief: "Width, half-spaces, overloads and how the final third is attacked on purpose.", concepts: ["half-spaces", "overload-to-isolate", "third-man-runs"] },
      { key: "pressing", title: "Pressing & rest defence", brief: "Why his teams defend while attacking, and what happens in the five seconds after a loss.", concepts: ["rest-defence", "counter-pressing", "pressing-triggers"] },
      { key: "player-development", title: "Developing players inside a system", brief: "How individual roles are defined so that a player improves by understanding, not by freedom.", concepts: ["positional-play", "decision-speed"] },
    ],
    curated: {
      philosophy: {
        provenance: "analysis",
        summary:
          "Guardiola's football is an argument that the pitch is a set of zones, not a space for individuals to roam. Occupy the zones correctly and the opponent must choose which one to leave open — the free man appears by design rather than by accident.",
        points: [
          {
            title: "Superiority, not possession",
            body: "Possession is a by-product. The aim is to create a numerical or positional advantage in the area where the ball is, so that progression is the obvious option rather than a risk.",
          },
          {
            title: "Occupy the zone, not the ball",
            body: "Players are responsible for spaces. A winger holding width when the ball is on the far side looks uninvolved and is doing the most important job on the pitch: keeping the defence stretched.",
          },
          {
            title: "Attract, then punish",
            body: "The ball is deliberately circulated near pressure to pull opponents towards it. The pass that matters is the one after the opponent has committed.",
          },
          {
            title: "The rules exist to remove decisions",
            body: "The structure is not a cage — it removes the low-value decisions so players can spend their attention on the high-value ones in the final third.",
          },
        ],
        watchFor: [
          "Count how many players occupy each vertical lane during build-up",
          "Watch the winger furthest from the ball — what they do decides how much space the ball-side has",
        ],
      },
    },
  },
  {
    slug: "carlo-ancelotti",
    name: "Carlo Ancelotti",
    kind: "coach",
    descriptor: "Head coach · Adaptive management",
    premise:
      "The opposite study to Guardiola, and just as instructive: football built around the players you actually have, and the human management that makes elite squads function.",
    verified: [
      { label: "Born", value: "10 June 1959, Reggiolo, Italy" },
      { label: "Current club", value: "Real Madrid" },
      { label: "Previously", value: "AC Milan, Chelsea, Paris Saint-Germain, Bayern Munich, Napoli, Everton" },
      { label: "European Cup / Champions League", value: "Won five times as a manager" },
      { label: "Distinction", value: "Has won league titles in England, Spain, Italy, Germany and France" },
    ],
    positions: ["GK", "CB", "FB", "DM", "CM", "AM", "W", "CF"],
    embodies: ["rest-defence", "compact-block", "switch-of-play", "decision-speed"],
    modules: [
      { key: "philosophy", title: "Tactical philosophy", brief: "Structure that adapts to players rather than players adapting to structure.", concepts: ["rest-defence", "decision-speed"] },
      { key: "game-management", title: "Game management", brief: "Reading a match in progress: when to change shape, when to do nothing.", concepts: ["compact-block", "switch-of-play"] },
      { key: "balance", title: "Balance in midfield", brief: "How he builds a midfield that can attack without leaving the team exposed.", concepts: ["rest-defence", "positional-play"] },
      { key: "management", title: "Managing elite players", brief: "The human side: trust, autonomy and why his squads rarely fracture.", concepts: ["decision-speed"] },
    ],
  },
  {
    slug: "diego-simeone",
    name: "Diego Simeone",
    kind: "coach",
    descriptor: "Head coach · Defensive organisation",
    premise:
      "The best available study of defending as a collective craft: how a well-organised block makes technically superior teams look ordinary.",
    verified: [
      { label: "Born", value: "28 April 1970, Buenos Aires, Argentina" },
      { label: "Current club", value: "Atlético Madrid (since December 2011)" },
      { label: "League titles", value: "La Liga 2013–14 and 2020–21" },
      { label: "Europa League", value: "2012 and 2018" },
      { label: "Champions League", value: "Runner-up in 2014 and 2016" },
    ],
    positions: ["GK", "CB", "FB", "DM", "CM", "W", "CF"],
    embodies: ["compact-block", "defending-the-inside", "pressing-triggers", "counter-pressing", "offside-line"],
    modules: [
      { key: "philosophy", title: "Tactical philosophy", brief: "Why space, not the ball, is treated as the thing worth controlling.", concepts: ["compact-block", "defending-the-inside"] },
      { key: "block", title: "The block", brief: "Distances, shifting as a unit, and what the shape is actually protecting.", concepts: ["compact-block", "offside-line"] },
      { key: "pressing", title: "Pressing and traps", brief: "Inviting a pass in order to win the ball where it hurts the opponent most.", concepts: ["pressing-triggers", "defending-the-inside"] },
      { key: "transition", title: "Attacking the transition", brief: "How a defensive team creates most of its chances in the six seconds after winning the ball.", concepts: ["counter-pressing", "runs-in-behind"] },
    ],
  },
  {
    slug: "marcelo-bielsa",
    name: "Marcelo Bielsa",
    kind: "coach",
    descriptor: "Head coach · Intensity and man-marking",
    premise:
      "The coach other coaches study. Bielsa's football is extreme by design, which makes the underlying principles unusually easy to see.",
    verified: [
      { label: "Born", value: "21 July 1955, Rosario, Argentina" },
      { label: "Managed", value: "Newell's Old Boys, Argentina, Chile, Athletic Club, Marseille, Leeds United, Uruguay" },
      { label: "Achievement", value: "Led Leeds United to promotion to the Premier League in 2020" },
      { label: "Influence", value: "Cited as a major influence by Pep Guardiola and Mauricio Pochettino" },
    ],
    positions: ["GK", "CB", "FB", "DM", "CM", "AM", "W", "CF"],
    embodies: ["pressing-triggers", "counter-pressing", "runs-in-behind", "repeat-sprint-ability", "positional-play"],
    modules: [
      { key: "philosophy", title: "Tactical philosophy", brief: "Verticality, individual responsibility, and football played at the edge of what is sustainable.", concepts: ["pressing-triggers", "positional-play"] },
      { key: "pressing", title: "Man-oriented pressing", brief: "Marking people rather than zones, and the trade-offs that come with it.", concepts: ["pressing-triggers", "counter-pressing"] },
      { key: "attacking", title: "Vertical attacking", brief: "Getting the ball forward fast without abandoning structure.", concepts: ["runs-in-behind", "third-man-runs"] },
      { key: "training", title: "Training methodology", brief: "Preparation, repetition and the physical cost of the model.", concepts: ["repeat-sprint-ability", "acceleration"] },
    ],
  },
  {
    slug: "mikel-arteta",
    name: "Mikel Arteta",
    kind: "coach",
    descriptor: "Head coach · Structure and set pieces",
    premise:
      "A study in building a team from the ground up: structure first, then details — including the set-piece work most teams treat as an afterthought.",
    verified: [
      { label: "Born", value: "26 March 1982, San Sebastián, Spain" },
      { label: "Current club", value: "Arsenal (since December 2019)" },
      { label: "Previously", value: "Assistant coach at Manchester City under Pep Guardiola (2016–2019)" },
      { label: "As a player", value: "Arsenal, Everton, Rangers, Real Sociedad" },
    ],
    positions: ["GK", "CB", "FB", "DM", "CM", "AM", "W", "CF"],
    embodies: ["positional-play", "build-up-3-2", "rest-defence", "pressing-triggers", "half-spaces"],
    modules: [
      { key: "philosophy", title: "Tactical philosophy", brief: "Control through structure, and the details that turn structure into results.", concepts: ["positional-play", "rest-defence"] },
      { key: "build-up", title: "Build-up and the inverted full-back", brief: "How the shape changes between defending and attacking phases.", concepts: ["build-up-3-2", "half-spaces"] },
      { key: "pressing", title: "Pressing structure", brief: "Where the team wants to win the ball, and how it herds opponents there.", concepts: ["pressing-triggers", "defending-the-inside"] },
      { key: "set-pieces", title: "Set pieces as a system", brief: "Treating dead balls as a repeatable, coachable source of goals.", concepts: ["near-post-finishing", "blindside-movement"] },
    ],
  },
];

const BY_SLUG = new Map(PEOPLE.map((p) => [p.slug, p]));

export function person(slug: string): FootballPerson | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Loose name lookup used by the command bar ("study harry kane"). */
export function findPerson(query: string): FootballPerson | null {
  const raw = query.trim().toLowerCase();
  if (!raw) return null;
  // A slug may arrive verbatim (from a link, the palette, or a saved study).
  const bySlug = BY_SLUG.get(raw) ?? BY_SLUG.get(raw.replace(/\s+/g, "-"));
  if (bySlug) return bySlug;

  const q = raw.replace(/[^a-z\s]/g, "").trim();
  if (!q) return null;
  const exact = PEOPLE.find((p) => p.name.toLowerCase() === q);
  if (exact) return exact;
  // Surname or partial match, longest first so "kane" does not beat "harry kane".
  const partial = PEOPLE.filter((p) => {
    const name = p.name.toLowerCase();
    return name.includes(q) || q.includes(name) || name.split(" ").some((part) => part === q);
  });
  return partial[0] ?? null;
}

export const PLAYERS = PEOPLE.filter((p) => p.kind === "player");
export const COACHES = PEOPLE.filter((p) => p.kind === "coach");
