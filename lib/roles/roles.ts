import {
  LayoutGrid,
  Swords,
  History,
  Brain,
  Clapperboard,
  Dumbbell,
  HeartPulse,
  Target,
  LineChart,
  GraduationCap,
  CalendarDays,
  CalendarClock,
  Users,
  User,
  Crown,
  ClipboardList,
  Grid3x3,
  Radar,
  Activity,
  Gauge,
  Building2,
  BookMarked,
  Network,
  UserCog,
  Link2,
  Settings,
  Gift,
  Wallet,
  Share2,
  type LucideIcon,
} from "lucide-react";

/*
  ============================================================
  MIDO XI — THE ROLE REGISTRY
  ------------------------------------------------------------
  One football intelligence platform. Different operating
  systems depending on who you are.

  This file is the single place where "who is the user" turns
  into "what is the product". Navigation, terminology, quick
  actions, AI persona and the dashboard all resolve from a
  RoleDefinition. Adding a role means adding an entry here plus
  one dashboard component — never forking the app.

  Client-safe: no server imports.
  ============================================================
*/

export type RoleId = "player" | "coach" | "trainer" | "club";

export const ROLE_IDS: RoleId[] = ["player", "coach", "trainer", "club"];

export function isRoleId(v: unknown): v is RoleId {
  return typeof v === "string" && (ROLE_IDS as string[]).includes(v);
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
  /** Fully-built vs. scaffolded route — surfaced honestly in the UI. */
  status: "live" | "scaffold";
  /**
   * `primary` is the work this role does most days and is always visible.
   * `more` is real, reachable, and folded away until asked for — the command
   * bar reaches everything regardless.
   */
  group: "primary" | "more";
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Words that change meaning by role. Shared components read these. */
export interface Terminology {
  /** Name of this role's home dashboard. */
  home: string;
  /** The people this role works with. */
  people: string;
  /** A single one of those people. */
  person: string;
  /** The unit of work this role plans. */
  session: string;
  /** What "development" is called here. */
  development: string;
}

export interface RoleDefinition {
  id: RoleId;
  label: string;
  /** One line, shown under the wordmark and on the role picker. */
  tagline: string;
  /** The question this operating system exists to answer (spec 2). */
  question: string;
  icon: LucideIcon;
  nav: NavItem[];
  quickActions: QuickAction[];
  terminology: Terminology;
  /** Identity MIDO adopts when reasoning for this role. */
  aiPersona: string;
  /** Command-bar suggestions shown to this role. */
  aiOpeners: string[];
}

// ── Shared surfaces every role gets ──────────────────────────
const study: NavItem = {
  label: "Study",
  href: "/app/study",
  icon: GraduationCap,
  hint: "Learn the game",
  status: "live",
  group: "primary",
};
const calendar: NavItem = {
  label: "Calendar",
  href: "/app/calendar",
  icon: CalendarDays,
  hint: "The week",
  status: "live",
  group: "more",
};
/*
  "Meetings", not "Sessions".

  This shipped as "Sessions" and collided head-on: a Coach's nav already
  has a "Sessions" entry pointing at /app/sessions, the training-session
  planner. Two items, same label, unrelated features, no way to tell them
  apart without clicking. Everything underneath this one already says
  meeting — the route, the table, `Meeting`, `MeetingKind`, every
  function — so the label was the only place using the other word.
*/
const meetings: NavItem = {
  label: "Meetings",
  href: "/app/meetings",
  icon: CalendarClock,
  hint: "Time booked with a coach or player",
  status: "live",
  group: "more",
};
const community: NavItem = {
  label: "Community",
  href: "/app/community",
  icon: Users,
  hint: "Share & discuss",
  status: "live",
  group: "more",
};
const filmRoom = (group: NavItem["group"]): NavItem => ({
  label: "Film Room",
  href: "/app/film-room",
  icon: Clapperboard,
  hint: "Video study",
  status: "live",
  group,
});

/**
 * Everything about the account rather than the football. It lives behind the
 * identity card, not in the navigation — a player opens MIDO XI to train, not
 * to look at their subscription.
 */
export const ACCOUNT_NAV: NavItem[] = [
  { label: "Profile", href: "/app/profile", icon: User, hint: "Football identity", status: "live", group: "more" },
  { label: "Connections", href: "/app/connections", icon: Link2, hint: "Who you are linked to", status: "live", group: "more" },
  { label: "Membership", href: "/app/membership", icon: Crown, hint: "Plan & AI", status: "live", group: "more" },
  { label: "Refer", href: "/app/referrals", icon: Gift, hint: "Free months for people you bring", status: "live", group: "more" },
  { label: "Settings", href: "/app/settings", icon: Settings, hint: "Account & data", status: "live", group: "more" },
];

export const ROLES: Record<RoleId, RoleDefinition> = {
  // ── PLAYER ────────────────────────────────────────────────
  player: {
    id: "player",
    label: "Player",
    tagline: "Your private development team.",
    question: "What should I improve, study, train and understand today?",
    icon: User,
    nav: [
      { label: "The Locker", href: "/app", icon: LayoutGrid, hint: "Command center", status: "live", group: "primary" },
      { label: "Matches", href: "/app/matches", icon: Swords, hint: "Match center", status: "live", group: "primary" },
      filmRoom("primary"),
      { label: "Training", href: "/app/training", icon: Dumbbell, hint: "Sessions & load", status: "live", group: "primary" },
      { label: "Development", href: "/app/development", icon: Target, hint: "Goals & evidence", status: "live", group: "primary" },
      study,
      { label: "Timeline", href: "/app/timeline", icon: History, hint: "Your record", status: "live", group: "more" },
      { label: "Memory", href: "/app/memory", icon: Brain, hint: "What MIDO knows about you", status: "live", group: "more" },
      { label: "Recovery", href: "/app/recovery", icon: HeartPulse, hint: "Readiness & sleep", status: "live", group: "more" },
      { label: "Performance", href: "/app/performance", icon: LineChart, hint: "Analytics", status: "live", group: "more" },
      { label: "Publish", href: "/app/publish", icon: Share2, hint: "Share your progress", status: "live", group: "more" },
      community,
      calendar,
      /*
        Cut per docs/fable/PLAYER_OS_CUT_LIST.md, owner-approved 30 Aug:

        MEETINGS — a scheduling surface for club staff, duplicated by
        the Calendar for the one case a player meets. The route stays
        for coach-shared links; if meetings ever matter to players,
        they arrive as calendar entries, not a section.

        COMMUNITY — was cut with the same 30 Aug decision, with an
        explicit re-entry condition. The owner exercised it in the
        social refinement directive (30 Aug): Community returns as a
        first-class player surface, redesigned media-first — see
        docs/fable/SOCIAL_REFINEMENT.md.
      */
    ],
    quickActions: [
      { label: "Log a match", href: "/app/matches", icon: Swords },
      { label: "Log training", href: "/app/training", icon: Dumbbell },
      { label: "Start a study", href: "/app/study", icon: GraduationCap },
    ],
    terminology: {
      home: "The Locker",
      people: "Teammates",
      person: "Teammate",
      session: "Session",
      development: "Development",
    },
    aiPersona:
      "You are MIDO, the football intelligence inside a single player's development environment. " +
      "You speak to the player directly, in the language of a serious coach: precise, concrete, " +
      "never motivational filler. Everything connects back to their position, their development " +
      "priorities, and what they can actually do in their next session or match.",
    aiOpeners: [
      "Study Harry Kane",
      "What should I improve this week?",
      "Build me a striker session",
      "Why do I keep getting caught offside?",
    ],
  },

  // ── COACH ─────────────────────────────────────────────────
  coach: {
    id: "coach",
    label: "Coach",
    tagline: "Your tactical analyst and assistant coach.",
    question: "How can I understand my team, opposition, tactics and players better?",
    icon: ClipboardList,
    nav: [
      { label: "Touchline", href: "/app", icon: LayoutGrid, hint: "Command center", status: "live", group: "primary" },
      { label: "Squad", href: "/app/squad", icon: Users, hint: "Players & development", status: "live", group: "primary" },
      { label: "Sessions", href: "/app/sessions", icon: ClipboardList, hint: "Session planner", status: "live", group: "primary" },
      { label: "Opposition", href: "/app/opposition", icon: Radar, hint: "Scouting & match plan", status: "live", group: "primary" },
      { label: "Tactics", href: "/app/tactics", icon: Grid3x3, hint: "Tactical board", status: "live", group: "primary" },
      study,
      { label: "Matches", href: "/app/matches", icon: Swords, hint: "Fixtures & analysis", status: "live", group: "more" },
      filmRoom("more"),
      calendar,
      meetings,
      community,
    ],
    quickActions: [
      { label: "Plan a session", href: "/app/sessions", icon: ClipboardList },
      { label: "Open the board", href: "/app/tactics", icon: Grid3x3 },
      { label: "Study a coach", href: "/app/study", icon: GraduationCap },
    ],
    terminology: {
      home: "Touchline",
      people: "Squad",
      person: "Player",
      session: "Training session",
      development: "Player development",
    },
    aiPersona:
      "You are MIDO, the analyst and assistant coach inside a coach's operating system. You reason " +
      "in structures, principles and problems: build-up, pressing, transitions, rest defence, and " +
      "individual development inside a team model. You never invent scouting information — you work " +
      "from what the coach has recorded, and you say plainly when something is unknown.",
    aiOpeners: [
      "Study Pep Guardiola",
      "Create tomorrow's session around defending transitions",
      "How do we break a mid-block?",
      "What should we work on after the last match?",
    ],
  },

  // ── TRAINER ───────────────────────────────────────────────
  trainer: {
    id: "trainer",
    label: "Trainer",
    tagline: "Your athlete-management and programming system.",
    question: "How can I develop each athlete intelligently?",
    icon: Activity,
    nav: [
      { label: "The Lab", href: "/app", icon: LayoutGrid, hint: "Command center", status: "live", group: "primary" },
      { label: "Athletes", href: "/app/athletes", icon: UserCog, hint: "Roster & readiness", status: "live", group: "primary" },
      { label: "Programs", href: "/app/programs", icon: Dumbbell, hint: "Blocks & progression", status: "live", group: "primary" },
      { label: "Assessments", href: "/app/assessments", icon: Gauge, hint: "Testing & progress", status: "live", group: "primary" },
      study,
      { label: "Sessions", href: "/app/training", icon: ClipboardList, hint: "Delivered work", status: "live", group: "more" },
      { label: "Payments", href: "/app/payments", icon: Wallet, hint: "Products & payment links", status: "live", group: "more" },
      calendar,
      meetings,
      community,
    ],
    quickActions: [
      { label: "Add an athlete", href: "/app/athletes", icon: UserCog },
      { label: "Build a program", href: "/app/programs", icon: Dumbbell },
      { label: "Record a test", href: "/app/assessments", icon: Gauge },
    ],
    terminology: {
      home: "The Lab",
      people: "Athletes",
      person: "Athlete",
      session: "Training session",
      development: "Physical development",
    },
    aiPersona:
      "You are MIDO, the programming assistant inside a football performance trainer's system. You " +
      "think in blocks, loads, qualities and adaptation, and you always tie physical work back to a " +
      "football objective. You program from the athlete's actual assessments, history and " +
      "limitations — never generic templates — and you flag when the data you would need is missing.",
    aiOpeners: [
      "Build a six-week acceleration block for a winger",
      "Study how elite forwards create separation",
      "Which athletes need a deload?",
      "Design a return-to-play progression",
    ],
  },

  // ── CLUB ──────────────────────────────────────────────────
  club: {
    id: "club",
    label: "Club",
    tagline: "The intelligence layer across your organization.",
    question:
      "How can we connect development, performance, coaching and football intelligence across the club?",
    icon: Building2,
    nav: [
      { label: "HQ", href: "/app", icon: LayoutGrid, hint: "Club intelligence", status: "live", group: "primary" },
      { label: "Teams", href: "/app/teams", icon: Network, hint: "Squads & age groups", status: "live", group: "primary" },
      { label: "Staff", href: "/app/staff", icon: Users, hint: "Coaches & trainers", status: "live", group: "primary" },
      { label: "Methodology", href: "/app/methodology", icon: BookMarked, hint: "How we play, train, develop", status: "live", group: "primary" },
      { label: "Development", href: "/app/intelligence", icon: LineChart, hint: "Organization trends", status: "live", group: "primary" },
      study,
      calendar,
      meetings,
      community,
    ],
    quickActions: [
      { label: "Add a team", href: "/app/teams", icon: Network },
      { label: "Write methodology", href: "/app/methodology", icon: BookMarked },
      { label: "Invite staff", href: "/app/staff", icon: Users },
    ],
    terminology: {
      home: "HQ",
      people: "Members",
      person: "Member",
      session: "Session",
      development: "Development",
    },
    aiPersona:
      "You are MIDO, the intelligence layer of a football organization. You reason across teams, " +
      "age groups, staff and methodology, and you answer inside the club's documented way of " +
      "playing, training and developing players. You summarise organizational patterns; you never " +
      "fabricate numbers about people you have no data for.",
    aiOpeners: [
      "Study Pep Guardiola",
      "Summarise development trends across our teams",
      "Draft our pressing principles",
      "Which age groups lack match minutes?",
    ],
  },
};

/** Serializable identity handed from server layout to the client shell. */
export interface ShellIdentity {
  role: RoleId;
  /** Systems this account may open — already filtered by entitlement. */
  availableRoles: RoleId[];
  /** Systems the account set up but has not paid for. Shown locked, not hidden. */
  lockedRoles: RoleId[];
  displayName: string;
  identityLine: string;
  badge: string;
  isDemo: boolean;
}

export function roleDef(role: RoleId | null | undefined): RoleDefinition {
  return ROLES[role && isRoleId(role) ? role : "player"];
}

export function navForRole(role: RoleId | null | undefined): NavItem[] {
  return roleDef(role).nav;
}

/** The work this role does most days — what the sidebar always shows. */
export function primaryNav(role: RoleId | null | undefined): NavItem[] {
  return navForRole(role).filter((n) => n.group === "primary");
}

/** Real, reachable, folded away until asked for. */
export function moreNav(role: RoleId | null | undefined): NavItem[] {
  return navForRole(role).filter((n) => n.group === "more");
}

/** Section title for a pathname — across navigation and the account area. */
export function sectionTitleFor(role: RoleId | null | undefined, pathname: string): string {
  const match = [...navForRole(role), ...ACCOUNT_NAV].find((n) =>
    n.href === "/app" ? pathname === "/app" : pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  return match?.label ?? "MIDO XI";
}

/** Roles other than the active one — the switcher list. */
export function otherRoles(active: RoleId): RoleDefinition[] {
  return ROLE_IDS.filter((r) => r !== active).map((r) => ROLES[r]);
}
