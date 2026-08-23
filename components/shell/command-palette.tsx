"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  Swords,
  Dumbbell,
  Clapperboard,
  Scissors,
  Target,
  CornerDownLeft,
  Sparkles,
  GraduationCap,
  BookOpen,
  Ban,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import { runSearch, type SearchEntry } from "@/lib/search";
import { parseIntent } from "@/lib/knowledge/intent";
import { searchKnowledge } from "@/lib/knowledge/graph";
import { ACCOUNT_NAV, roleDef, type ShellIdentity } from "@/lib/roles/roles";

/*
  The MIDO command bar (spec 12).

  Three layers, in priority order:
    1. INTENT   — "Study Harry Kane", "build me a striker session". Classified
                  deterministically and routed into the module that owns it.
                  A request MIDO cannot serve comes back as a refusal with a
                  reason, which is why the row for it looks different: an
                  honest "no" is a result, not an empty state.
    2. KNOWLEDGE— people and concepts from the curated football graph.
    3. WORKSPACE— the user's own football memory, plus this role's navigation.
                  The memory is resolved on the server and handed in: this used
                  to be an index built at module scope from seed data, which
                  meant every real account searched a fictional player's season.

  Nothing here pretends to be AI: classification is rules-based and instant, so
  no allowance is spent working out where a request belongs.
*/

interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  href: string;
}

const CREATE: Command[] = [
  { id: "add-match", label: "Add match", group: "Create", icon: Swords, href: "/app/matches" },
  { id: "log-training", label: "Log training", group: "Create", icon: Dumbbell, href: "/app/training" },
  { id: "upload-video", label: "Upload video", group: "Create", icon: Clapperboard, href: "/app/film-room" },
  { id: "add-clip", label: "Add clip", group: "Create", icon: Scissors, href: "/app/film-room" },
  { id: "start-study", label: "Start a study", group: "Create", icon: GraduationCap, href: "/app/study" },
  { id: "add-goal", label: "Create development goal", group: "Create", icon: Target, href: "/app/development" },
];

const typeIcon: Record<SearchEntry["type"], LucideIcon> = {
  match: Swords,
  clip: Scissors,
  goal: Target,
  focus: Target,
};

export function CommandPalette({
  open,
  onClose,
  identity,
  searchIndex,
}: {
  open: boolean;
  onClose: () => void;
  identity: ShellIdentity;
  searchIndex: SearchEntry[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <PaletteBody onClose={onClose} identity={identity} searchIndex={searchIndex} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Mounted only while the palette is open, so state starts fresh each time. */
function PaletteBody({
  onClose,
  identity,
  searchIndex,
}: {
  onClose: () => void;
  identity: ShellIdentity;
  searchIndex: SearchEntry[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const def = roleDef(identity.role);

  const intent = useMemo(() => parseIntent(query, identity.role), [query, identity.role]);
  const knowledge = useMemo(() => (query.trim().length > 1 ? searchKnowledge(query, 4) : []), [query]);
  const results = useMemo(() => runSearch(query, searchIndex), [query, searchIndex]);

  const navCommands = useMemo(
    () =>
      [...def.nav, ...ACCOUNT_NAV].map((n) => ({
        id: `go-${n.href}`,
        label: n.label,
        group: "Go to",
        icon: n.icon,
        href: n.href,
      })),
    [def],
  );

  const filteredCommands = useMemo(() => {
    const all = [...CREATE, ...navCommands];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, navCommands]);

  // Flat list for keyboard navigation, in the same order as rendering.
  const flat = useMemo(
    () =>
      [
        ...(intent ? [intent.href] : []),
        ...knowledge.map((k) => k.href),
        ...results.map((r) => r.href),
        ...filteredCommands.map((c) => c.href),
      ],
    [intent, knowledge, results, filteredCommands],
  );

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const href = flat[active];
      if (href) go(href);
    }
  };

  let cursor = 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="panel-raised relative w-full max-w-xl overflow-hidden shadow-2xl shadow-black/50"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-text-dim" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={def.aiOpeners[0] ?? "Search or run a command"}
          className="h-13 flex-1 bg-transparent py-4 text-[15px] text-text-hi placeholder:text-text-faint focus:outline-none"
        />
        <kbd className="chip">ESC</kbd>
      </div>

      <div className="max-h-[52vh] overflow-y-auto p-2">
        {intent && (
          <Group label={intent.kind === "cannot" ? "MIDO cannot do this" : "MIDO"}>
            {(() => {
              const idx = cursor++;
              const refusal = intent.kind === "cannot";
              return (
                <Row
                  icon={refusal ? Ban : intent.kind === "build" ? Hammer : Sparkles}
                  active={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(intent.href)}
                  title={intent.label}
                  subtitle={intent.hint}
                  muted={refusal}
                />
              );
            })()}
          </Group>
        )}

        {knowledge.length > 0 && (
          <Group label="Football knowledge">
            {knowledge.map((k) => {
              const idx = cursor++;
              return (
                <Row
                  key={k.kind + k.slug}
                  icon={k.kind === "person" ? GraduationCap : BookOpen}
                  active={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(k.href)}
                  title={k.title}
                  subtitle={k.subtitle}
                  tag={k.kind}
                />
              );
            })}
          </Group>
        )}

        {results.length > 0 && (
          <Group label="Your football memory">
            {results.map((r) => {
              const Icon = typeIcon[r.type];
              const idx = cursor++;
              return (
                <Row
                  key={r.id}
                  icon={Icon}
                  active={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(r.href)}
                  title={r.title}
                  subtitle={r.subtitle}
                  tag={r.type}
                />
              );
            })}
          </Group>
        )}

        {["Create", "Go to"].map((group) => {
          const items = filteredCommands.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <Group key={group} label={group}>
              {items.map((c) => {
                const idx = cursor++;
                return (
                  <Row
                    key={c.id}
                    icon={c.icon}
                    active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(c.href)}
                    title={c.label}
                  />
                );
              })}
            </Group>
          );
        })}

        {!intent && knowledge.length === 0 && results.length === 0 && filteredCommands.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-text-dim">
            No matches for <span className="text-text-hi">&ldquo;{query}&rdquo;</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-text-faint">
        <span className="label-tech">{def.label} OS</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px]">
          <CornerDownLeft className="size-3" /> to open
        </span>
        <span className="text-[11px]">↑↓ to navigate</span>
      </div>
    </motion.div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="label-tech px-3 py-1.5">{label}</div>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  subtitle,
  tag,
  active,
  muted,
  onClick,
  onMouseEnter,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tag?: string;
  active: boolean;
  /** A refusal — real information, but not an action to reach for. */
  muted?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-active={active}
      className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors data-[active=true]:bg-signal/10"
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-md border border-line ${
          muted ? "text-text-faint" : active ? "text-signal-bright" : "text-text-dim"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${muted ? "text-text-dim" : "text-text-hi"}`}>
          {title}
        </span>
        {subtitle && (
          // A refusal's reason is the useful half, so it is not truncated away.
          <span className={`block text-xs text-text-dim ${muted ? "" : "truncate"}`}>{subtitle}</span>
        )}
      </span>
      {tag && <span className="chip">{tag}</span>}
    </button>
  );
}
