"use client";

import { useRouter } from "next/navigation";
import { Swords, Dumbbell, Scissors, BookOpen } from "lucide-react";

const ACTIONS = [
  { label: "Add match", icon: Swords, href: "/app/matches" },
  { label: "Log training", icon: Dumbbell, href: "/app/training" },
  { label: "Add clip", icon: Scissors, href: "/app/film-room" },
  { label: "Start study", icon: BookOpen, href: "/app/film-room" },
] as const;

export function QuickEntry() {
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 gap-2">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.label}
            onClick={() => router.push(a.href)}
            className="group flex items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 py-3 text-left text-sm text-text transition-colors hover:border-signal-line hover:bg-signal/5 hover:text-text-hi"
          >
            <Icon className="size-4 text-text-faint transition-colors group-hover:text-signal-bright" />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
